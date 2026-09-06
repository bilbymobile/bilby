import crypto from "node:crypto";

import { tx, one, all } from "./db";
import { GST_DIVISOR } from "./money";
import { getItem, priceOf, pickSource } from "./platform";
import { checkCode, amountOff, claimCode, normalise } from "./discounts";

/**
 * Orders, as commerce rather than as eSIMs.
 *
 * Nothing in this file knows what an ICCID is, and that is the load bearing
 * property of the whole platform layer. An order is a payment; an order item is
 * one line on it; a line names a SKU and a fulfiller and carries whatever input
 * the customer supplied. When the second category arrives, a mobile top up or a
 * VPN subscription or a gift card, none of this changes. The moment a column
 * here is named after an eSIM, the second category costs a migration.
 *
 * ## Why the order is written before the payment
 *
 * A Stripe session is created against an order that already exists, with the
 * order id as the client reference. The alternative, creating the order when
 * the webhook arrives, has a failure mode with no recovery: a payment lands for
 * a cart the server never recorded, and all you have is a Stripe event and a
 * price. Writing first means the worst case is an abandoned draft row, which
 * costs nothing and is trivially swept.
 *
 * ## Why the price is copied onto the order
 *
 * The catalogue price can change between the shop page and the webhook. What
 * the customer is charged is decided once, here, and written down. Every later
 * question, what did we charge, what did it cost, what was the margin, is
 * answered from the order rather than by recomputing against a rate card that
 * has since moved. A business whose historical numbers change is one nobody
 * trusts twice.
 */

export type OrderStatus = "draft" | "paid" | "fulfilled" | "partial" | "refunded" | "cancelled";
export type ItemStatus = "pending" | "fulfilled" | "failed" | "cancelled";

export interface Line {
  sku: string;
  /** Customer supplied values this SKU declares in its input schema. */
  input?: Record<string, unknown>;
}

export interface DraftOrder {
  id: string;
  userId: string;
  currency: string;
  /** GST inclusive total the customer will be charged. */
  total: number;
  tax: number;
  discountCode: string | null;
  discountAmount: number;
  items: Array<{
    id: string;
    sku: string;
    title: string;
    price: number;
    fulfillerId: string | null;
  }>;
}

export type DraftResult =
  | { ok: true; order: DraftOrder }
  | { ok: false; reason: string };

/**
 * Turn a cart into a draft order.
 *
 * Every price is read from the catalogue here and never from the request. A
 * client supplied price is not a price, it is a suggestion from somebody who
 * benefits from it being wrong.
 */
