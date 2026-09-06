/**
 * Put the local database into a state the console can be walked through.
 *
 * Not a test. This exists so a person, or a browser driving one, can see every
 * screen with realistic data on it: a fulfilled order, a stuck one, a partial
 * one, a refunded one, a live SKU and a recorded failure. Screens that have only
 * ever been seen empty are screens whose bugs are still in them.
 */
import crypto from "node:crypto";

import { run } from "../src/lib/db";
import { registerFulfiller, __resetFulfillers, setItemActive, upsertSource, type Fulfiller } from "../src/lib/platform";
import { createDraft, markPaid } from "../src/lib/orders";
import { fulfilOrder } from "../src/lib/fulfil";
import { capture } from "../src/lib/observe";

let failNext = false;
/** When set, the fake refuses any line whose external id contains this. */
let failSku: string | null = null;

/*
 * Registered under its own id rather than shadowing "esimaccess".
 *
 * fulfilOrder registers the real fulfillers on its first call, and the registry
 * is a map, so a fake sharing an id gets silently replaced by the real one on
 * the first order. The symptom was a fixture that produced four failed orders
 * and a confusing error about an unknown plan id. Give the fake its own id and
 * point the catalogue source at it instead.
 */
const fake: Fulfiller = {
  id: "fixture",
  category: "esim",
  displayName: "eSIM Access (local fixture)",
  capabilities: { topUp: true, usage: true, cancelWindowMinutes: null },
  async quote() {
    return { available: true, costAmount: 4.7, costCurrency: "USD" };
  },
  async fulfil({ externalId, userRef }) {
    if (failNext || (failSku && externalId.includes(failSku))) {
      throw new Error("Supplier rejected the order: prepaid balance exhausted");
    }
    const iccid = "8988" + crypto.randomBytes(8).toString("hex").replace(/\D/g, "").padEnd(15, "7").slice(0, 15);
    await run(
      `INSERT INTO esims (iccid, user_id, supplier, supplier_order, activation_code, smdp_address, matching_id)
       VALUES (?,?,?,?,?,?,?) ON CONFLICT (iccid) DO NOTHING`,
      [iccid, userRef, "esimaccess", `ord_${externalId}`,
       `LPA:1$rsp.example-smdp.invalid$${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
       "rsp.example-smdp.invalid", crypto.randomBytes(6).toString("hex").toUpperCase()],
    );
    return {
      externalRef: iccid,
      supplierRef: `sup_${crypto.randomBytes(4).toString("hex")}`,
      costAmount: 4.7,
      costCurrency: "USD",
      label: `eSIM ${iccid.slice(-6)}`,
      payload: { iccid, installPath: `/esims/${iccid}` },
    };
  },
  async status() {
    return { status: "issued" as const };
  },
};

async function main() {
  __resetFulfillers();
  registerFulfiller(fake);

  const uid = "u_fixture";
  await run(
    `INSERT INTO users (id, country, home_country, email, destination)
     VALUES (?, 'AU', 'AU', 'fixture@example.com', 'JP')
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [uid],
  );

  // Start clean so repeated runs do not pile up.
  await run(`DELETE FROM entitlements WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)`, [uid]);
  await run(`DELETE FROM orders WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM esims WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM idempotency_keys WHERE scope = 'fulfil'`);

  const sku = "esim.jp.10gb-30d.home";
  const sku2 = "esim.jp.3gb-15d.home";

  for (const s of [sku, sku2]) {
    await upsertSource({
      sku: s, fulfillerId: "fixture", externalId: `FIXTURE_${s}`,
      costAmount: 4.7, costCurrency: "USD", priority: 1, enabled: true,
    });
  }
  console.log(await setItemActive(sku, true));
  console.log(await setItemActive(sku2, true));

  // 1. A clean, fulfilled order.
  const a = await createDraft(uid, [{ sku }]);
  if (a.ok) {
    await markPaid(a.order.id, "pi_fixture_a", { currency: "JPY", amount: 1980 });
    await fulfilOrder(a.order.id);
    console.log("fulfilled", a.order.id);
  }

  // 2. A paid order whose supplier refused, so it sits in the queue.
  failNext = true;
  const b = await createDraft(uid, [{ sku }]);
  if (b.ok) {
    await markPaid(b.order.id, "pi_fixture_b");
    await fulfilOrder(b.order.id);
    console.log("stuck", b.order.id);
  }

  // 3. Two lines, one through and one not.
  const c = await createDraft(uid, [{ sku }, { sku: sku2 }]);
  if (c.ok) {
    await markPaid(c.order.id, "pi_fixture_c");
    /*
     * One line through, one not.
     *
     * Done by making the fake refuse one specific SKU rather than by cancelling
     * and un cancelling rows around a retry. The first attempt at this did the
     * latter and quietly reset the line that had already succeeded back to
     * pending, which is a good illustration of why the real code never edits an
     * item's status to arrange for something.
     */
    failNext = false;
    failSku = sku2;
    await fulfilOrder(c.order.id);
    failSku = null;
    console.log("partial", c.order.id);
  }

  // 4. A draft nobody paid for.
  const d = await createDraft(uid, [{ sku }]);
  console.log("draft", d.ok ? d.order.id : d.reason);

  // 5. Something on the health page.
  await capture("supplier.esimaccess", new Error("Connection reset while listing plans"), {
    endpoint: "/open/package/list",
    attempt: 3,
  });

  console.log("\nFixture ready.");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
