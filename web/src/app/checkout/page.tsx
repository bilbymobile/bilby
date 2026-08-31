import Link from "next/link";
import { paidSupplier } from "@/lib/suppliers";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

const TARGET_MARGIN = Number(process.env.RETAIL_TARGET_MARGIN ?? "0.45");

/**
 * Checkout — deliberately still a stub, and honest about it.
 *
 * The Android app links here rather than taking payment in-app. That structure
 * is the point: Google Play's Payments policy exempts purchases consumed
 * outside a Play-distributed app, and keeping the transaction on the web is
 * what makes that argument defensible rather than convenient.
 *
 * What is missing is Stripe. Wiring it is roughly:
 *
 *   1. `npm i stripe @stripe/stripe-js`
 *   2. POST /api/checkout → stripe.checkout.sessions.create({
 *        mode: "payment", line_items: [...], metadata: { planId, userId },
 *        success_url, cancel_url })
 *   3. POST /api/webhooks/stripe → on `checkout.session.completed`, verify the
 *      signature with the webhook secret, then call paidSupplier().order()
 *      and insert into `esims`.
 *
 * Order matters in step 3: provision only after the webhook, never after the
 * browser redirect. A user who closes the tab between payment and redirect has
 * still paid, and a redirect is not proof of anything — it is a URL they can
 * type themselves.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planId } = await searchParams;

  let planName: string | null = null;
  let retail: number | null = null;

  if (planId) {
    try {
      const plans = await paidSupplier().listPlans();
      const p = plans.find((x) => x.planId === planId);
      if (p) {
        planName = p.name;
        retail =
          Math.round(
            Math.max(p.wholesaleUsd / (1 - TARGET_MARGIN), p.minSellUsd ?? 0) * 100
          ) / 100;
      }
    } catch {
      // Supplier down — still render the page rather than a 500. The user
      // came here from the app and a stack trace is a lost customer.
    }
  }

  return (
    <>
      <section className="hero">
        <h1>Checkout</h1>
        <p>
          {planName
            ? `You picked ${planName}.`
            : "Pick a plan from the app or the plans page to get started."}
        </p>
      </section>

      <div className="card">
        <h2>Payments aren&apos;t live yet</h2>
        <p className="sub">
          {retail !== null
            ? `This plan will be $${retail.toFixed(2)}. `
            : ""}
          Card payments are the last thing standing between {brand.name} and its
          first dollar, and they are not built yet. Nothing has been charged.
        </p>
        <div className="note">
          If you got here from the app: the free tier works today. Watch ads,
          earn data, load it onto your eSIM. Paid day passes are coming.
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn" href="/">
            Back to earning
          </Link>
          <Link className="btn ghost" href="/plans">
            See all plans
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>For whoever wires up Stripe</h2>
        <p className="sub" style={{ marginBottom: 12 }}>
          The one rule that matters: <strong>provision the eSIM on the webhook,
          never on the success redirect.</strong> A redirect URL is something a
          user can type; a signed <code className="inline">checkout.session.completed</code>{" "}
          event is proof they paid.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Full notes are in the comment at the top of this file.
        </p>
      </div>
    </>
  );
}
