import fs from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client, type InValue } from "@libsql/client";

/**
 * Database access.
 *
 * ## Why this moved off better-sqlite3
 *
 * The previous version wrote a SQLite file to local disk. That is the right
 * database for this product until roughly your hundred thousandth user, and it
 * was the right choice until the moment it had to run on Vercel.
 *
 * Vercel's filesystem is ephemeral. Every deploy and every cold start discards
 * it. Users are identified by a signed cookie and no email, so a wiped database
 * does not produce a support ticket, it produces an account nobody can recover
 * and a balance that simply stops existing. That is the single worst failure
 * mode this product has, and it was guaranteed to happen on the first deploy.
 *
 * libSQL is SQLite. Same engine, same SQL, same semantics, with a remote
 * protocol bolted on. The migration is a driver swap rather than a rewrite, and
 * critically it uses ONE driver for both environments:
 *
 *   local dev      url: "file:.data/nesim.db"     no network, no account
 *   production     url: "libsql://...turso.io"    replicated, durable
 *
 * So there is no second code path that only runs in production and therefore
 * only breaks in production. That property is worth more than the convenience.
 *
 * ## The one real cost
 *
 * better-sqlite3 is synchronous; a remote database cannot be. Every query in
 * this file and every caller is now async. That was a mechanical change but not
 * a free one, and the place it bites is transactions: see `tx()` below.
 */

let client: Client | null = null;
let ready: Promise<Client> | null = null;

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;

  if (!url) {
    // Local file. Same engine, no account, no network. `file:` is a first class
    // libSQL url, which is what lets development and production share a driver.
    const path = process.env.DATABASE_PATH ?? ".data/nesim.db";

    // libSQL will not create the parent directory, and the failure it gives is
    // `ConnectionFailed(... 14)`, which is SQLITE_CANTOPEN and says nothing
    // about a missing folder. better-sqlite3 used to do this for us, so it went
    // missing in the driver swap and only reappeared on a clean checkout.
    fs.mkdirSync(dirname(path), { recursive: true });

    return createClient({ url: `file:${path}` });
  }

  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!authToken) {
    // Fail loudly at boot rather than on the first write. A missing token
    // surfaces as an authorisation error deep inside a request handler, which
    // reads like a bug in the handler.
    throw new Error(
      "TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is not. " +
        "Both are required, or neither: with neither, the app uses a local file."
    );
  }

  return createClient({ url, authToken });
}

/**
 * The client, with migrations applied exactly once.
 *
 * The promise is cached rather than the client, because several requests can
 * arrive during the same cold start and each would otherwise run the migration
 * concurrently. `CREATE TABLE IF NOT EXISTS` tolerates that; `ALTER TABLE ADD
 * COLUMN` does not, and would throw a duplicate column error on whichever
 * request lost the race.
 */
export function db(): Promise<Client> {
  if (client) return Promise.resolve(client);
  if (ready) return ready;

  ready = (async () => {
    const c = makeClient();
    await migrate(c);
    client = c;
    return c;
  })();

  // A failed migration must not poison the cache forever, or every subsequent
  // request in this instance fails with a stale error from a transient blip.
  ready.catch(() => {
    ready = null;
  });

  return ready;
}