export async function createDraft(
  userId: string,
  lines: Line[],
  opts: { currency?: string; discountCode?: string | null } = {},
): Promise<DraftResult> {
  const currency = (opts.currency ?? "AUD").toUpperCase();

  if (lines.length === 0) return { ok: false, reason: "empty_cart" };
  if (lines.length > 10) return { ok: false, reason: "too_many_items" };

  const resolved: Array<{
    sku: string;
    title: string;
    category: string;
    price: number;
    fulfillerId: string;
    externalId: string;
    costAmount: number;
    costCurrency: string;
    input: Record<string, unknown>;
  }> = [];

  for (const line of lines) {
    const item = await getItem(line.sku);
    // Inactive is indistinguishable from missing on purpose. A SKU that is off
    // is not a thing a customer is entitled to know exists.
    if (!item || !item.active) return { ok: false, reason: "not_for_sale" };

    const price = await priceOf(line.sku, currency);
    if (price === null) return { ok: false, reason: "no_price_in_currency" };

    const source = await pickSource(line.sku);
    if (!source) return { ok: false, reason: "no_supplier" };

    const missing = requiredInputMissing(item.inputSchema, line.input ?? {});
    if (missing) return { ok: false, reason: `missing_input:${missing}` };

    resolved.push({
      sku: item.sku,
      title: item.title,
      category: item.category,
      price,
      fulfillerId: source.fulfillerId,
      externalId: source.externalId,
      costAmount: source.costAmount,
      costCurrency: source.costCurrency,
      input: line.input ?? {},
    });
  }

  const subtotal = round(resolved.reduce((n, r) => n + r.price, 0));

  let discountAmount = 0;
  let discountCode: string | null = null;
  if (opts.discountCode) {
    const check = await checkCode(opts.discountCode, { userId, subtotal });
    if (check.ok) {
      discountCode = normalise(opts.discountCode);
      discountAmount = round(amountOff(check.code, subtotal));
    }
    // A bad code is not an error that stops the order. The checkout page shows
    // whether it applied; refusing the whole purchase over a mistyped code
    // loses the sale to protect nothing.
  }

  const total = round(Math.max(0, subtotal - discountAmount));

  /*
   * Australian GST is one eleventh of a tax inclusive price.
   *
   * Computed on the discounted total rather than the subtotal, because GST is
   * payable on what was actually received. Getting this the other way round
   * means over remitting on every discounted sale and never noticing, since
   * nobody audits a business for paying too much tax.
   */
  const tax = round(total / GST_DIVISOR);

  const orderId = `ord_${crypto.randomBytes(9).toString("base64url")}`;

  await tx(async (t) => {
    await t.run(
      `INSERT INTO orders
         (id, user_id, status, sell_currency, sell_amount,
          tax_code, tax_amount, tax_country,
          discount_code, discount_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        orderId, userId, "draft", currency, total,
        "GST", tax, "AU",
        discountCode, discountAmount,
      ],
    );

    for (const r of resolved) {
      await t.run(
        `INSERT INTO order_items
           (id, order_id, sku, category, fulfiller_id, cost_currency, cost_amount, input, status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          `oi_${crypto.randomBytes(9).toString("base64url")}`,
          orderId, r.sku, r.category, r.fulfillerId,
          r.costCurrency, r.costAmount, JSON.stringify(r.input), "pending",
        ],
      );
    }
  });

  const items = await all<{ id: string; sku: string; fulfiller_id: string | null }>(
    `SELECT id, sku, fulfiller_id FROM order_items WHERE order_id = ?`,
    [orderId],
  );

  return {
    ok: true,
    order: {
      id: orderId,
      userId,
      currency,
      total,
      tax,
      discountCode,
      discountAmount,
      items: items.map((row) => {
        const r = resolved.find((x) => x.sku === row.sku)!;
        return {
          id: row.id,
          sku: row.sku,
          title: r.title,
          price: r.price,
          fulfillerId: row.fulfiller_id,
        };
      }),
    },
  };
}

/**
 * Mark an order paid.
 *
 * Called only from the webhook, never from a redirect. A success URL is a
 * string the customer's browser was handed and can be typed again; a signed
 * event from Stripe is proof.
 *
 * Returns false when the order was already paid, which is the normal case on a
 * redelivered event rather than an error.
 */
export async function markPaid(
  orderId: string,
  stripeRef: string,
  presentment?: { currency: string; amount: number },
  taxEvidence?: Record<string, unknown>,
): Promise<boolean> {
  const changed = await tx(async (t) => {
    /*
     * The status check is in the WHERE clause, not in a preceding read.
     *
     * Stripe retries webhooks, and two deliveries of the same event can be in
     * flight at once. A read then a write leaves a window where both see
     * 'draft' and both proceed, and what is on the other side of that window is
     * two eSIM profiles bought against one payment. A conditional update lets
     * exactly one of them see a row count of one.
     */
    const n = await t.run(
      `UPDATE orders
          SET status = 'paid',
              stripe_ref = ?,
              paid_at = now(),
              presentment_currency = COALESCE(?, presentment_currency),
              presentment_amount   = COALESCE(?, presentment_amount),
              tax_evidence = COALESCE(?, tax_evidence)
        WHERE id = ? AND status = 'draft'`,
      [
        stripeRef,
        presentment?.currency ?? null,
        presentment?.amount ?? null,
        taxEvidence ? JSON.stringify(taxEvidence) : null,
        orderId,
      ],
    );
    return n > 0;
  });

  if (changed) {
    const o = await one<{ discount_code: string | null; user_id: string }>(
      `SELECT discount_code, user_id FROM orders WHERE id = ?`,
      [orderId],
    );
    // A discount is spent when the money arrives, not when the code is typed.
    // Claiming at draft time would let anybody burn a limited code by opening
    // checkout pages and closing them.
    if (o?.discount_code) {
      const amt = await one<{ discount_amount: string }>(
        `SELECT discount_amount FROM orders WHERE id = ?`,
        [orderId],
      );
      await claimCode(o.discount_code, {
        userId: o.user_id,
        orderId,
        amountOff: Number(amt?.discount_amount ?? 0),
      });
    }
  }

  return changed;
}

