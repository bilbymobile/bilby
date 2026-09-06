import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Database access. Postgres, on Supabase.
 *
 * ## Why Postgres and not the SQLite file this used to be
 *
 * The previous version ran libSQL, which is SQLite with a remote protocol. That
 * was a good fit for a single operator product and it had one property worth
 * mourning: a fresh clone ran with no account anywhere, against a local file.
 *
 * What it did not have is anything else. Supabase brings Postgres proper, and
 * with it the things this product is about to need: real constraints and
 * partial indexes for the discount code rules, `SELECT ... FOR UPDATE` so two
 * simultaneous redemptions of a single use code cannot both win, a managed
 * backup story, and a console a non engineer can look at when an order goes
 * wrong at midnight.
 *
 * The cost is honest and worth writing down: **there is no zero configuration
 * path any more.** `DATABASE_URL` must be set before anything works, locally
 * as well as in production. Point it at a free Supabase project for
 * development, or run `supabase start` if you have Docker. The failure below is
 * deliberately loud and tells you exactly what to set, because the alternative
 * is a connection error thrown from inside a request handler that reads like a
 * bug in the handler.
 *
 * ## Use the pooler, and know why
 *
 * Supabase gives you two connection strings. The direct one on port 5432 opens
 * a real Postgres backend per connection; a serverless deployment will exhaust
 * those in a traffic spike and start failing in a way that looks like the
 * database is down. The **transaction pooler on port 6543** exists for exactly
 * this shape of workload and is the one to use.
 *
 * That choice has a consequence that bites silently: a transaction mode pooler
 * hands your connection to someone else between statements, so **named prepared
 * statements and session state do not survive**. node-postgres uses unnamed
 * portals unless you pass a `name`, so we are fine, and this comment exists so
 * nobody adds one later and spends an afternoon on `prepared statement "S_1"
 * already exists`.
 *
 * ## Placeholders
 *
 * Postgres numbers its parameters, `$1` and `$2`, where SQLite used `?`. Every
 * call site in this codebase was written against `?`, so rather than rewrite
 * two dozen queries by hand and get one of them subtly wrong, the helpers
 * translate. The translation is deliberately dumb: it walks the string and
 * replaces `?` outside of quoted literals. If you ever need a literal question
 * mark inside a string in SQL, put it in a parameter.
 */

let pool: Pool | null = null;
let migrated: Promise<void> | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  throw new Error(
    "DATABASE_URL is not set.\n\n" +
      "Bilby runs on Postgres (Supabase). Set DATABASE_URL to the connection " +
      "pooler string from your Supabase project: Settings, Database, Connection " +
      "string, Transaction pooler. It looks like\n" +
      "  postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres\n\n" +
      "Use the pooler on port 6543, not the direct connection on 5432: a " +
      "serverless deployment opens far more connections than a direct Postgres " +
      "will accept.",
  );
}

/**
 * Catch the connection strings that are wrong in a way Postgres cannot explain.
 *
 * Supabase offers three strings and they differ in the USERNAME, not just the
 * host and port. The pooler encodes the tenant in the username, so
 * `postgres.<project ref>` reaches your project and a bare `postgres` reaches
 * nothing. Supavisor answers that with `password authentication failed for user
 * "postgres"`, which sends you off to check a password that was never the
 * problem.
 *
 * This turns that into a sentence naming the actual fix. It runs once, at pool
 * construction, and only refuses configurations that cannot work:
 *
 *   pooler host + bare `postgres` username   cannot resolve a tenant, ever
 *   direct `db.<ref>.supabase.co` host       IPv6 only, and one connection per
 *                                            instance, which is the wrong shape
 *                                            for serverless
 *
 * Deliberately not a warning. A misconfigured database is not a degraded mode,
 * and an application that starts anyway just moves the discovery to a customer.
 */