async function migrate(d: Client) {
  // executeMultiple runs a script. Statement by statement is not required here
  // and this keeps the schema readable as one block.
  await d.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          TEXT UNIQUE,
      created_at     TEXT NOT NULL,
      -- Where the handset is RIGHT NOW. Sets the floor on ad value. Moves when
      -- they fly.
      country        TEXT NOT NULL DEFAULT 'AU',
      -- Where they signed up. Proxy for the audience an advertiser thinks they
      -- are buying, and therefore the ceiling on eCPM. Set once, never updated.
      -- If it moved with the user it would be worthless as a home market
      -- signal, and it would become spoofable by travelling.
      home_country   TEXT NOT NULL DEFAULT 'AU',
      -- Where the data will be USED. Chosen by the user, changeable any time.
      -- Distinct from the country column on purpose: the whole point is that
      -- someone sitting in Sydney can earn against Tokyo prices in the week
      -- before they fly. NULL means they have not been through the picker yet.
      destination    TEXT,
      -- Device scoped anti abuse. One free allowance per device, not per email,
      -- because email is free and devices are not.
      device_hash    TEXT,
      banned_at      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_hash);

    /*
     * Append only. Positive entries grant MB, negative entries consume them.
     * Never UPDATE. Never DELETE. To reverse a grant, insert its negation with
     * reason='reversal' and the original id in ref.
     *
     * This is not fastidiousness. The day somebody finds a way to farm ad
     * rewards you will need to prove exactly what was granted, when, from which
     * impression, and reverse precisely that. A mutable users.balance_mb column
     * cannot answer any of those questions.
     */
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL REFERENCES users(id),
      delta_mb       INTEGER NOT NULL,
      reason         TEXT NOT NULL,
      ref            TEXT,
      -- Economics captured AT GRANT TIME. Rates move; without this you can
      -- never reconstruct whether a historical cohort was profitable.
      revenue_usd    REAL NOT NULL DEFAULT 0,
      cost_usd       REAL NOT NULL DEFAULT 0,
      region         TEXT,
      created_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger(user_id, created_at);
    /* Exactly once semantics for ad callbacks. AdMob retries SSV on timeout. */
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_ad_txn
      ON credit_ledger(ref) WHERE reason = 'ad_reward';

    CREATE TABLE IF NOT EXISTS esims (
      iccid            TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id),
      supplier         TEXT NOT NULL,
      supplier_order   TEXT,
      activation_code  TEXT NOT NULL,
      smdp_address     TEXT NOT NULL,
      matching_id      TEXT NOT NULL,
      is_free_tier     INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL,
      installed_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_esims_user ON esims(user_id);

    CREATE TABLE IF NOT EXISTS orders (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id),
      plan_id        TEXT NOT NULL,
      iccid          TEXT,
      kind           TEXT NOT NULL,
      cost_usd       REAL NOT NULL DEFAULT 0,
      revenue_usd    REAL NOT NULL DEFAULT 0,
      status         TEXT NOT NULL,
      created_at     TEXT NOT NULL
    );

    /*
     * Global spend guard. One row per UTC day. This is what stops a viral
     * moment becoming an unpayable supplier invoice: every grant checks it, and
     * the free tier degrades to a waitlist rather than overspending.
     */
    CREATE TABLE IF NOT EXISTS daily_budget (
      day            TEXT PRIMARY KEY,
      spent_usd      REAL NOT NULL DEFAULT 0,
      cap_usd        REAL NOT NULL
    );
  `);

  await addColumn(d, "users", "destination", "TEXT");
}

/**
 * Idempotent ALTER TABLE.
 *
 * SQLite has no `ADD COLUMN IF NOT EXISTS`, and the CREATE TABLE above only
 * takes effect on a fresh database. Without this, a column added later never
 * reaches a database that already exists, and the failure is silent until a
 * query references the missing column in production.
 */
async function addColumn(d: Client, table: string, column: string, type: string) {
  const info = await d.execute(`PRAGMA table_info(${table})`);
  if (info.rows.some((r) => r.name === column)) return;
  await d.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

/* ------------------------------------------------------------------------ *
 * Query helpers
 *
 * libSQL returns rows as objects keyed by column name, which is what we want,
 * but it types values as `InValue` and returns SQLite INTEGERs as `bigint`
 * whenever they exceed the safe integer range. `SUM(delta_mb)` is exactly such
 * a column. A bigint reaching JSON.stringify throws at runtime, so numbers are
 * coerced at the boundary rather than being trusted to behave.
 * ------------------------------------------------------------------------ */

export type Args = InValue[];

function coerce<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out as T;
}

/** First row, or undefined. */
export async function one<T>(sql: string, args: Args = []): Promise<T | undefined> {
  const d = await db();
  const res = await d.execute({ sql, args });
  const row = res.rows[0];
  return row ? coerce<T>(row as unknown as Record<string, unknown>) : undefined;
}

/** Every row. */
export async function all<T>(sql: string, args: Args = []): Promise<T[]> {
  const d = await db();
  const res = await d.execute({ sql, args });
  return res.rows.map((r) => coerce<T>(r as unknown as Record<string, unknown>));
}

/** A write. Returns the number of rows actually changed. */
export async function run(sql: string, args: Args = []): Promise<number> {
  const d = await db();
  const res = await d.execute({ sql, args });
  return Number(res.rowsAffected);
}

/**
 * An interactive transaction.
 *
 * Rolls back on any thrown error, which is the behaviour every caller wants and
 * none of them should have to remember to write.
 *
 * Keep the body short. An interactive transaction holds a connection open for
 * its whole duration, so a network call inside one blocks a database connection
 * on an HTTP round trip. Provisioning an eSIM from inside a transaction is the
 * obvious mistake here: read what you need, commit, then talk to the supplier.
 */
export async function tx<T>(
  fn: (t: {
    one: <R>(sql: string, args?: Args) => Promise<R | undefined>;
    all: <R>(sql: string, args?: Args) => Promise<R[]>;
    run: (sql: string, args?: Args) => Promise<number>;
  }) => Promise<T>
): Promise<T> {
  const d = await db();
  const t = await d.transaction("write");
  try {
    const scoped = {
      one: async <R,>(sql: string, args: Args = []) => {
        const r = await t.execute({ sql, args });
        const row = r.rows[0];
        return row ? coerce<R>(row as unknown as Record<string, unknown>) : undefined;
      },
      all: async <R,>(sql: string, args: Args = []) => {
        const r = await t.execute({ sql, args });
        return r.rows.map((x) => coerce<R>(x as unknown as Record<string, unknown>));
      },
      run: async (sql: string, args: Args = []) => {
        const r = await t.execute({ sql, args });
        return Number(r.rowsAffected);
      },
    };
    const out = await fn(scoped);
    await t.commit();
    return out;
  } catch (e) {
    await t.rollback().catch(() => {
      // Rollback can itself fail if the connection dropped. The original error
      // is the one worth reporting; swallowing this one keeps the stack honest.
    });
    throw e;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
