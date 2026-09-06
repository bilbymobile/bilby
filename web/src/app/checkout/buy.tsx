"use client";

import { useState } from "react";

/**
 * The buy button.
 *
 * The only client component in the purchase flow, and it does exactly one
 * thing: post the SKU, get a URL back, go there. It holds no price, computes
 * nothing and decides nothing, because everything it could decide is decided on
 * the server where it cannot be edited from a console.
 *
 * `busy` is not decoration. Without it a double click posts twice, and while
 * the server's idempotency key means Stripe returns the same session both
 * times, the customer would see two navigations fight each other. The cheap fix
 * is here; the correct one is on the server; both are present.
 */
export function BuyButton({ sku, price }: { sku: string; price: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      const body = await res.json();

      if (!res.ok || !body.ok) {
        setError(message(body?.reason));
        setBusy(false);
        return;
      }

      // Deliberately assign rather than push. The Stripe session lives on
      // another origin, and leaving this page in the history means the back
      // button from Stripe lands here rather than on a dead entry.
      window.location.assign(body.url);
    } catch {
      setError("We could not reach the payment page. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" onClick={go} disabled={busy}>
        {busy ? "Taking you to Stripe…" : `Pay $${price.toFixed(2)} AUD`}
      </button>
      {error ? (
        <div className="note bad" style={{ marginTop: 14 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A sentence, not a code.
 *
 * Every one of these is a situation a real person can be in, and each has a
 * different next action. "Something went wrong" would make all of them retry
 * the same thing forever.
 */
function message(reason: unknown): string {
  switch (reason) {
    case "not_for_sale":
      return "That plan is not on sale any more. The plans page has what is currently available.";
    case "no_supplier":
      return "We cannot get that plan from the network right now. Nothing has been charged.";
    case "payments_not_configured":
      return "Payments are not switched on for this site yet. Nothing has been charged.";
    case "rate_limited":
      return "That is a lot of attempts in a short time. Wait a minute and try once more.";
    case "payment_provider_error":
      return "The payment provider did not respond. Nothing has been charged. Try again in a moment.";
    default:
      return "We could not start the payment. Nothing has been charged.";
  }
}
