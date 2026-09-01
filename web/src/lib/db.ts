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

function getPool(): Pool {
  if (pool) return pool;

  pool = new Pool({
    connectionString: connectionString(),
    // Supabase terminates TLS with a certificate this client cannot chain to a
    // root it ships. The connection is still encrypted; what is skipped is
    // verification of the certificate authority. Acceptable to Supabase's own
    // documented setup, and the alternative is bundling their CA and rotating
    // it by hand.
    ssl: { rejectUnauthorized: false },
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

    /*
     * Append only. Never UPDATE, never DELETE. To reverse an entry, insert its
     * negation with reason='reversal' and the original id in ref.
     *
     * This is not fastidiousness. The day somebody finds a way to farm this you
     * will need to prove exactly what was granted, when, and reverse precisely
     * that. A mutable balance column cannot answer any of those questions.
     */
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id             BIGSERIAL PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id),
      delta_mb       INTEGER NOT NULL,
      reason         TEXT NOT NULL,
      ref            TEXT,
      -- Economics captured AT GRANT TIME. Rates move; without this you can
      -- never reconstruct whether a historical cohort was profitable.
      revenue_usd    NUMERIC(12,6) NOT NULL DEFAULT 0,
      cost_usd       NUMERIC(12,6) NOT NULL DEFAULT 0,
      region         TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger(user_id, created_at);

    CREATE TABLE IF NOT EXISTS esims (
      iccid            TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id),
      supplier         TEXT NOT NULL,
      supplier_order   TEXT,
      activation_code  TEXT NOT NULL,
      smdp_address     TEXT NOT NULL,
      matching_id      TEXT NOT NULL,
      is_free_tier     BOOLEAN NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      installed_at     TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_esims_user ON esims(user_id);

    CREATE TABLE IF NOT EXISTS orders (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id),
      plan_id        TEXT NOT NULL,
      iccid          TEXT,
      kind           TEXT NOT NULL,
      -- What we paid the supplier, recorded ON THE ORDER rather than looked up
      -- later. The rate on the day is a fact about this order; recomputing
      -- margin from today's rate card makes last month's numbers move, and a
      -- dashboard whose history changes is one nobody trusts twice.
      cost_usd       NUMERIC(12,6) NOT NULL DEFAULT 0,
      revenue_usd    NUMERIC(12,6) NOT NULL DEFAULT 0,
      status         TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS daily_budget (
      day            DATE PRIMARY KEY,
      spent_usd      NUMERIC(12,6) NOT NULL DEFAULT 0,
      cap_usd        NUMERIC(12,6) NOT NULL
    );
  `);

  // Exactly once semantics for ad callbacks, expressed as a partial unique
  // index. Postgres supports these directly; the SQLite version used the same
  // shape, so this is a straight port rather than a redesign.
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_ad_txn
      ON credit_ledger(ref) WHERE reason = 'ad_reward'
  `);

  await migrateDiscounts(p);

  await addColumn(p, "users", "destination", "TEXT");
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

/** UTC day, as `daily_budget.day` stores it. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}
