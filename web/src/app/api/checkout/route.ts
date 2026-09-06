import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/session";
import { createDraft } from "@/lib/orders";
import { checkoutSession, origin, paymentsConfigured } from "@/lib/stripe";
import { consume, limitHeaders } from "@/lib/limits";
import { capture } from "@/lib/observe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a purchase.
 *
 * Writes the order, then asks Stripe for a hosted Checkout session, then hands
 * back a URL for the browser to go to. Nothing is charged here and nothing is
 * provisioned here.
 *
 * The order is written first on purpose. Creating it when the webhook arrives
 * would mean a payment can land for a cart the server never recorded, and the
 * only thing you would have to reconstruct it from is a Stripe event and an
 * amount. Writing first means the worst case is an abandoned draft row.
 *
 * The request may name SKUs and a discount code. It may not name a price. Every
 * amount comes from the catalogue, because a client supplied price is not a
 * price, it is a suggestion from somebody who benefits from it being wrong.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser({ allowCreate: true });

  // failClosed: this route writes rows and calls a paid API. If the limiter
  // cannot answer, the safe answer is no.
  const gate = await consume("checkout", user.id);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: limitHeaders(gate) },
    );
  }

  if (!paymentsConfigured()) {
    // A specific, honest answer rather than a 500. Somebody running this from a
    // fresh clone has no Stripe key and should be told that, not shown a stack
    // trace.
    return NextResponse.json(
      { ok: false, reason: "payments_not_configured" },
      { status: 503, headers: limitHeaders(gate) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const b = body as {
    sku?: unknown;
    items?: unknown;
    discountCode?: unknown;
    email?: unknown;
  } | null;

  // One SKU or a list. The single form is what the buy button sends and the
  // list is what a basket would send; supporting both now costs four lines and
  // stops the basket being a breaking change later.
  const lines = normaliseLines(b);
  if (!lines) {
    return NextResponse.json({ ok: false, reason: "bad_items" }, { status: 400 });
  }

  const draft = await createDraft(user.id, lines, {
    currency: "AUD",
    discountCode: typeof b?.discountCode === "string" ? b.discountCode : null,
  });

  if (!draft.ok) {
    // These are all customer visible situations rather than faults: the plan is
    // off sale, the catalogue has no price in this currency, no supplier is
    // enabled. Recorded at 400 without capturing an error, because a stream of
    // "somebody tried to buy an inactive SKU" is noise in a health page.
    return NextResponse.json(
      { ok: false, reason: draft.reason },
      { status: 400, headers: limitHeaders(gate) },
    );
  }

  try {
    const session = await checkoutSession(draft.order, {
      email: typeof b?.email === "string" ? b.email : null,
      origin: origin(req.headers.get("host")),
    });

    return NextResponse.json(
      {
        ok: true,
        orderId: draft.order.id,
        total: draft.order.total,
        currency: draft.order.currency,
        discountApplied: draft.order.discountAmount > 0,
        url: session.url,
      },
      { headers: limitHeaders(gate) },
    );
  } catch (e) {
    // The draft row stays. It is harmless, it is evidence, and deleting it
    // would throw away the only record that somebody tried to buy something and
    // could not.
    await capture("checkout.session", e, { orderId: draft.order.id });
    return NextResponse.json(
      { ok: false, reason: "payment_provider_error" },
      { status: 502, headers: limitHeaders(gate) },
    );
  }
}

function normaliseLines(
  b: { sku?: unknown; items?: unknown } | null,
): Array<{ sku: string; input?: Record<string, unknown> }> | null {
  if (typeof b?.sku === "string" && b.sku) return [{ sku: b.sku }];

  if (Array.isArray(b?.items)) {
    const out: Array<{ sku: string; input?: Record<string, unknown> }> = [];
    for (const raw of b.items) {
      const sku = (raw as { sku?: unknown })?.sku;
      if (typeof sku !== "string" || !sku) return null;
      const input = (raw as { input?: unknown })?.input;
      out.push({
        sku,
        input:
          input && typeof input === "object" && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : undefined,
      });
    }
    return out.length ? out : null;
  }

  return null;
}