/** One order with its lines, for the console and the receipt page. */
export interface OrderView {
  id: string;
  userId: string;
  status: OrderStatus;
  currency: string;
  total: number;
  tax: number;
  discountCode: string | null;
  discountAmount: number;
  presentmentCurrency: string | null;
  presentmentAmount: number | null;
  stripeRef: string | null;
  createdAt: string;
  paidAt: string | null;
  items: Array<{
    id: string;
    sku: string;
    category: string;
    status: ItemStatus;
    fulfillerId: string | null;
    supplierRef: string | null;
    costCurrency: string;
    costAmount: number;
    attempts: number;
    lastError: string | null;
    fulfilledAt: string | null;
  }>;
}

export async function getOrder(orderId: string): Promise<OrderView | null> {
  const o = await one<{
    id: string; user_id: string; status: OrderStatus;
    sell_currency: string; sell_amount: string; tax_amount: string;
    discount_code: string | null; discount_amount: string;
    presentment_currency: string | null; presentment_amount: string | null;
    stripe_ref: string | null; created_at: Date; paid_at: Date | null;
  }>(`SELECT * FROM orders WHERE id = ?`, [orderId]);
  if (!o) return null;

  const items = await all<{
    id: string; sku: string; category: string; status: ItemStatus;
    fulfiller_id: string | null; supplier_ref: string | null;
    cost_currency: string; cost_amount: string; attempts: number;
    last_error: string | null; fulfilled_at: Date | null;
  }>(`SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at`, [orderId]);

  return {
    id: o.id,
    userId: o.user_id,
    status: o.status,
    currency: o.sell_currency,
    total: Number(o.sell_amount),
    tax: Number(o.tax_amount),
    discountCode: o.discount_code,
    discountAmount: Number(o.discount_amount),
    presentmentCurrency: o.presentment_currency,
    presentmentAmount: o.presentment_amount === null ? null : Number(o.presentment_amount),
    stripeRef: o.stripe_ref,
    createdAt: o.created_at.toISOString(),
    paidAt: o.paid_at ? o.paid_at.toISOString() : null,
    items: items.map((i) => ({
      id: i.id,
      sku: i.sku,
      category: i.category,
      status: i.status,
      fulfillerId: i.fulfiller_id,
      supplierRef: i.supplier_ref,
      costCurrency: i.cost_currency,
      costAmount: Number(i.cost_amount),
      attempts: i.attempts,
      lastError: i.last_error,
      fulfilledAt: i.fulfilled_at ? i.fulfilled_at.toISOString() : null,
    })),
  };
}

/**
 * Roll the order status up from its lines.
 *
 * Called after every fulfilment attempt. 'partial' is a real state and not a
 * tidiness problem: a two line order where one line succeeded is a customer who
 * has half of what they paid for, and flattening that to 'paid' or 'fulfilled'
 * loses the only fact worth acting on.
 */
export async function reconcileOrderStatus(orderId: string): Promise<OrderStatus> {
  const rows = await all<{ status: ItemStatus; n: string }>(
    `SELECT status, COUNT(*) AS n FROM order_items WHERE order_id = ? GROUP BY status`,
    [orderId],
  );
  const by = new Map(rows.map((r) => [r.status, Number(r.n)]));
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  const done = by.get("fulfilled") ?? 0;
  const cancelled = by.get("cancelled") ?? 0;

  let next: OrderStatus;
  if (total === 0) next = "paid";
  else if (done === total) next = "fulfilled";
  else if (done + cancelled === total && done > 0) next = "partial";
  else if (done > 0) next = "partial";
  else next = "paid";

  // Never walk backwards out of a terminal money state. A refunded order whose
  // supplier callback arrives late is still refunded.
  await tx(async (t) => {
    await t.run(
      `UPDATE orders SET status = ?
        WHERE id = ? AND status NOT IN ('refunded', 'cancelled', 'draft')`,
      [next, orderId],
    );
  });

  return next;
}

/* ------------------------------------------------------------------------ */

/**
 * Which declared input the customer did not supply.
 *
 * The schema is deliberately tiny: a map of field name to { required, type }.
 * It is not JSON Schema and should not become it. The only thing this has to
 * do is stop an order reaching a fulfiller without the phone number it needs,
 * and a validator with a specification is a validator somebody will disable.
 */
function requiredInputMissing(
  schema: Record<string, unknown>,
  input: Record<string, unknown>,
): string | null {
  for (const [field, spec] of Object.entries(schema)) {
    const required = (spec as { required?: boolean } | null)?.required !== false;
    if (!required) continue;
    const v = input[field];
    if (v === undefined || v === null || v === "") return field;
  }
  return null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
