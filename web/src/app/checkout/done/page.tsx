import Link from "next/link";

import { currentUser } from "@/lib/session";
import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * After the payment.
 *
 * This page proves nothing and provisions nothing. It is reached by a redirect,
 * and a redirect URL is a string the browser was handed, which anybody can type
 * again. Everything that matters happened, or is happening, in the webhook.
 *
 * So the honest thing to render is the current state of the order and a
 * refresh, rather than a confident "thank you, here is your eSIM" that would be
 * a lie for the two seconds before the webhook lands and a much worse lie if it
 * never does.
 *
 * The three states below are all real and all common:
 *
 *   paid, nothing fulfilled yet   the webhook is working right now
 *   fulfilled                     done, here is the link
 *   still draft                   the webhook has not arrived at all
 *
 * The third is the one that matters. It is what a customer sees if the webhook
 * is misconfigured, and telling them "we have your payment and we are on it"
 * with a way to reach a human is the difference between a support ticket and a
 * chargeback.
 */
export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const user = await currentUser();

  const order = orderId ? await getOrder(orderId) : null;

  // Scoped to the buyer. An order id in a URL is guessable enough that an
  // unscoped lookup would let anybody read what somebody else bought.
  if (!order || order.userId !== user.id) {
    return (
      <>
        <section className="hero">
          <h1>We cannot find that order</h1>
          <p>
            If you have just paid, nothing is lost. Your plans are on your
            account.
          </p>
        </section>
        <div className="card">
          <Link className="btn" href="/esims">
            Open my plans
          </Link>
        </div>
      </>
    );
  }

  const done = order.items.filter((i) => i.status === "fulfilled").length;
  const total = order.items.length;

  return (
    <>
      <section className="hero">
        <h1>{done === total ? "You are all set" : "Payment received"}</h1>
        <p>
          {order.currency} {order.total.toFixed(2)}
          {order.presentmentCurrency && order.presentmentCurrency !== order.currency
            ? `, charged as ${order.presentmentCurrency} ${order.presentmentAmount?.toFixed(2)}`
            : ""}
          . Order {order.id}.
        </p>
      </section>

      {order.status === "draft" ? (
        <div className="card">
          <h2>We are still confirming your payment</h2>
          <p className="sub">
            This can take a few seconds. Refresh this page, or open your plans in
            a minute and it will be there. If it is not, email us with the order
            number above and we will sort it out. Your payment is not lost.
          </p>
          <Link className="btn ghost" href={`/checkout/done?order=${order.id}`}>
            Refresh
          </Link>
        </div>
      ) : done === total ? (
        <div className="card">
          <h2>Your plan is ready to install</h2>
          <p className="sub">
            Install it now, while you have wifi. Setting up an eSIM needs a
            working connection, and the airport is the worst possible place to
            discover that.
          </p>
          <Link className="btn" href="/esims">
            Install it
          </Link>
        </div>
      ) : (
        <div className="card">
          <h2>Setting up your plan</h2>
          <p className="sub">
            We have your payment and we are buying your plan from the network
            now. It usually takes a few seconds. Refresh, or check your plans in
            a minute.
          </p>
          <Link className="btn ghost" href={`/checkout/done?order=${order.id}`}>
            Refresh
          </Link>
        </div>
      )}

      <div className="card">
        <h2>Receipt</h2>
        <table>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>{i.sku}</td>
                <td className="num" style={{ color: "var(--muted)" }}>
                  {i.status === "fulfilled" ? "Ready" : "Setting up"}
                </td>
              </tr>
            ))}
            {order.discountAmount > 0 ? (
              <tr>
                <td>Discount {order.discountCode}</td>
                <td className="num">−${order.discountAmount.toFixed(2)}</td>
              </tr>
            ) : null}
            <tr>
              <td>Total</td>
              <td className="num">
                <strong>
                  {order.currency} {order.total.toFixed(2)}
                </strong>
              </td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Includes GST</td>
              <td className="num" style={{ color: "var(--muted)" }}>
                ${order.tax.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
