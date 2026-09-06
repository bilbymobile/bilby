import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { markPaid } from "@/lib/orders";
import { fromMinorUnits, verifyWebhook } from "@/lib/stripe";
import { claimKey, settleKey } from "@/lib/platform";
import { capture, warn } from "@/lib/observe";
import { run } from "@/lib/db";
import { fulfilOrder } from "@/lib/fulfil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only place an order becomes paid.
 *
 * The success redirect does not do this and must never be made to. A success
 * URL is a string handed to a browser, and a browser can be told to visit a
 * string; a signed event from Stripe is proof that money moved. Every eSIM
 * business that has provisioned on a redirect has provisioned for free at least
 * once.
 *
 * ## Order of operations, which is not negotiable
 *
 *   1. Verify the signature. Before parsing, before looking anything up.
 *   2. Claim the event id. Stripe retries; two deliveries can overlap.
 *   3. Mark the order paid, conditionally on it being a draft.
 *   4. Return 200 to Stripe.
 *   5. Fulfil.
 *
 * Four before five matters. Fulfilment talks to a supplier and can take
 * seconds; Stripe times a webhook out at about ten and retries what it thinks
 * failed. A slow supplier would therefore produce a second delivery of an event
 * whose work is already underway. The claim at step two would catch it, but the
 * cheaper fix is to stop being slow: acknowledge, then work.
 *
 * ## Why the raw body
 *
 * Signature verification is over the exact bytes Stripe sent. Parsing to an
 * object and re serialising changes them, and the failure is a signature
 * mismatch with no clue as to why.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "no_signature" }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhook(raw, signature);
  } catch (e) {
    /*
     * A failed signature is not a bug, it is somebody posting to a public URL,
     * and it will happen. Recorded at warning level so a burst is visible
     * without an unverified request being able to fill the error page.
     */
    await warn("stripe.webhook.signature", e, {
      // Never the body. It is unverified input and could be anything.
      bytes: raw.length,
    });
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  /*
   * Exactly once, claimed by a conditional insert.
   *
   * Stripe guarantees at least once delivery and explicitly does not guarantee
   * order or uniqueness. Without this, a redelivery of checkout.session.completed
   * runs the fulfilment path twice, and the second eSIM cannot be clawed back
   * because it has already been issued.
   */
  const fresh = await claimKey(`stripe:${event.id}`, "stripe.webhook");
  if (!fresh) {
    // 200, not 409. Telling Stripe this failed makes it retry forever.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCompleted(event.data.object);
        break;

      case "checkout.session.async_payment_succeeded":
        await onCompleted(event.data.object);
        break;

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await onAbandoned(event.data.object);
        break;

      case "charge.dispute.created":
        await onDispute(event.data.object);
        break;

      default:
        // Everything else is acknowledged and ignored. Subscribing narrowly at
        // the Stripe end would be tidier, but a webhook that 400s on an event
        // somebody enabled in the dashboard is a webhook that gets disabled.
        break;
    }

    await settleKey(`stripe:${event.id}`, { type: event.type });
    return NextResponse.json({ ok: true });
  } catch (e) {
    /*
     * The key stays claimed.
     *
     * The instinct is to release it so Stripe's retry can have another go, and
     * that instinct is wrong here: the failure may have happened after the
     * supplier was called, and a retry would then buy a second profile. A stuck
     * order is recoverable from the console. A duplicate purchase is not.
     */
    await capture("stripe.webhook", e, { eventId: event.id, type: event.type });
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------------ */

async function onCompleted(session: Stripe.Checkout.Session) {
  const orderId =
    session.client_reference_id ??
    (session.metadata?.orderId as string | undefined) ??
    null;

  if (!orderId) {
    await capture("stripe.webhook", new Error("Paid session carries no order id"), {
      sessionId: session.id,
    });
    return;
  }

  // Only 'paid' counts. A session can complete with payment_status 'unpaid'
  // when the payment method settles asynchronously, and treating that as paid
  // means provisioning before the money arrives.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return;
  }

  /*
   * What the customer actually saw, when Adaptive Pricing showed them another
   * currency. Recorded because a support conversation about "I was charged
   * 2,100 yen and you say 19.95" needs both numbers, and because a refund has
   * to be reasoned about in the settlement currency while the customer thinks
   * in theirs.
   */
  const presentment =
    session.currency && session.amount_total !== null
      ? {
          currency: session.currency.toUpperCase(),
          amount: fromMinorUnits(session.amount_total, session.currency),
        }
      : undefined;

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? session.id;

  /*
   * Two pieces of location evidence, kept for the day this sells into the EU.
   *
   * The VAT rules there require two non contradictory pieces of evidence for
   * where a consumer belongs, and three to rebut a presumption. The billing
   * country and the card's issuing country are the two that arrive free with
   * every payment. Collecting them now costs nothing; reconstructing them for
   * historical orders is impossible.
   */
  const evidence: Record<string, unknown> = {
    billingCountry: session.customer_details?.address?.country ?? null,
    stripeSessionId: session.id,
    capturedAt: new Date().toISOString(),
  };

  const becamePaid = await markPaid(orderId, paymentIntent, presentment, evidence);

  if (session.customer_details?.email) {
    // Stored on the user rather than the order: it is how every future
    // credential for this person gets delivered, not a fact about one purchase.
    await run(
      `UPDATE users SET email = COALESCE(email, ?) WHERE id =
         (SELECT user_id FROM orders WHERE id = ?)`,
      [session.customer_details.email.toLowerCase(), orderId],
    );
  }

  if (!becamePaid) {
    // Already paid. A redelivery whose first copy got through, which is normal.
    return;
  }

  await fulfilOrder(orderId);
}

async function onAbandoned(session: Stripe.Checkout.Session) {
  const orderId =
    session.client_reference_id ?? (session.metadata?.orderId as string | undefined);
  if (!orderId) return;

  /*
   * Cancel the draft, and only if it is still a draft.
   *
   * An expired session for an order that somehow reached 'paid' is a fact worth
   * not acting on: Stripe expiring a session it already collected on would be
   * strange, and turning a paid order into a cancelled one on the strength of
   * that would take a customer's money and mark it refunded without refunding
   * anything.
   */
  await run(
    `UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'draft'`,
    [orderId],
  );
}

async function onDispute(dispute: Stripe.Dispute) {
  const pi =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null;

  /*
   * Deliberately does not cancel anything or claw anything back.
   *
   * A dispute is a claim, not a verdict, and the profile is already on the
   * customer's handset either way. What this does is make sure a person finds
   * out today rather than when the funds are withdrawn, because the evidence
   * window is short and the delivery evidence we hold is good: an activation
   * timestamp and an install event are hard facts.
   */
  await capture(
    "stripe.dispute",
    new Error(`Dispute opened: ${dispute.reason}`),
    {
      paymentIntent: pi,
      amount: dispute.amount,
      currency: dispute.currency,
      status: dispute.status,
      dueBy: dispute.evidence_details?.due_by ?? null,
    },
  );
}
