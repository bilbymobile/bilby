/**
 * The money path, end to end, against a real Postgres.
 *
 * Run with:
 *   DATABASE_URL=postgresql://... npx tsx scripts/money.test.ts
 *
 * Stripe itself is not called. What is tested is everything on our side of it:
 * that a draft is priced from the catalogue and never from the request, that a
 * redelivered webhook cannot pay an order twice, that a concurrent double
 * fulfilment buys exactly one profile, and that a failure leaves an order in a
 * state a person can act on.
 *
 * The fulfiller is a fake that counts its calls, which is the only way to prove
 * the property that actually matters: one payment, one purchase. A real
 * supplier cannot be asked to demonstrate that twenty times in a row.
 */

import crypto from "node:crypto";

import { all, one, run } from "../src/lib/db";
import {
  registerFulfiller,
  __resetFulfillers,
  upsertItem,
  setPrice,
  upsertSource,
  setItemActive,
  entitlementsFor,
  type Fulfiller,
} from "../src/lib/platform";
import { createDraft, markPaid, getOrder, reconcileOrderStatus } from "../src/lib/orders";
import { fulfilOrder, retryItem, stuckItems } from "../src/lib/fulfil";
import { toMinorUnits, fromMinorUnits } from "../src/lib/stripe";

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

/* ---- A fulfiller that counts, and can be told to fail -------------------- */

let calls = 0;
let mode: "ok" | "throw" = "ok";

const counting: Fulfiller = {
  id: "test",
  category: "esim",
  displayName: "Counting test fulfiller",
  capabilities: { topUp: false, usage: false, cancelWindowMinutes: null },
  async quote() {
    return { available: true, costAmount: 1, costCurrency: "USD" };
  },
  async fulfil({ externalId }) {
    calls++;
    if (mode === "throw") throw new Error("supplier wallet is empty");
    const ref = `iccid_${calls}_${crypto.randomBytes(3).toString("hex")}`;
    return {
      externalRef: ref,
      supplierRef: `sup_${externalId}_${calls}`,
      costAmount: 1.23,
      costCurrency: "USD",
      label: `Test plan ${ref.slice(-4)}`,
      payload: { note: "test" },
    };
  },
  async status() {
    return { status: "issued" as const };
  },
};

