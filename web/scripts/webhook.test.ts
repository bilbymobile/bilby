/**
 * The webhook, exercised with real signatures.
 *
 * No network and no Stripe account. Signature construction is pure HMAC, so a
 * correctly signed body can be built here and handed to the real route handler,
 * which is the only way to prove the thing that matters: that a request without
 * a valid signature cannot mark an order paid, and that a redelivered event
 * cannot pay one twice.
 *
 * The secrets below are fabricated and are not credentials. The secret key is
 * never used, because nothing here calls Stripe; the webhook secret is one side
 * of an HMAC whose other side is constructed in this file.
 */

process.env.STRIPE_SECRET_KEY ??= "sk_test_not_a_real_key_00000000000000000000";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_not_a_real_secret_0000000000000000";

import crypto from "node:crypto";

import { run } from "../src/lib/db";
import {
  registerFulfiller,
  __resetFulfillers,
  upsertItem,
  setPrice,
  upsertSource,
  setItemActive,
  type Fulfiller,
} from "../src/lib/platform";
import { createDraft, getOrder } from "../src/lib/orders";
import { POST } from "../src/app/api/webhooks/stripe/route";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`, detail === undefined ? "" : detail); }
}

let calls = 0;
const counting: Fulfiller = {
  id: "test", category: "esim", displayName: "counting",
  capabilities: { topUp: false, usage: false, cancelWindowMinutes: null },
  async quote() { return { available: true, costAmount: 1, costCurrency: "USD" }; },
  async fulfil() {
    calls++;
    const ref = `iccid_${calls}`;
    return {
      externalRef: ref, supplierRef: `sup_${calls}`,
      costAmount: 1.23, costCurrency: "USD", label: `Test ${ref}`,
    };
  },
  async status() { return { status: "issued" as const }; },
};

/** Build the header Stripe would send for this exact body. */
function sign(body: string, secret = process.env.STRIPE_WEBHOOK_SECRET!): string {
  const t = Math.floor(Date.now() / 1000);
  const mac = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${mac}`;
}

function post(body: string, signature: string | null): Request {
  return new Request("https://app.example/api/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body,
  });
}

