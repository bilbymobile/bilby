/**
 * Does the schema build itself on a database that has never seen it?
 *
 * Every other check in this repository runs against a database that has been
 * migrated before, which hides the one bug that matters here: a statement that
 * only works because an earlier version of the schema already existed. A
 * production database is virgin exactly once, and the first request to touch it
 * is the one that must not fail.
 *
 * Run against an EMPTY database:
 *   DATABASE_URL=postgresql://.../virgin npx tsx scripts/firstrun.test.ts
 */
import { all, one } from "../src/lib/db";

const EXPECTED = [
  "users", "esims", "orders", "order_items", "entitlements",
  "catalog_items", "catalog_prices", "catalog_sources",
  "idempotency_keys", "rate_limits", "error_events",
  "discount_codes", "discount_redemptions",
  "staff", "staff_login_tokens", "staff_sessions", "audit_log",
];

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`, detail ?? ""); }
}

async function main() {
  // The very first query is what triggers migrate(). If this throws, the first
  // customer request to production throws.
  const tables = await all<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const have = new Set(tables.map((t) => t.table_name));

  console.log("\nFirst run, empty database\n");
  for (const t of EXPECTED) check(`${t} exists`, have.has(t));

  // No extension should be required. A CREATE EXTENSION on a managed Postgres
  // can need privileges the connection role does not have, and it would fail on
  // the first request rather than in a migration nobody ran.
  const exts = await all<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql')`,
  );
  check("needs no extension of its own", exts.length === 0, exts.map((e) => e.extname));

  // The partial unique indexes are the ones carrying real invariants, so their
  // absence is a silent correctness failure rather than a crash.
  const idx = await all<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const names = new Set(idx.map((i) => i.indexname));
  for (const i of ["idx_price_default", "idx_ent_item", "idx_items_stuck", "idx_errors_open"]) {
    check(`${i} created`, names.has(i));
  }

  // Running it twice must be a no op. Serverless starts many instances at once
  // and every one of them runs migrate() on its first request.
  const before = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM information_schema.tables WHERE table_schema='public'`,
  );
  const { db } = await import("../src/lib/db");
  await db();
  const after = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM information_schema.tables WHERE table_schema='public'`,
  );
  check("a second migration changes nothing", before?.n === after?.n, { before: before?.n, after: after?.n });

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

main().then(() => process.exit(failed === 0 ? 0 : 1), (e) => { console.error(e); process.exit(1); });