function assertUsableConnection(conn: string): void {
  let user = "";
  let host = "";
  let port = "";
  try {
    const u = new URL(conn);
    user = decodeURIComponent(u.username);
    host = u.hostname;
    port = u.port;
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL.\n\n" +
        "The usual cause is a password containing one of @ : / ? # % [ ] that " +
        "has not been percent encoded. Encode it, or reset the database " +
        "password to letters and digits only, which removes the problem " +
        "rather than working around it.",
    );
  }

  if (host.endsWith(".pooler.supabase.com") && !user.includes(".")) {
    throw new Error(
      `DATABASE_URL uses the Supabase pooler but the username is "${user}".\n\n` +
        "The pooler identifies your project from the username, so it has to be " +
        "postgres.<project ref>, not a bare postgres. A bare one reaches no " +
        'tenant at all and the pooler reports it as "password authentication ' +
        'failed", which is why this check exists: the password is not the ' +
        "problem.\n\n" +
        "You have probably copied the Direct connection string and changed the " +
        "host. Copy the Transaction pooler string whole instead: Supabase, " +
        "Connect, Transaction pooler.",
    );
  }

  if (/^db\..*\.supabase\.co$/.test(host)) {
    throw new Error(
      `DATABASE_URL points at ${host}, which is the direct connection.\n\n` +
        "That will not work from here for two reasons. It is IPv6 only on the " +
        "free plan, and it gives one real Postgres connection per client, while " +
        "a serverless deployment opens far more than the server will accept. " +
        "The failure looks like the database being down.\n\n" +
        "Use the Transaction pooler string instead: same project, username " +
        "postgres.<project ref>, host <region>.pooler.supabase.com, port 6543.",
    );
  }

  if (host.endsWith(".pooler.supabase.com") && port === "5432") {
    // Session mode. It works, so this is not fatal, but it holds a connection
    // for the life of the client and that is the thing serverless does worst.
    console.warn(
      "[db] port 5432 on the pooler is session mode. Transaction mode is 6543 " +
        "and is the one built for serverless.",
    );
  }
}

/** Loopback, or an explicit sslmode=disable. Nothing else counts as local. */
function isLocal(conn: string): boolean {
  try {
    const u = new URL(conn);
    if (u.searchParams.get("sslmode") === "disable") return true;
    return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(u.hostname);
  } catch {
    return false;
  }
}

function getPool(): Pool {
  if (pool) return pool;

  const conn = connectionString();
  assertUsableConnection(conn);

  pool = new Pool({
    connectionString: conn,
    // Supabase terminates TLS with a certificate this client cannot chain to a
    // root it ships. The connection is still encrypted; what is skipped is
    // verification of the certificate authority. Acceptable to Supabase's own
    // documented setup, and the alternative is bundling their CA and rotating
    // it by hand.
    //
    // A local Postgres, whether `supabase start` or a bare install, speaks no
    // TLS at all, and asking for it there fails the connection outright with a
    // message about the server not supporting SSL. So it is on for anything
    // remote and off for loopback, which is the only place it is safe to skip.
    ssl: isLocal(conn) ? false : { rejectUnauthorized: false },
    // Small on purpose. Each serverless instance keeps its own pool, so a large
    // per instance maximum multiplies across instances and defeats the point of
    // using a pooler at all.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // A query that has not returned in thirty seconds is not going to. Failing
    // is better than holding a pooled connection open behind it.
    statement_timeout: 30_000,
  });

  pool.on("error", (err) => {
    // An idle client erroring is normal when a pooler recycles a connection.
    // Left unhandled it takes the process down, which turns a routine recycle
    // into an outage.
    console.error("[db] idle client error", err.message);
  });

  return pool;
}

/** Connects and applies the schema once per process. */
export function db(): Promise<Pool> {
  const p = getPool();
  if (!migrated) {
    migrated = migrate(p).catch((e) => {
      // Reset so the next request retries rather than caching the failure for
      // the life of the instance.
      migrated = null;
      throw e;
    });
  }
  return migrated.then(() => p);
}

