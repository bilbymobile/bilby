import Link from "next/link";

import { currentUser } from "@/lib/session";
import { getItem, priceOf } from "@/lib/platform";
import { paymentsConfigured } from "@/lib/stripe";
import { GST_DIVISOR } from "@/lib/money";
import { BuyButton } from "./buy";

export const dynamic = "force-dynamic";

/**
 * The last page before the money.
 *
 * Everything here is read from the catalogue on the server. No price, no title
 * and no SKU detail comes from the query string except the SKU itself, and that
 * is looked up rather than trusted. A checkout page that renders a price handed
 * to it in a URL is a checkout page that can be told what to charge.
 *
 * The card form is not here. Pressing the button creates the order, asks Stripe
 * for a hosted session and sends the browser to Stripe's own domain. No card
 * number ever reaches this application, which is what keeps the PCI obligation
 * at the smallest tier rather than the one with an auditor.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string; cancelled?: string }>;
}) {
  const { sku, cancelled } = await searchParams;
  await currentUser();

  const item = sku ? await getItem(sku) : null;
  const price = item?.active ? await priceOf(item.sku, "AUD") : null;
  const live = paymentsConfigured();

  if (!item || !item.active || price === null) {
    return (
      <>
        <section className="hero">
          <h1>Checkout</h1>
          <p>
            {sku
              ? "That plan is not on sale."
              : "Pick a plan first and this page will have something to charge for."}
          </p>
        </section>
        <div className="card">
          <Link className="btn" href="/plans">
            See plans
          </Link>
        </div>
      </>
    );
  }

  const gst = Math.round((price / GST_DIVISOR) * 100) / 100;
  const mb = Number(item.attributes.dataMb ?? 0);
  const days = Number(item.attributes.days ?? 0);
  const daily = item.attributes.daily === true;
  const routing = String(item.attributes.routing ?? "");

  return (
    <>
      <section className="hero">
        <h1>Checkout</h1>
        <p>One payment, no account needed, no subscription.</p>
      </section>

      {cancelled ? (
        <div className="card">
          <div className="note">
            You closed the payment page, so nothing was charged. Your plan is
            still here if you want it.
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2>{item.title}</h2>
        {item.subtitle ? <p className="sub">{item.subtitle}</p> : null}

        <table>
          <tbody>
            <tr>
              <td>Data</td>
              <td className="num">
                {mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} GB` : `${mb} MB`}
                {daily ? " a day" : ""}
              </td>
            </tr>
            <tr>
              <td>Valid for</td>
              <td className="num">{daily ? "Per day" : `${days} days`}</td>
            </tr>
            <tr>
              <td>Price</td>
              <td className="num">
                <strong>${price.toFixed(2)} AUD</strong>
              </td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Includes GST</td>
              <td className="num" style={{ color: "var(--muted)" }}>
                ${gst.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {routing === "home" ? (
        <div className="card">
          <div className="note">
            <strong>Read this before you pay.</strong> This plan connects through
            an exit point outside the country you are visiting. Most things work
            normally. Some banking apps, some streaming services and some
            government sites check where your connection appears to come from,
            and those may refuse to work. If you need your bank to work while you
            are away, this is not the plan to buy.
          </div>
        </div>
      ) : null}

      <div className="card">
        {live ? (
          <>
            <BuyButton sku={item.sku} price={price} />
            <p className="sub" style={{ marginTop: 14, marginBottom: 0 }}>
              You will be taken to Stripe to pay. We never see your card number.
              If you are outside Australia, Stripe will show you the price in
              your own currency at checkout.
            </p>
          </>
        ) : (
          <>
            <h2>Payments are not connected yet</h2>
            <p className="sub" style={{ margin: 0 }}>
              This deployment has no payment key set, so nothing can be charged.
              Nothing has been charged.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>What happens next</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          The plan is bought from the network the moment your payment clears, and
          it appears on your account with install instructions. We email you a
          link rather than the install code itself, because an install code works
          once and email gets forwarded. Install it before you fly, on wifi.
        </p>
      </div>
    </>
  );
}
