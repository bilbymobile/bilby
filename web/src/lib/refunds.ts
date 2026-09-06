import { one, run, tx } from "./db";
import { refund as stripeRefund, toMinorUnits } from "./stripe";
import { capture } from "./observe";
import { getOrder, type OrderView } from "./orders";

/**
 * Refunds.
 *
 * The point of this file is that a refund can be issued by a person in a
 * browser without anybody opening the database. That was one of the three
 * things standing between this application and being production ready, and it
 * is the one customers notice.
 *
 * ## What a refund actually costs
 *
 * More than the sale price. The Stripe percentage fee is not returned on a
 * refunded charge, the fixed charge is not returned, and the profile is gone
 * because the supplier will not take back an activated eSIM and has granted no
 * cancellation window in writing. So a fully refunded order is a loss of the
 * wholesale cost plus the fees, not a return to zero. money.ts already prices
 * that in as a reserve; this file is where it becomes real.
 *
 * The console says this out loud on the button. An operator who thinks a refund
 * is neutral will refund every complaint.
 *
 * ## Partial refunds are the useful case
 *
 * A two line order where one line failed should refund one line, not the whole
 * thing. Refunding everything because part of it broke gives away the part that
 * worked and the fees on it.
 */

export interface RefundResult {
  ok: boolean;
  amount?: number;
  reason?: string;
}

/**
 * Refund some or all of an order.
 *
 * `amount` is in the settlement currency, which is the currency the order was
 * priced in and NOT necessarily what the customer saw. Stripe refunds against
 * the charge, so the presentment conversion is theirs to reverse; passing a
 * presentment amount here would refund the wrong number.
 */
export async function issueRefund(
  orderId: string,
  opts: { amount?: number; reason?: "duplicate" | "fraudulent" | "requested_by_customer" } = {},
): Promise<RefundResult> {
  const order = await getOrder(orderId);
  if (!order) return { ok: false, reason: "No such order." };
  if (!order.paidAt) return { ok: false, reason: "That order was never paid." };
  if (!order.stripeRef) return { ok: false, reason: "That order has no payment reference." };

  const already = await one<{ refunded_amount: string }>(
    `SELECT refunded_amount FROM orders WHERE id = ?`,
    [orderId],
  );
  const refundedSoFar = Number(already?.refunded_amount ?? 0);
  const remaining = round(order.total - refundedSoFar);

  if (remaining <= 0) return { ok: false, reason: "That order is already fully refunded." };

  const amount = opts.amount === undefined ? remaining : round(opts.amount);
  if (amount <= 0) return { ok: false, reason: "A refund has to be more than nothing." };
  if (amount > remaining) {
    return {
      ok: false,
      reason: `Only ${order.currency} ${remaining.toFixed(2)} is left to refund.`,
    };
  }

  try {
    const r = await stripeRefund(order.stripeRef, {
      amountMinor: toMinorUnits(amount, order.currency),
      reason: opts.reason,
    });

    /*
     * The order is only marked refunded when the WHOLE thing is.
     *
     * A partially refunded order is still a fulfilled order with money against
     * it, and calling it 'refunded' would take it out of every revenue report
     * while most of its revenue is still there.
     */
    await tx(async (t) => {
      await t.run(
        `UPDATE orders
            SET refunded_amount = refunded_amount + ?,
                refund_ref = COALESCE(refund_ref, ?)
          WHERE id = ?`,
        [amount, r.id, orderId],
      );
      await t.run(
        `UPDATE orders SET status = 'refunded'
          WHERE id = ? AND refunded_amount >= sell_amount`,
        [orderId],
      );
    });

    return { ok: true, amount };
  } catch (e) {
    await capture("refund", e, { orderId, amount, currency: order.currency });
    return { ok: false, reason: (e as Error).message };
  }
}

/**
 * What refunding this order really costs the business.
 *
 * Shown on the button rather than discovered on a statement. The supplier cost
 * is gone either way, and Stripe keeps its percentage and its fixed charge on a
 * refunded payment.
 */
export function refundCost(order: OrderView): {
  refundToCustomer: number;
  supplierWriteOff: number;
  feesKeptByStripe: number;
} {
  const supplierWriteOff = order.items
    .filter((i) => i.status === "fulfilled")
    .reduce((n, i) => n + i.costAmount, 0);

  // The blended rate the price was solved against. Deliberately approximate and
  // labelled as such in the console: the exact fee is on the Stripe balance
  // transaction, and fetching it per order to render a warning is a round trip
  // for a number whose job is to stop somebody being casual.
  const feesKeptByStripe = round(order.total * 0.019 + 0.3);

  return {
    refundToCustomer: order.total,
    supplierWriteOff: round(supplierWriteOff),
    feesKeptByStripe,
  };
}

export async function refundedSoFar(orderId: string): Promise<number> {
  const r = await one<{ refunded_amount: string }>(
    `SELECT refunded_amount FROM orders WHERE id = ?`,
    [orderId],
  );
  return Number(r?.refunded_amount ?? 0);
}

/** Cancel a draft that will never be paid. Frees nothing, records the fact. */
export async function cancelDraft(orderId: string): Promise<boolean> {
  const n = await run(
    `UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'draft'`,
    [orderId],
  );
  return n > 0;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
