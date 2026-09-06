import crypto from "node:crypto";

import { all, one, run } from "./db";
import {
  claimKey,
  settleKey,
  releaseKey,
  fulfillerFor,
  grantEntitlement,
  pickSource,
  registerFulfiller,
} from "./platform";
import { reconcileOrderStatus } from "./orders";
import { capture, warn } from "./observe";
import { esimFulfiller } from "./fulfillers/esim";
import { deliver } from "./deliver";

/**
 * Fulfilment.
 *
 * The stretch between "the money arrived" and "the customer has the thing".
 * Everything expensive lives here: this is where a supplier is called, where a
 * profile is bought with real money, and where a failure means somebody has
 * paid for something they do not have.
 *
 * ## One item at a time, and never in a transaction
 *
 * A database transaction cannot span a network call to a supplier. If it could,
 * a rollback would undo our row and leave their profile issued, which is worse
 * than either outcome alone. So each item is claimed, called, and recorded as
 * three separate steps, and the idempotency key is what stitches them together.
 *
 * ## What happens when it fails
 *
 * The item is marked failed with the reason on it, the attempt count goes up,
 * and the order becomes 'partial' rather than 'fulfilled'. Nothing is retried
 * automatically inside the request: an automatic retry against a supplier whose
 * failure mode is unknown is a way to buy four profiles instead of one. Retry
 * is a button in the console, pressed by somebody who has looked at the reason.
 *
 * The exception is a failure that is definitely ours and definitely before the
 * supplier was reached, which releases the key so a retry can reuse it.
 */

/* ---- Registration ------------------------------------------------------- *
 *
 * Fulfillers are registered here rather than in each adapter, so that "what can
 * this application deliver" is answerable by reading one list. A catalogue
 * source naming a fulfiller that is not on this list is a wiring error that
 * fails loudly at fulfilment rather than a silent no op.
 */
let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  registerFulfiller(esimFulfiller);
  registered = true;
}

export interface FulfilResult {
  orderId: string;
  attempted: number;
  fulfilled: number;
  failed: number;
}

/**
 * Deliver everything outstanding on one paid order.
 *
 * Safe to call twice. Items already fulfilled are skipped, and the per item
 * idempotency key means even a concurrent second call cannot buy twice.
 */
export async function fulfilOrder(orderId: string): Promise<FulfilResult> {
  ensureRegistered();

  const order = await one<{ user_id: string; status: string }>(
    `SELECT user_id, status FROM orders WHERE id = ?`,
    [orderId],
  );

  if (!order) {
    await capture("fulfil", new Error("No such order"), { orderId });
    return { orderId, attempted: 0, fulfilled: 0, failed: 0 };
  }

  /*
   * Never fulfil a draft.
   *
   * This is the check that stops an unpaid order being delivered, and it is
   * deliberately here rather than only at the call site. There is exactly one
   * caller today, the webhook, and there will be more: a console retry, a sweep
   * job, a support action. Any of them getting it wrong gives away a profile.
   */
  if (order.status === "draft" || order.status === "cancelled") {
    await capture("fulfil", new Error(`Refused to fulfil a ${order.status} order`), {
      orderId,
    });
    return { orderId, attempted: 0, fulfilled: 0, failed: 0 };
  }

  const items = await all<{
    id: string; sku: string; category: string;
    fulfiller_id: string | null; input: Record<string, unknown>;
  }>(
    `SELECT id, sku, category, fulfiller_id, input
       FROM order_items
      WHERE order_id = ? AND status IN ('pending', 'failed')
      ORDER BY created_at`,
    [orderId],
  );

  let fulfilled = 0;
  let failed = 0;

  for (const item of items) {
    const ok = await fulfilItem({
      itemId: item.id,
      orderId,
      userId: order.user_id,
      sku: item.sku,
      category: item.category,
      fulfillerId: item.fulfiller_id,
      input: item.input ?? {},
    });
    if (ok) fulfilled++;
    else failed++;
  }

  await reconcileOrderStatus(orderId);

  // Delivery is separate from fulfilment on purpose. A profile that exists but
  // whose email did not send is a recoverable problem; refusing to record the
  // profile because the mail provider was down is not.
  if (fulfilled > 0) {
    try {
      await deliver(orderId);
    } catch (e) {
      await capture("deliver", e, { orderId });
    }
  }

  return { orderId, attempted: items.length, fulfilled, failed };
}

/**
 * One line. Returns whether it was delivered.
 *
 * Never throws: a single failing item must not abandon the rest of the order.
 * A two line order where the first supplier is down should still deliver the
 * second line and tell somebody about the first.
 */