async function main() {
  __resetFulfillers();
  registerFulfiller(counting);

  const uid = `u_${crypto.randomBytes(6).toString("hex")}`;
  await run(`INSERT INTO users (id, country, home_country) VALUES (?, 'AU', 'AU')`, [uid]);

  const sku = `test.sku.${crypto.randomBytes(4).toString("hex")}`;
  await upsertItem({
    sku,
    category: "esim",
    title: "Test plan",
    active: false,
    attributes: { country: "JP", dataMb: 1024, days: 7, routing: "home" },
  });
  await setPrice(sku, "AUD", 19.95, true);

  console.log("\nActivation guards\n");

  const noSource = await setItemActive(sku, true);
  check("cannot activate without a supplier", !noSource.ok, noSource);

  await upsertSource({
    sku,
    fulfillerId: "test",
    externalId: "PKG123",
    costAmount: 1.23,
    costCurrency: "USD",
    priority: 10,
    enabled: true,
  });

  const activated = await setItemActive(sku, true);
  check("activates once it has a price and a supplier", activated.ok, activated);

  console.log("\nDraft orders\n");

  const off = `${sku}.off`;
  await upsertItem({ sku: off, category: "esim", title: "Off", active: false });
  await setPrice(off, "AUD", 5, true);
  const offDraft = await createDraft(uid, [{ sku: off }]);
  check("an inactive SKU cannot be bought", !offDraft.ok && offDraft.reason === "not_for_sale", offDraft);

  const missing = await createDraft(uid, [{ sku: "does.not.exist" }]);
  check("an unknown SKU is refused the same way", !missing.ok && missing.reason === "not_for_sale", missing);

  const empty = await createDraft(uid, []);
  check("an empty cart is refused", !empty.ok, empty);

  const draft = await createDraft(uid, [{ sku }]);
  if (!draft.ok) throw new Error(`draft failed: ${draft.reason}`);

  check("price comes from the catalogue", draft.order.total === 19.95, draft.order.total);
  check("GST is one eleventh, to the cent", draft.order.tax === 1.81, draft.order.tax);
  check("one line becomes one order item", draft.order.items.length === 1);

  const fresh = await getOrder(draft.order.id);
  check("the order starts as a draft", fresh?.status === "draft", fresh?.status);
  check("its item starts pending", fresh?.items[0].status === "pending");

  console.log("\nA draft is not fulfillable\n");

  calls = 0;
  const refused = await fulfilOrder(draft.order.id);
  check("fulfilling a draft does nothing", refused.fulfilled === 0 && calls === 0, { refused, calls });

  console.log("\nPayment\n");

  const paid = await markPaid(draft.order.id, "pi_test_1", {
    currency: "JPY",
    amount: 2100,
  });
  check("the first webhook marks it paid", paid);

  const again = await markPaid(draft.order.id, "pi_test_1");
  check("a redelivered webhook does not pay it twice", !again);

  const afterPay = await getOrder(draft.order.id);
  check("presentment currency is recorded", afterPay?.presentmentCurrency === "JPY", afterPay?.presentmentCurrency);
  check("presentment amount is recorded", afterPay?.presentmentAmount === 2100, afterPay?.presentmentAmount);
  check("settlement amount is untouched", afterPay?.total === 19.95, afterPay?.total);

  console.log("\nFulfilment\n");

  calls = 0;
  const done = await fulfilOrder(draft.order.id);
  check("one item, one supplier call", calls === 1, calls);
  check("it reports one fulfilled", done.fulfilled === 1, done);

  const filled = await getOrder(draft.order.id);
  check("the order is fulfilled", filled?.status === "fulfilled", filled?.status);
  check("the item carries the supplier reference", !!filled?.items[0].supplierRef);
  check("the real cost is recorded on the line", filled?.items[0].costAmount === 1.23, filled?.items[0].costAmount);

  const ents = await entitlementsFor(uid);
  check("an entitlement exists", ents.length === 1, ents.length);
  check("it is not eSIM shaped at this layer", ents[0]?.category === "esim" && !!ents[0]?.externalRef);

  // The property the whole design exists for.
  calls = 0;
  await fulfilOrder(draft.order.id);
  check("fulfilling an already fulfilled order calls nobody", calls === 0, calls);

  console.log("\nConcurrency: one payment, one purchase\n");

  const d2 = await createDraft(uid, [{ sku }]);
  if (!d2.ok) throw new Error("second draft failed");
  await markPaid(d2.order.id, "pi_test_2");

  calls = 0;
  await Promise.all(Array.from({ length: 8 }, () => fulfilOrder(d2.order.id)));
  check("eight concurrent fulfilments buy exactly one profile", calls === 1, calls);

  const ents2 = await entitlementsFor(uid);
  check("and grant exactly one more entitlement", ents2.length === 2, ents2.length);

  console.log("\nFailure, and recovery\n");

  const d3 = await createDraft(uid, [{ sku }]);
  if (!d3.ok) throw new Error("third draft failed");
  await markPaid(d3.order.id, "pi_test_3");

  mode = "throw";
  calls = 0;
  const bad = await fulfilOrder(d3.order.id);
  check("a supplier failure is caught, not thrown", bad.failed === 1, bad);

  const failedOrder = await getOrder(d3.order.id);
  check("the order stays paid rather than fulfilled", failedOrder?.status === "paid", failedOrder?.status);
  check("the item is marked failed", failedOrder?.items[0].status === "failed");
  check("with the reason on it", (failedOrder?.items[0].lastError ?? "").includes("wallet"), failedOrder?.items[0].lastError);
  check("and an attempt counted", failedOrder?.items[0].attempts === 1, failedOrder?.items[0].attempts);

  const stuck = await stuckItems();
  check("it appears in the operations queue", stuck.some((s) => s.order_id === d3.order.id));

  // A failed item is NOT retried automatically. That is the design.
  calls = 0;
  await fulfilOrder(d3.order.id);
  check("a second automatic pass does not call the supplier again", calls === 0, calls);

  mode = "ok";
  calls = 0;
  const retried = await retryItem(failedOrder!.items[0].id);
  check("an operator retry does call the supplier", retried && calls === 1, { retried, calls });

  const recovered = await getOrder(d3.order.id);
  check("and the order recovers to fulfilled", recovered?.status === "fulfilled", recovered?.status);

  console.log("\nPartial orders\n");

  const sku2 = `${sku}.two`;
  await upsertItem({ sku: sku2, category: "esim", title: "Second plan", active: false });
  await setPrice(sku2, "AUD", 9.95, true);
  await upsertSource({
    sku: sku2, fulfillerId: "test", externalId: "PKG456",
    costAmount: 0.9, costCurrency: "USD", priority: 10, enabled: true,
  });
  await setItemActive(sku2, true);

  const d4 = await createDraft(uid, [{ sku }, { sku: sku2 }]);
  if (!d4.ok) throw new Error("fourth draft failed");
  check("two lines add up", d4.order.total === 29.9, d4.order.total);
  await markPaid(d4.order.id, "pi_test_4");

  // First line succeeds, second throws.
  let n = 0;
  const flaky: Fulfiller = {
    ...counting,
    async fulfil(args) {
      n++;
      if (n === 2) throw new Error("second line is unavailable");
      return counting.fulfil(args);
    },
  };
  __resetFulfillers();
  registerFulfiller(flaky);

  const mixed = await fulfilOrder(d4.order.id);
  check("one line delivered, one failed", mixed.fulfilled === 1 && mixed.failed === 1, mixed);

  const partial = await getOrder(d4.order.id);
  check("the order is partial, not fulfilled", partial?.status === "partial", partial?.status);

  __resetFulfillers();
  registerFulfiller(counting);

  console.log("\nMinor units\n");

  check("AUD 19.95 is 1995 cents", toMinorUnits(19.95, "AUD") === 1995);
  check("JPY 2100 is 2100 yen, not 210000", toMinorUnits(2100, "JPY") === 2100);
  check("cents round trip", fromMinorUnits(1995, "AUD") === 19.95);
  check("yen round trip", fromMinorUnits(2100, "JPY") === 2100);
  check("half cents round rather than truncate", toMinorUnits(0.005, "AUD") === 1, toMinorUnits(0.005, "AUD"));

  console.log("\nStatus never walks backwards\n");

  await run(`UPDATE orders SET status = 'refunded' WHERE id = ?`, [draft.order.id]);
  const after = await reconcileOrderStatus(draft.order.id);
  const stillRefunded = await getOrder(draft.order.id);
  check("a refunded order is not reset to fulfilled", stillRefunded?.status === "refunded", {
    computed: after,
    stored: stillRefunded?.status,
  });

  // Clean up so repeated runs stay honest.
  await run(`DELETE FROM entitlements WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)`, [uid]);
  await run(`DELETE FROM orders WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM esims WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM users WHERE id = ?`, [uid]);
  await run(`DELETE FROM catalog_sources WHERE sku LIKE 'test.sku.%'`);
  await run(`DELETE FROM catalog_prices  WHERE sku LIKE 'test.sku.%'`);
  await run(`DELETE FROM catalog_items   WHERE sku LIKE 'test.sku.%'`);
  await run(`DELETE FROM idempotency_keys WHERE scope = 'fulfil'`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

main().then(
  () => process.exit(failed === 0 ? 0 : 1),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
