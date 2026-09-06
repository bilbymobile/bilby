/**
 * Verification for the two guards, against a real Postgres.
 *
 * Run with:
 *   DATABASE_URL=postgresql://... npx tsx scripts/guards.test.ts
 *
 * Not a unit test suite. Everything interesting about a rate limiter is
 * concurrency and time, and everything interesting about an error store is what
 * happens on the four thousandth identical failure. Neither is observable
 * against a mock, so this talks to a real database or it proves nothing.
 */

import { all, one, run } from "../src/lib/db";
import { consume, LIMITS } from "../src/lib/limits";
import { capture, warn, recentErrors, resolveError, openErrorCount, redact } from "../src/lib/observe";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, detail === undefined ? "" : detail);
  }
}

async function main() {
  console.log("\nSchema\n");

  const tables = await all<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const names = new Set(tables.map((t) => t.table_name));

  check("rate_limits exists", names.has("rate_limits"));
  check("error_events exists", names.has("error_events"));
  check("credit_ledger is gone", !names.has("credit_ledger"));
  check("daily_budget is gone", !names.has("daily_budget"));

  const orderCols = await all<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'`,
  );
  const oc = new Set(orderCols.map((c) => c.column_name));
  check("orders.plan_id dropped", !oc.has("plan_id"));
  check("orders.kind dropped", !oc.has("kind"));
  check("orders.iccid dropped", !oc.has("iccid"));
  check("orders.sell_amount present", oc.has("sell_amount"));

  const esimCols = await all<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'esims'`,
  );
  check(
    "esims.is_free_tier dropped",
    !esimCols.some((c) => c.column_name === "is_free_tier"),
  );

  console.log("\nRate limiting\n");

  await run(`DELETE FROM rate_limits`);

  const subject = `test-${Date.now()}`;

  // "read" is 120 per 60s. Spend them and check the 121st is refused.
  let lastOk = true;
  for (let i = 0; i < LIMITS.read.max; i++) {
    const d = await consume("read", subject);
    if (!d.ok) lastOk = false;
  }
  check(`first ${LIMITS.read.max} allowed`, lastOk);

  const over = await consume("read", subject);
  check("the one after the limit is refused", !over.ok, over);
  check("refusal carries a retry after", over.retryAfter > 0, over.retryAfter);

  const otherSubject = await consume("read", `${subject}-other`);
  check("a different subject is unaffected", otherSubject.ok);

  // Concurrency: twenty simultaneous requests against a limit of ten must
  // allow exactly ten. This is the property an in memory counter cannot hold.
  const burstSubject = `burst-${Date.now()}`;
  const results = await Promise.all(
    Array.from({ length: 20 }, () => consume("checkout", burstSubject)),
  );
  const allowed = results.filter((r) => r.ok).length;
  check(
    `20 concurrent claims against a limit of ${LIMITS.checkout.max} allow exactly ${LIMITS.checkout.max}`,
    allowed === LIMITS.checkout.max,
    allowed,
  );

  // The bucket must be one row, not twenty.
  const rows = await one<{ n: string }>(
    `SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ?`,
    [`checkout:${burstSubject}`],
  );
  check("one row per bucket per window", Number(rows?.n) === 1, rows?.n);

  console.log("\nError tracking\n");

  await run(`DELETE FROM error_events`);

  const uniqueScope = `test.${Date.now()}`;

  // Fifty failures that differ only in an id must fold into one group.
  for (let i = 0; i < 50; i++) {
    await capture(uniqueScope, new Error(`order ord_${i} could not be fulfilled`));
  }
  const groups = await recentErrors({ limit: 50 });
  const mine = groups.filter((g) => g.scope === uniqueScope);
  check("fifty varying failures fold into one group", mine.length === 1, mine.length);
  check("the group counts all fifty", mine[0]?.count === 50, mine[0]?.count);

  // A genuinely different failure is a different group.
  await capture(uniqueScope, new Error("supplier refused the order"));
  const groups2 = (await recentErrors({ limit: 50 })).filter((g) => g.scope === uniqueScope);
  check("a different failure is a second group", groups2.length === 2, groups2.length);

  // Secrets never reach the store.
  await capture(uniqueScope, new Error("provisioning failed"), {
    activationCode: "LPA:1$rsp.example$ABC123",
    apiKey: "sk_live_do_not_store_me",
    customerEmail: "traveller@example.com",
    nested: { stripeSecretKey: "sk_test_nope" },
    harmless: "keep me",
  });
  const withDetail = (await recentErrors({ limit: 50 })).find(
    (g) => g.scope === uniqueScope && g.message.includes("provisioning failed"),
  );
  const blob = JSON.stringify(withDetail?.detail ?? {});
  check("activation code redacted", !blob.includes("ABC123"), blob);
  check("api key redacted", !blob.includes("sk_live_do_not_store_me"), blob);
  check("nested secret redacted", !blob.includes("sk_test_nope"), blob);
  check("email masked", !blob.includes("traveller@example.com"), blob);
  check("harmless field kept", blob.includes("keep me"), blob);

  // redact() on its own, including the shape it must never lose.
  const r = redact({ ok: 1, password: "hunter2", list: [{ token: "t" }] });
  check("redact masks by key at depth", JSON.stringify(r) === '{"ok":1,"password":"<redacted>","list":[{"token":"<redacted>"}]}', r);

  // Warnings are a level, not a separate store.
  await warn(uniqueScope, new Error("usage lookup timed out"));
  const warns = (await recentErrors({ limit: 50 })).filter(
    (g) => g.scope === uniqueScope && g.level === "warning",
  );
  check("warnings land in the same table at warning level", warns.length === 1, warns.length);

  // Resolving, and the rule that a recurrence must not reopen it.
  const target = mine[0]!.fingerprint;
  const beforeCount = await openErrorCount();
  check("resolve reports a change", await resolveError(target));
  check("resolve is idempotent", (await resolveError(target)) === false);
  const afterCount = await openErrorCount();
  check("open count drops by one", afterCount === beforeCount - 1, { beforeCount, afterCount });

  await capture(uniqueScope, new Error("order ord_999 could not be fulfilled"));
  const still = (await recentErrors({ includeResolved: true, limit: 50 })).find(
    (g) => g.fingerprint === target,
  );
  check("a recurrence does not reopen a resolved group", still?.resolvedAt !== null, still?.resolvedAt);
  check("but it does bump the count", (still?.count ?? 0) === 51, still?.count);

  // The default view hides resolved.
  const openOnly = await recentErrors({ limit: 50 });
  check(
    "resolved groups are hidden by default",
    !openOnly.some((g) => g.fingerprint === target),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

main().then(
  () => process.exit(failed === 0 ? 0 : 1),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