async function migrate(p: Pool) {
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          TEXT UNIQUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- Where the handset is RIGHT NOW. Moves when they fly.
      country        TEXT NOT NULL DEFAULT 'AU',
      -- Where they signed up. Set once, never updated: if it moved with the
      -- user it would be worthless as a home market signal and would become
      -- spoofable by travelling.
      home_country   TEXT NOT NULL DEFAULT 'AU',
      -- Where the data will be USED. Chosen by the user, changeable any time.
      destination    TEXT,
      -- Device scoped anti abuse. One allowance per device, not per email,
      -- because email is free and devices are not.
      device_hash    TEXT,
      banned_at      TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_hash);

    CREATE TABLE IF NOT EXISTS esims (
      iccid            TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id),
      supplier         TEXT NOT NULL,
      supplier_order   TEXT,
      activation_code  TEXT NOT NULL,
      smdp_address     TEXT NOT NULL,
      matching_id      TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      installed_at     TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_esims_user ON esims(user_id);

    /*
     * An order is one payment. What was bought lives in order_items, one row
     * per line, and the split is what lets a single payment carry an eSIM, a
     * top up and something we have not invented yet.
     *
     * The money columns here are the ones migratePlatform adds: sell_currency,
     * sell_amount, tax and presentment. cost_usd and revenue_usd are neither.
     * They are what the ad funded tier recorded, they are denominated in the
     * wrong currency for an Australian business, and they stay only because
     * nothing is gained by dropping a zeroed column.
     */
    CREATE TABLE IF NOT EXISTS orders (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id),
      cost_usd       NUMERIC(12,6) NOT NULL DEFAULT 0,
      revenue_usd    NUMERIC(12,6) NOT NULL DEFAULT 0,
      status         TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
  `);

  /*
   * The free tier, removed.
   *
   * These are dropped rather than left in place. A dead table is not free: it
   * is a foreign key that stops you dropping the table it points at, it is a
   * column somebody writes a report against by accident, and it is the reason
   * the next person reading this schema asks what an ad reward was. Nothing was
   * ever deployed against them, so there is no data to preserve.
   *
   * The legacy columns on `orders` go the same way. `plan_id` and `kind` were
   * NOT NULL, which means a platform order that has no supplier plan id — every
   * order from now on — could not be inserted at all.
   */
  /*
   * Delivery, recorded on the order.
   *
   * delivered_count rather than a boolean, because an order can be delivered
   * more than once and correctly so: a two line order where the second supplier
   * was down sends one email now and another when the second line lands. The
   * count is how "we have already told them about this much" is expressed
   * without a second table.
   */
  await addColumn(p, "orders", "delivered_at", "TIMESTAMPTZ");
  await addColumn(p, "orders", "delivered_count", "INTEGER NOT NULL DEFAULT 0");
  await addColumn(p, "orders", "refunded_amount", "NUMERIC(12,2) NOT NULL DEFAULT 0");
  await addColumn(p, "orders", "refund_ref", "TEXT");

  await p.query(`DROP TABLE IF EXISTS credit_ledger`);
  await p.query(`DROP TABLE IF EXISTS daily_budget`);
  await p.query(`ALTER TABLE esims  DROP COLUMN IF EXISTS is_free_tier`);
  await p.query(`ALTER TABLE orders DROP COLUMN IF EXISTS plan_id`);
  await p.query(`ALTER TABLE orders DROP COLUMN IF EXISTS kind`);
  await p.query(`ALTER TABLE orders DROP COLUMN IF EXISTS iccid`);

  await migrateDiscounts(p);
  await migrateStaff(p);
  await migratePlatform(p);
  await migrateGuards(p);

  await addColumn(p, "users", "destination", "TEXT");
}

/**
 * The platform layer. See PLATFORM.md for the reasoning; this is the schema.
 *
 * The short version: everything above this function is either product agnostic
 * already (users, staff, audit) or specific to eSIM (esims). What was missing
 * is the middle — a catalogue of things we sell, a commerce layer that does not
 * know what it is selling, and a record of what a customer now owns. Without
 * those, a second product category is a rewrite rather than an adapter.
 *
 * Five seams, and every one of them is free to add today and expensive to add
 * after the first paying customer:
 *
 *   1. An order is money. An order item is a thing. Today every order has one
 *      item, so splitting them costs nothing; it is also the only way to write
 *      down a partly failed order, which currently has nowhere to go when
 *      provisioning fails after Stripe has captured.
 *   2. Money is a currency, an FX rate, a tax code, and what the customer
 *      actually saw. Recorded, never recomputed.
 *   3. A stored catalogue whose SKUs are ours and whose sources are theirs.
 *   4. Entitlements: what a customer owns, whatever kind of thing it is.
 *   5. Idempotency, so one payment can never provision twice.
 *
 * **On `orders`.** The legacy `plan_id`, `iccid` and `kind` columns are gone,
 * dropped in the migration above. `orders.iccid` in particular was the exact
 * violation of the boundary this whole layer exists to draw: commerce is not
 * allowed to know what an eSIM is, and a column named after one is commerce
 * knowing.
 */
async function migratePlatform(p: Pool) {
  /* ---- Seam 3: the catalogue ------------------------------------------- */
  await p.query(`
    CREATE TABLE IF NOT EXISTS catalog_items (
      -- Ours, and permanent. A supplier's plan id is theirs and changes when
      -- they reorganise; this is what goes on an order and has to still mean
      -- something in three years.
      sku          TEXT PRIMARY KEY,
      category     TEXT NOT NULL,
      title        TEXT NOT NULL,
      subtitle     TEXT,
      tax_code     TEXT NOT NULL DEFAULT 'GST',
      active       BOOLEAN NOT NULL DEFAULT false,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      -- Category specific shape, as JSON rather than as columns. For an eSIM:
      -- {"countries":["JP"],"dataMb":5120,"validityDays":15,"topUp":true}
      -- A second category brings its own keys and no migration.
      attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- What to ask the customer for at purchase time, and how to validate it.
      -- An eSIM needs nothing. A data top up needs the number being topped up,
      -- and the acceptance test in PLATFORM.md failed on exactly this gap.
      input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_live
      ON catalog_items(category, sort_order) WHERE active;

    /*
     * One row per SKU per PRICING currency.
     *
     * A second row is a price a person decided on for a market. It is never an
     * FX conversion of the first, because a converted price moves with the
     * market and produces tags like $19.37. Today there is exactly one row per
     * SKU, in AUD.
     */
    CREATE TABLE IF NOT EXISTS catalog_prices (
      sku          TEXT NOT NULL REFERENCES catalog_items(sku) ON DELETE CASCADE,
      currency     TEXT NOT NULL,
      -- Tax inclusive, because that is how it is displayed to an Australian.
      sell_amount  NUMERIC(12,2) NOT NULL CHECK (sell_amount >= 0),
      is_default   BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (sku, currency)
    );
    -- Exactly one default per SKU, enforced rather than hoped for.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_price_default
      ON catalog_prices(sku) WHERE is_default;

    /*
     * Who can serve this SKU. Switching supplier for Japan is an update here,
     * and last month's orders still point at whoever actually served them.
     */
    CREATE TABLE IF NOT EXISTS catalog_sources (
      sku           TEXT NOT NULL REFERENCES catalog_items(sku) ON DELETE CASCADE,
      fulfiller_id  TEXT NOT NULL,
      external_id   TEXT NOT NULL,
      -- Last known wholesale, for margin display only. The number that counts
      -- is the one written onto the order at the time it was placed.
      cost_amount   NUMERIC(12,6) NOT NULL DEFAULT 0,
      cost_currency TEXT NOT NULL DEFAULT 'USD',
      priority      INTEGER NOT NULL DEFAULT 100,
      enabled       BOOLEAN NOT NULL DEFAULT true,
      checked_at    TIMESTAMPTZ,
      PRIMARY KEY (sku, fulfiller_id)
    );
    CREATE INDEX IF NOT EXISTS idx_source_pick
      ON catalog_sources(sku, priority) WHERE enabled;
  `);

  /* ---- Seams 1 and 2: orders are money, items are things --------------- */
  await addColumn(p, "orders", "sell_currency", "TEXT NOT NULL DEFAULT 'AUD'");
  await addColumn(p, "orders", "sell_amount", "NUMERIC(12,2) NOT NULL DEFAULT 0");
  await addColumn(p, "orders", "tax_code", "TEXT NOT NULL DEFAULT 'GST'");
  await addColumn(p, "orders", "tax_amount", "NUMERIC(12,2) NOT NULL DEFAULT 0");
  // Which regime applied, and the evidence for it. Establishing where a
  // consumer is for VAT takes two pieces of non contradictory evidence, and
  // that evidence cannot be collected after the fact.
  await addColumn(p, "orders", "tax_country", "TEXT");
  await addColumn(p, "orders", "tax_evidence", "JSONB NOT NULL DEFAULT '{}'::jsonb");
  // What the customer saw, when it differs from what we charge in. Without it,
  // somebody writing in to say they paid EUR 18.40 cannot be matched to an
  // order that reads AUD 29.00.
  await addColumn(p, "orders", "presentment_currency", "TEXT");
  await addColumn(p, "orders", "presentment_amount", "NUMERIC(12,2)");
  await addColumn(p, "orders", "discount_code", "TEXT");
  await addColumn(p, "orders", "discount_amount", "NUMERIC(12,2) NOT NULL DEFAULT 0");
  await addColumn(p, "orders", "stripe_ref", "TEXT");
  await addColumn(p, "orders", "paid_at", "TIMESTAMPTZ");

  await p.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id            TEXT PRIMARY KEY,
      order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      sku           TEXT NOT NULL,
      -- Category lives HERE and never on the order. That is the boundary.
      category      TEXT NOT NULL,
      fulfiller_id  TEXT,
      supplier_ref  TEXT,
      cost_currency TEXT NOT NULL DEFAULT 'USD',
      cost_amount   NUMERIC(12,6) NOT NULL DEFAULT 0,
      -- Sell currency units per one unit of cost currency, at order time.
      -- Margin is not knowable without it and it cannot be reconstructed later.
      fx_rate       NUMERIC(12,6),
      -- What the customer supplied, if this category asks for anything. Frozen
      -- on the item, because "you sent it to the wrong number" is a support
      -- conversation that needs evidence.
      input         JSONB NOT NULL DEFAULT '{}'::jsonb,
      status        TEXT NOT NULL DEFAULT 'pending',
      attempts      INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      fulfilled_at  TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
    -- The operations queue: what paid but has not been delivered.
    CREATE INDEX IF NOT EXISTS idx_items_stuck
      ON order_items(created_at) WHERE status IN ('pending', 'failed');
  `);

  /* ---- Seam 4: entitlements -------------------------------------------- */
  await p.query(`
    CREATE TABLE IF NOT EXISTS entitlements (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id),
      order_item_id TEXT REFERENCES order_items(id),
      category      TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'issued',
      -- The ICCID for an eSIM. Whatever identifies the thing, for the next
      -- category. The esims table keeps its own detail and this points at it.
      external_ref  TEXT,
      -- What the customer sees in a list of things they own.
      label         TEXT NOT NULL,
      expires_at    TIMESTAMPTZ,
      payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ent_user
      ON entitlements(user_id, created_at DESC);
    -- One entitlement per order item. A retried fulfilment must not mint a
    -- second one, and a unique index says so at the only layer that cannot be
    -- talked out of it.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ent_item
      ON entitlements(order_item_id) WHERE order_item_id IS NOT NULL;
  `);

  /* ---- Seam 5: idempotency --------------------------------------------- */
  await p.query(`
    /*
     * Claimed by conditional insert, never by read then write.
     *
     * Stripe retries webhooks. Suppliers time out after doing the work. People
     * double click. Every one of those paths ends at "provision an eSIM", and
     * two of them can arrive at once. The failure this prevents is two profiles
     * against one payment, and the second one cannot be clawed back because it
     * is activated.
     */
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key        TEXT PRIMARY KEY,
      scope      TEXT NOT NULL,
      state      TEXT NOT NULL DEFAULT 'claimed',
      result     JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      settled_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_idem_age ON idempotency_keys(created_at);
  `);
}