async function fulfilItem(ctx: {
  itemId: string;
  orderId: string;
  userId: string;
  sku: string;
  category: string;
  fulfillerId: string | null;
  input: Record<string, unknown>;
}): Promise<boolean> {
  const key = `fulfil:${ctx.itemId}`;

  /*
   * The key is claimed BEFORE the supplier is called and is not released on
   * failure unless we are certain nothing was bought.
   *
   * The instinct is the other way round: release on failure so a retry can
   * work. That instinct is what buys two profiles. A timeout is
   * indistinguishable from a success we did not hear about, and the only safe
   * default when you cannot tell is to refuse to try again automatically.
   */
  const fresh = await claimKey(key, "fulfil");
  if (!fresh) {
    await warn("fulfil", new Error("Item already claimed, so it was not retried"), {
      itemId: ctx.itemId,
      orderId: ctx.orderId,
      sku: ctx.sku,
    });
    return false;
  }

  if (!ctx.fulfillerId) {
    await failItem(ctx.itemId, "The order line names no fulfiller.");
    await releaseKey(key);
    return false;
  }

  // Resolved at fulfilment time rather than read off the order line, because
  // the supplier's own plan id can be corrected in the catalogue between the
  // sale and a retry, and a retry should use the corrected one.
  const source = await pickSource(ctx.sku);
  if (!source) {
    await failItem(ctx.itemId, "No enabled supplier can fill this SKU any more.");
    // Nothing reached a supplier, so a retry is safe once somebody re enables
    // one. This is the narrow case where releasing the key is correct.
    await releaseKey(key);
    return false;
  }

  let fulfiller;
  try {
    fulfiller = fulfillerFor(source.fulfillerId);
  } catch (e) {
    await failItem(ctx.itemId, (e as Error).message);
    await releaseKey(key);
    return false;
  }

  try {
    const result = await fulfiller.fulfil({
      externalId: source.externalId,
      key,
      userRef: ctx.userId,
      input: ctx.input,
    });

    await run(
      `UPDATE order_items
          SET status = 'fulfilled',
              supplier_ref = ?,
              cost_amount = ?,
              cost_currency = ?,
              fulfilled_at = now(),
              attempts = attempts + 1,
              last_error = NULL
        WHERE id = ?`,
      [result.supplierRef, result.costAmount, result.costCurrency, ctx.itemId],
    );

    await grantEntitlement({
      id: `ent_${crypto.randomBytes(9).toString("base64url")}`,
      userId: ctx.userId,
      orderItemId: ctx.itemId,
      category: ctx.category,
      status: "issued",
      externalRef: result.externalRef,
      label: result.label,
      expiresAt: result.expiresAt ?? null,
      payload: result.payload ?? {},
    });

    await settleKey(key, {
      itemId: ctx.itemId,
      externalRef: result.externalRef,
      supplierRef: result.supplierRef,
    });

    return true;
  } catch (e) {
    /*
     * The key stays claimed. See the note above: this may be a timeout on a
     * request the supplier completed, and there is no way to tell from here.
     * Recovery is a person in the console who can look at the supplier's own
     * order list first.
     */
    await failItem(ctx.itemId, (e as Error).message);
    await capture("fulfil", e, {
      itemId: ctx.itemId,
      orderId: ctx.orderId,
      sku: ctx.sku,
      fulfiller: source.fulfillerId,
    });
    return false;
  }
}

async function failItem(itemId: string, reason: string): Promise<void> {
  await run(
    `UPDATE order_items
        SET status = 'failed', attempts = attempts + 1, last_error = ?
      WHERE id = ?`,
    [reason.slice(0, 2000), itemId],
  );
}

/**
 * Retry one failed line, from the console.
 *
 * Takes the key out of the way first, which is the deliberate difference from
 * the automatic path: a person has decided this is safe to try again, presumably
 * after checking whether the supplier already has an order against it. That
 * decision is exactly the thing an automatic retry cannot make, which is why
 * there is no automatic retry.
 */
export async function retryItem(itemId: string): Promise<boolean> {
  ensureRegistered();

  const item = await one<{
    id: string; order_id: string; sku: string; category: string;
    fulfiller_id: string | null; input: Record<string, unknown>; status: string;
  }>(`SELECT * FROM order_items WHERE id = ?`, [itemId]);

  if (!item) return false;
  if (item.status === "fulfilled") return false;

  const order = await one<{ user_id: string; status: string }>(
    `SELECT user_id, status FROM orders WHERE id = ?`,
    [item.order_id],
  );
  if (!order || order.status === "draft" || order.status === "cancelled") return false;

  await releaseKeyForce(`fulfil:${itemId}`);

  const ok = await fulfilItem({
    itemId: item.id,
    orderId: item.order_id,
    userId: order.user_id,
    sku: item.sku,
    category: item.category,
    fulfillerId: item.fulfiller_id,
    input: item.input ?? {},
  });

  await reconcileOrderStatus(item.order_id);

  if (ok) {
    try {
      await deliver(item.order_id);
    } catch (e) {
      await capture("deliver", e, { orderId: item.order_id });
    }
  }

  return ok;
}

/**
 * Drop a settled or claimed key so a retry can proceed.
 *
 * Deliberately NOT exported from platform.ts, where releaseKey refuses to touch
 * a settled key. This is the operator override and it should look like one:
 * separate function, separate file, one caller, and that caller is a button
 * somebody had to press.
 */
async function releaseKeyForce(key: string): Promise<void> {
  await run(`DELETE FROM idempotency_keys WHERE key = ?`, [key]);
}

/** Everything stuck, for the console's operations queue. */
export async function stuckItems(limit = 100) {
  return all<{
    id: string; order_id: string; sku: string; status: string;
    attempts: number; last_error: string | null; created_at: Date;
    user_id: string; sell_currency: string; sell_amount: string;
  }>(
    `SELECT oi.id, oi.order_id, oi.sku, oi.status, oi.attempts, oi.last_error,
            oi.created_at, o.user_id, o.sell_currency, o.sell_amount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE oi.status IN ('pending', 'failed')
        AND o.status NOT IN ('draft', 'cancelled')
      ORDER BY oi.created_at
      LIMIT ?`,
    [limit],
  );
}