function completedEvent(orderId: string, eventId: string) {
  return JSON.stringify({
    id: eventId,
    object: "event",
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${eventId}`,
        object: "checkout.session",
        client_reference_id: orderId,
        payment_status: "paid",
        payment_intent: `pi_${eventId}`,
        currency: "jpy",
        amount_total: 1980,
        customer_details: { email: "Buyer@Example.com", address: { country: "JP" } },
        metadata: { orderId },
      },
    },
  });
}

async function main() {
  __resetFulfillers();
  registerFulfiller(counting);

  const uid = `u_wh_${crypto.randomBytes(4).toString("hex")}`;
  await run(`INSERT INTO users (id, country, home_country) VALUES (?, 'AU', 'AU')`, [uid]);

  const sku = `wh.sku.${crypto.randomBytes(4).toString("hex")}`;
  await upsertItem({ sku, category: "esim", title: "Webhook test plan", active: false });
  await setPrice(sku, "AUD", 19.95, true);
  await upsertSource({
    sku, fulfillerId: "test", externalId: "PKG", costAmount: 1.23,
    costCurrency: "USD", priority: 10, enabled: true,
  });
  await setItemActive(sku, true);

  const d = await createDraft(uid, [{ sku }]);
  if (!d.ok) throw new Error(d.reason);
  const orderId = d.order.id;

  console.log("\nSignature\n");

  const eventId = `evt_${crypto.randomBytes(8).toString("hex")}`;
  const body = completedEvent(orderId, eventId);

  const noSig = await POST(post(body, null) as never);
  check("no signature is refused", noSig.status === 400, noSig.status);

  const badSig = await POST(post(body, sign(body, "whsec_wrong")) as never);
  check("a signature from the wrong secret is refused", badSig.status === 400, badSig.status);

  const tampered = body.replace('"amount_total":1980', '"amount_total":1');
  const staleSig = sign(body);
  const mismatched = await POST(post(tampered, staleSig) as never);
  check("a body edited after signing is refused", mismatched.status === 400, mismatched.status);

  const stillDraft = await getOrder(orderId);
  check("none of those marked the order paid", stillDraft?.status === "draft", stillDraft?.status);
  check("and none of them called the supplier", calls === 0, calls);

  console.log("\nA real event\n");

  calls = 0;
  const good = await POST(post(body, sign(body)) as never);
  check("a correctly signed event is accepted", good.status === 200, good.status);

  const paid = await getOrder(orderId);
  check("the order is fulfilled", paid?.status === "fulfilled", paid?.status);
  check("the payment intent is recorded", paid?.stripeRef === `pi_${eventId}`, paid?.stripeRef);
  check("presentment is recorded as yen", paid?.presentmentCurrency === "JPY" && paid?.presentmentAmount === 1980, {
    c: paid?.presentmentCurrency, a: paid?.presentmentAmount,
  });
  check("settlement stays in AUD", paid?.currency === "AUD" && paid?.total === 19.95, paid?.total);
  check("the supplier was called once", calls === 1, calls);

  const email = await (await import("../src/lib/db")).one<{ email: string }>(
    `SELECT email FROM users WHERE id = ?`, [uid],
  );
  check("the buyer's address is stored lowercased", email?.email === "buyer@example.com", email?.email);

  console.log("\nRedelivery\n");

  calls = 0;
  const again = await POST(post(body, sign(body)) as never);
  const againBody = await again.json();
  check("a redelivered event returns 200", again.status === 200, again.status);
  check("and says so rather than reprocessing", againBody.duplicate === true, againBody);
  check("and does not call the supplier again", calls === 0, calls);

  // A DIFFERENT event id for the same, already paid order. This is the case the
  // event level guard does not catch and the order level one must.
  calls = 0;
  const secondEvent = `evt_${crypto.randomBytes(8).toString("hex")}`;
  const body2 = completedEvent(orderId, secondEvent);
  await POST(post(body2, sign(body2)) as never);
  check("a second event for an order already paid buys nothing", calls === 0, calls);

  console.log("\nExpiry\n");

  const d2 = await createDraft(uid, [{ sku }]);
  if (!d2.ok) throw new Error("second draft failed");
  const expiredId = `evt_${crypto.randomBytes(8).toString("hex")}`;
  const expired = JSON.stringify({
    id: expiredId, object: "event", type: "checkout.session.expired",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "cs_x", object: "checkout.session", client_reference_id: d2.order.id, metadata: {} } },
  });
  await POST(post(expired, sign(expired)) as never);
  const cancelled = await getOrder(d2.order.id);
  check("an expired session cancels its draft", cancelled?.status === "cancelled", cancelled?.status);

  // The same event against the order that is already paid must not touch it.
  const expired2Id = `evt_${crypto.randomBytes(8).toString("hex")}`;
  const expired2 = JSON.stringify({
    id: expired2Id, object: "event", type: "checkout.session.expired",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "cs_y", object: "checkout.session", client_reference_id: orderId, metadata: {} } },
  });
  await POST(post(expired2, sign(expired2)) as never);
  const untouched = await getOrder(orderId);
  check("an expiry cannot cancel a paid order", untouched?.status === "fulfilled", untouched?.status);

  await run(`DELETE FROM entitlements WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)`, [uid]);
  await run(`DELETE FROM orders WHERE user_id = ?`, [uid]);
  await run(`DELETE FROM users WHERE id = ?`, [uid]);
  await run(`DELETE FROM catalog_sources WHERE sku LIKE 'wh.sku.%'`);
  await run(`DELETE FROM catalog_prices  WHERE sku LIKE 'wh.sku.%'`);
  await run(`DELETE FROM catalog_items   WHERE sku LIKE 'wh.sku.%'`);
  await run(`DELETE FROM idempotency_keys WHERE scope IN ('fulfil', 'stripe.webhook')`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

main().then(() => process.exit(failed === 0 ? 0 : 1), (e) => { console.error(e); process.exit(1); });