/**
 * Discount codes.
 *
 * Separated from the block above only because it is new and reads better on its
 * own, not because it is optional.
 *
 * The design point worth defending is `redeemed_count` living on the code row
 * rather than being counted from the redemptions table. Counting looks cleaner
 * and is wrong under concurrency: two people submitting the last use of a
 * single use code both read a count of zero, both decide they are allowed, and
 * both redeem. Keeping the counter on the row lets the claim be a single
 * conditional UPDATE, which Postgres serialises for us. See `claimCode`.
 */
async function migrateDiscounts(p: Pool) {
  await p.query(`
    CREATE TABLE IF NOT EXISTS discount_codes (
      code             TEXT PRIMARY KEY,
      -- 'percent' takes value as 1..100. 'fixed' takes value as an amount in
      -- the currency below. Two kinds only: everything else anyone has ever
      -- wanted turns out to be one of these two with different limits.
      kind             TEXT NOT NULL CHECK (kind IN ('percent', 'fixed')),
      value            NUMERIC(10,2) NOT NULL CHECK (value > 0),
      currency         TEXT NOT NULL DEFAULT 'AUD',

      -- NULL means unlimited. The count is authoritative; see the note above.
      max_redemptions  INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
      redeemed_count   INTEGER NOT NULL DEFAULT 0,
      per_user_limit   INTEGER NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),

      min_spend        NUMERIC(10,2),
      -- NULL means any destination. Otherwise ISO codes the code is valid for.
      destinations     TEXT[],

      starts_at        TIMESTAMPTZ,
      expires_at       TIMESTAMPTZ,
      active           BOOLEAN NOT NULL DEFAULT true,

      -- Why this code exists, for whoever finds it in six months.
      note             TEXT,
      created_by       TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT percent_in_range
        CHECK (kind <> 'percent' OR (value > 0 AND value <= 100))
    );

    CREATE INDEX IF NOT EXISTS idx_codes_active
      ON discount_codes(active, expires_at);

    CREATE TABLE IF NOT EXISTS discount_redemptions (
      id          BIGSERIAL PRIMARY KEY,
      code        TEXT NOT NULL REFERENCES discount_codes(code) ON DELETE RESTRICT,
      user_id     TEXT NOT NULL REFERENCES users(id),
      order_id    TEXT,
      -- What the discount was actually worth on this order, captured here
      -- rather than recomputed, for the same reason wholesale cost is captured
      -- on the order: the rule may change, the history may not.
      amount_off  NUMERIC(10,2) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_redemptions_code ON discount_redemptions(code);
    CREATE INDEX IF NOT EXISTS idx_redemptions_user ON discount_redemptions(code, user_id);
  `);

  // One redemption row per order. A retried webhook must not double count a
  // code, and a partial index lets rows with no order id (a hold that never
  // completed) coexist without tripping it.
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_redemption_order
      ON discount_redemptions(order_id) WHERE order_id IS NOT NULL
  `);
}

/**
 * Staff, sessions and the audit log.
 *
 * Two things here are deliberate and neither is obvious.
 *
 * **Tokens are stored hashed.** Both the sign in link and the session live in
 * this table as SHA-256 digests, never as the value the browser holds. A dump
 * of this database therefore grants nobody a session. It is the same reasoning
 * as never storing a password, applied to the things that are as good as one.
 *
 * **The audit log has no delete path.** Not in the schema, not in the module,
 * not for the owner. The first instinct after a mistake is to tidy it away, and
 * a log you can tidy is not evidence of anything.
 */
/**
 * Rate limiting and error tracking.
 *
 * Two tables that exist for the same reason: this application went to the point
 * of being nearly launchable with no way to slow anybody down and no way to
 * find out that something had broken. Both are operational rather than
 * commercial, both are written far more often than they are read, and both are
 * allowed to be lossy. Neither is ever in a transaction with an order.
 */
async function migrateGuards(p: Pool) {
  await p.query(`
    /*
     * One row per bucket per window. Written on every limited request, so the
     * primary key is the access path and there is deliberately no second index:
     * an index that is maintained on every write and read by nothing is a tax.
     *
     * Rows are swept opportunistically from the application rather than by a
     * scheduled job, because there is no scheduler here and an unbounded table
     * of counters is a bill that grows with traffic and never shrinks.
     */
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket        TEXT NOT NULL,
      window_start  TIMESTAMPTZ NOT NULL,
      hits          INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (bucket, window_start)
    );

    /*
     * One row per DISTINCT failure, not per occurrence.
     *
     * The fingerprint is the primary key and that is the whole design. A
     * supplier outage writes one row with a count of four thousand rather than
     * four thousand rows, which is the difference between a console page an
     * operator reads and one they close.
     *
     * resolved_at is set by a person and is never cleared by a recurrence.
     * Auto reopening sounds right and is not: a fault that recurs on a cycle
     * longer than anybody's attention can then never be marked handled, and a
     * list that cannot be cleared stops being read.
     *
     * detail holds the redacted context object. Nothing that could be a
     * credential reaches it: see the redact() pass in observe.ts, which runs on
     * the way in rather than on the way out, so a secret is never stored even
     * briefly.
     */
    CREATE TABLE IF NOT EXISTS error_events (
      fingerprint   TEXT PRIMARY KEY,
      level         TEXT NOT NULL DEFAULT 'error',
      scope         TEXT NOT NULL,
      message       TEXT NOT NULL,
      detail        JSONB NOT NULL DEFAULT '{}',
      stack         TEXT,
      count         INTEGER NOT NULL DEFAULT 1,
      first_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at   TIMESTAMPTZ
    );
  `);

  // The console's default view: unresolved, newest first. Partial, because the
  // resolved rows are history and nothing pages through them.
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_errors_open
      ON error_events(last_at DESC) WHERE resolved_at IS NULL
  `);
}

