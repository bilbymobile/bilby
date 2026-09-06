import Stripe from "stripe";

import { HOSTS } from "./hosts";
import type { DraftOrder } from "./orders";

/**
 * Payments.
 *
 * ## Checkout, not Elements
 *
 * Stripe's Adaptive Pricing shows a customer in Japan a yen price and a
 * customer in Australia an Australian dollar price, from one AUD line item,
 * with settlement still in AUD and no FX work on our side. It is only available
 * on hosted Checkout. Elements would give a prettier form and would mean either
 * pricing in one currency for the whole world or building currency conversion,
 * presentment rounding and a per country price list by hand.
 *
 * That is the trade: a hosted page we do not control the styling of, in
 * exchange for never writing an FX line. Take the trade. The second thing is a
 * project and the first is a preference.
 *
 * ## What we never touch
 *
 * No card number reaches this application, ever. Checkout is a redirect to
 * Stripe's own domain, the card is entered there, and what comes back is a
 * session id. That is not a convenience, it is what keeps the PCI obligation at
 * the smallest self assessment tier rather than the one with an auditor.
 */

let client: Stripe | null | undefined;

/**
 * The Stripe client, or null when no key is configured.
 *
 * Null rather than throwing, because a fresh clone with an empty .env has to
 * run: the shop renders, the catalogue works, and only the buy button is
 * honest about not being connected. An application that will not boot without
 * a payment key cannot be developed by anybody who does not already have one.
 */
export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return (client = null);
  client = new Stripe(key, {
    // Pinned. An unpinned version means Stripe can change a response shape
    // under a running deployment, and the first you hear of it is a webhook
    // that stopped parsing.
    apiVersion: "2026-08-26.dahlia",
    telemetry: false,
    maxNetworkRetries: 2,
  });
  return client;
}

export function paymentsConfigured(): boolean {
  return stripe() !== null;
}

/** Stripe wants the smallest unit. 17.95 AUD is 1795. */
export function toMinorUnits(amount: number, currency: string): number {
  // The zero decimal currencies. JPY 1795 is one thousand seven hundred and
  // ninety five yen, not seventeen. Sending the wrong one here overcharges by a
  // hundred times, which is the single most expensive off by one available.
  const ZERO_DECIMAL = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

export function fromMinorUnits(minor: number, currency: string): number {
  const ZERO_DECIMAL = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100;
}

/**
 * A hosted Checkout session for one draft order.
 *
 * One line item for the whole order rather than one per SKU. The order already
 * records the lines, and a Stripe session that itemises them would be a second
 * copy of the same facts that can disagree with the first. The receipt the
 * customer cares about is ours.
 */
export async function checkoutSession(order: DraftOrder, opts: {
  email?: string | null;
  origin: string;
}): Promise<{ id: string; url: string }> {
  const s = stripe();
  if (!s) throw new Error("Stripe is not configured");

  const description =
    order.items.length === 1
      ? order.items[0].title
      : `${order.items.length} plans`;

  const session = await s.checkout.sessions.create(
    {
      mode: "payment",

      // How Stripe finds our order when the event comes back. Also written into
      // metadata, because client_reference_id is absent on some event shapes
      // and a webhook that cannot identify its order is a payment with no home.
      client_reference_id: order.id,
      metadata: { orderId: order.id, userId: order.userId },
      payment_intent_data: { metadata: { orderId: order.id } },

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: toMinorUnits(order.total, order.currency),
            product_data: {
              name: description,
              description: order.items.map((i) => i.title).join(", ").slice(0, 500),
            },
          },
        },
      ],

      // The customer's email is how a credential gets delivered, so it is
      // required rather than optional. Prefilled when we already have it.
      customer_email: opts.email ?? undefined,

      // Adaptive Pricing. Stripe presents a local currency to a foreign buyer
      // and settles to us in AUD. The customer pays the conversion spread; we
      // pay nothing and write no FX code.
      adaptive_pricing: { enabled: true },

      // The success URL carries the order id so the receipt page can show
      // something immediately. It is NOT proof of payment and nothing on the
      // other side of it provisions anything: see the webhook.
      success_url: `${opts.origin}/checkout/done?order=${order.id}`,
      cancel_url: `${opts.origin}/checkout?sku=${encodeURIComponent(order.items[0]?.sku ?? "")}&cancelled=1`,

      // Half an hour. Long enough to find a card, short enough that an
      // abandoned session does not hold a discount code's last redemption.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    {
      // Stripe's own idempotency, keyed on our order. A double click on the buy
      // button returns the same session rather than creating a second one.
      idempotencyKey: `checkout:${order.id}`,
    },
  );

  if (!session.url) throw new Error("Stripe returned a session with no URL");
  return { id: session.id, url: session.url };
}

/**
 * Verify a webhook signature and parse the event.
 *
 * Throws on anything that does not verify. This is the only thing standing
 * between "Stripe told us this was paid" and "somebody posted JSON to a public
 * URL", so it runs before the body is parsed, before the order is looked up,
 * and before anything at all is written.
 *
 * The raw body text is required, not a parsed object. Re serialising JSON
 * changes the bytes and the signature will not match, which is the classic way
 * this integration fails with a message that says nothing useful.
 */
export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  const s = stripe();
  if (!s) throw new Error("Stripe is not configured");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Deliberately fatal rather than "skip verification in development". An
    // unverified webhook endpoint in production is an endpoint where anybody
    // can mint paid orders, and the way that ships is a development shortcut
    // nobody remembered to remove.
    throw new Error("STRIPE_WEBHOOK_SECRET is not set, so no event can be trusted");
  }

  return s.webhooks.constructEvent(rawBody, signature, secret);
}

/** Where Checkout should return to. Derived, never a hardcoded hostname. */
export function origin(host: string | null): string {
  const h = host ?? HOSTS.app;
  const proto = h.startsWith("localhost") || h.includes(".local") ? "http" : "https";
  return `${proto}://${h}`;
}

/**
 * Refund a payment, in whole or in part.
 *
 * Takes the payment intent rather than the session, because a session is a
 * checkout attempt and a payment intent is the money. Returns the refund so the
 * caller can record its id on the order.
 */
export async function refund(
  paymentIntentId: string,
  opts: { amountMinor?: number; reason?: "duplicate" | "fraudulent" | "requested_by_customer" } = {},
): Promise<Stripe.Refund> {
  const s = stripe();
  if (!s) throw new Error("Stripe is not configured");

  return s.refunds.create({
    payment_intent: paymentIntentId,
    amount: opts.amountMinor,
    reason: opts.reason ?? "requested_by_customer",
  });
}