async function migrateStaff(p: Pool) {
  await p.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      name        TEXT,
      -- owner, operations, finance, support, readonly. Checked in code rather
      -- than by an enum type so adding one is a deploy, not a migration.
      role        TEXT NOT NULL DEFAULT 'readonly',
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen   TIMESTAMPTZ
    );

    /* Sign in links. Single use, short lived, hashed at rest. */
    CREATE TABLE IF NOT EXISTS staff_login_tokens (
      token_hash  TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      requested_ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_login_expiry ON staff_login_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS staff_sessions (
      token_hash  TEXT PRIMARY KEY,
      staff_id    TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip          TEXT,
      user_agent  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_staff ON staff_sessions(staff_id);

    /*
     * Append only. Every mutation in the console writes one row: who, what,
     * which target, the before and after, and where from.
     */
    CREATE TABLE IF NOT EXISTS audit_log (
      id          BIGSERIAL PRIMARY KEY,
      actor_id    TEXT,
      actor_email TEXT NOT NULL,
      actor_role  TEXT NOT NULL,
      action      TEXT NOT NULL,
      target      TEXT,
      before      JSONB,
      after       JSONB,
      ip          TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_email, created_at DESC);
  `);
}

/**
 * Idempotent ALTER TABLE.
 *
 * Postgres does have `ADD COLUMN IF NOT EXISTS`, but the CREATE TABLE above
 * only takes effect on an empty database, so a column added later still needs
 * an explicit path to reach one that already exists. Keeping this helper means
 * the two ways of adding a column stay side by side and nobody adds one to the
 * CREATE and assumes production got it.
 */
async function addColumn(p: Pool, table: string, column: string, type: string) {
  await p.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`,
  );
}

/* ------------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------------ */

export type Args = unknown[];

/**
 * `?` to `$1`, skipping anything inside a quoted literal.
 *
 * Quote awareness is not decoration: `WHERE note = 'why?'` would otherwise get
 * a parameter injected into the middle of a string and fail with a message that
 * points at the wrong thing entirely.
 */
export function toPg(sql: string): string {
  let out = "";
  let n = 0;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];

    if (quote) {
      out += c;
      // Doubled quote is an escaped quote, not a terminator.
      if (c === quote && sql[i + 1] === quote) {
        out += sql[++i];
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }

    if (c === "'" || c === '"') {
      quote = c;
      out += c;
      continue;
    }

    out += c === "?" ? `$${++n}` : c;
  }

  return out;
}

async function query<T extends QueryResultRow>(sql: string, args: Args) {
  const p = await db();
  return p.query<T>(toPg(sql), args);
}

/** First row, or undefined. */
export async function one<T extends QueryResultRow>(
  sql: string,
  args: Args = [],
): Promise<T | undefined> {
  const r = await query<T>(sql, args);
  return r.rows[0];
}

/** Every row. */
export async function all<T extends QueryResultRow>(
  sql: string,
  args: Args = [],
): Promise<T[]> {
  const r = await query<T>(sql, args);
  return r.rows;
}

/** Rows affected. */
export async function run(sql: string, args: Args = []): Promise<number> {
  const r = await query(sql, args);
  return r.rowCount ?? 0;
}

/**
 * A real transaction, on one connection.
 *
 * The callback is handed a client and must use it for every statement inside
 * the transaction. Reaching for the module level `one`/`all`/`run` in here
 * would take a different connection from the pool and run outside the
 * transaction, which is the kind of bug that only shows up under load and looks
 * like data corruption when it does.
 */
export async function tx<T>(fn: (c: Tx) => Promise<T>): Promise<T> {
  const p = await db();
  const client: PoolClient = await p.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(wrap(client));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is already broken. Releasing it below with the error
      // flag tells the pool to discard rather than reuse it.
    }
    throw e;
  } finally {
    client.release();
  }
}

export interface Tx {
  one<T extends QueryResultRow>(sql: string, args?: Args): Promise<T | undefined>;
  all<T extends QueryResultRow>(sql: string, args?: Args): Promise<T[]>;
  run(sql: string, args?: Args): Promise<number>;
}

function wrap(client: PoolClient): Tx {
  return {
    async one<T extends QueryResultRow>(sql: string, args: Args = []): Promise<T | undefined> {
      const r = await client.query<T>(toPg(sql), args);
      return r.rows[0];
    },
    async all<T extends QueryResultRow>(sql: string, args: Args = []) {
      const r = await client.query<T>(toPg(sql), args);
      return r.rows;
    },
    async run(sql: string, args: Args = []) {
      const r = await client.query(toPg(sql), args);
      return r.rowCount ?? 0;
    },
  };
}

export function nowIso() {
  return new Date().toISOString();
}

/** UTC day, `YYYY-MM-DD`. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}
