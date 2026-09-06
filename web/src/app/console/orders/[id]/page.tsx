import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { one } from "@/lib/db";
import { getOrder } from "@/lib/orders";
import { refundCost, refundedSoFar } from "@/lib/refunds";
import { can, currentStaff } from "@/lib/staff";
import styles from "../../console.module.css";

export const dynamic = "force-dynamic";

/**
 * One order, and every button a support conversation needs.
 *
 * The three actions here are retry a line, resend the delivery email, and
 * refund. Between them they cover the entire set of things that go wrong after
 * a payment, and having them on one screen is the difference between a
 * five minute reply and an engineer with a database client.
 *
 * The refund panel states the real cost before the button. An operator who
 * believes a refund returns things to zero will refund every complaint, and it
 * does not: the supplier keeps the wholesale, Stripe keeps its percentage and
 * its fixed charge, and the profile is gone because no cancellation window has
 * been agreed in writing.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; done?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/console/login");
  if (!can(me, "orders.read")) redirect("/console");

  const { id } = await params;
  const sp = await searchParams;

  const order = await getOrder(id);
  if (!order) notFound();

  const customer = await one<{ email: string | null; country: string }>(
    `SELECT email, country FROM users WHERE id = ?`,
    [order.userId],
  );

  const refunded = await refundedSoFar(order.id);
  const cost = refundCost(order);
  const mayRetry = can(me, "orders.retry");
  const mayRefund = can(me, "refunds.issue");
  const seeCost = can(me, "costing.read");

  return (
    <>
      <h1 className={styles.h1}>
        <span className={styles.code}>{order.id}</span>
      </h1>
      <p className={styles.lede}>
        <Link href="/console/orders">Back to orders</Link>
      </p>

      {sp.err ? <div className={`${styles.note} ${styles.bad}`}>{sp.err}</div> : null}
      {sp.done ? <div className={`${styles.note} ${styles.ok}`}>{sp.done}</div> : null}

      <div className={styles.grid}>
        <div className={styles.stat}>
          <b>
            {order.currency} {order.total.toFixed(2)}
          </b>
          <span>Charged, GST inclusive</span>
        </div>
        <div className={styles.stat}>
          <b>{order.status}</b>
          <span>State</span>
        </div>
        <div className={styles.stat}>
          <b>
            {order.items.filter((i) => i.status === "fulfilled").length} of{" "}
            {order.items.length}
          </b>
          <span>Lines delivered</span>
        </div>
        {refunded > 0 ? (
          <div className={styles.stat}>
            <b>−{refunded.toFixed(2)}</b>
            <span>Refunded</span>
          </div>
        ) : null}
      </div>

      <div className={styles.panel} style={{ marginTop: 20 }}>
        <h2>Customer</h2>
        <div className={styles.tableWrap}>
          <table>
            <tbody>
              <tr>
                <td>Email</td>
                <td className={styles.code}>
                  {customer?.email ?? (
                    <span style={{ color: "var(--danger)" }}>none on file</span>
                  )}
                </td>
              </tr>
              <tr>
                <td>Account</td>
                <td className={styles.code}>{order.userId}</td>
              </tr>
              <tr>
                <td>Paid</td>
                <td>
                  {order.paidAt ? new Date(order.paidAt).toLocaleString("en-AU") : "Never"}
                </td>
              </tr>
              <tr>
                <td>Payment</td>
                <td className={styles.code}>{order.stripeRef ?? ""}</td>
              </tr>
              {order.presentmentCurrency && order.presentmentCurrency !== order.currency ? (
                <tr>
                  <td>They saw</td>
                  <td>
                    {order.presentmentCurrency} {order.presentmentAmount?.toFixed(2)}
                    <div style={{ color: "var(--muted)", fontSize: ".8em" }}>
                      Adaptive Pricing. We settled in {order.currency}, so a refund
                      is issued in {order.currency} and Stripe reverses their
                      conversion.
                    </div>
                  </td>
                </tr>
              ) : null}
              {order.discountCode ? (
                <tr>
                  <td>Discount</td>
                  <td>
                    <span className={styles.code}>{order.discountCode}</span> −
                    {order.discountAmount.toFixed(2)}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td>GST included</td>
                <td>{order.tax.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.panel} style={{ marginTop: 16 }}>
        <h2>Lines</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>State</th>
                {seeCost ? <th className={styles.num}>Cost</th> : null}
                <th>Supplier reference</th>
                <th>Why not</th>
                {mayRetry ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td className={styles.code}>{i.sku}</td>
                  <td>
                    <span
                      className={`${styles.pill} ${
                        i.status === "fulfilled"
                          ? styles.on
                          : i.status === "failed"
                            ? styles.off
                            : ""
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                  {seeCost ? (
                    <td className={styles.num}>
                      {i.costCurrency} {i.costAmount.toFixed(2)}
                    </td>
                  ) : null}
                  <td className={styles.code}>{i.supplierRef ?? ""}</td>
                  <td style={{ maxWidth: 320, color: "var(--muted)", fontSize: ".85em" }}>
                    {i.lastError ?? ""}
                  </td>
                  {mayRetry ? (
                    <td className={styles.num}>
                      {i.status === "fulfilled" ? null : (
                        <form method="post" action="/console/orders/retry">
                          <input type="hidden" name="itemId" value={i.id} />
                          <input type="hidden" name="orderId" value={order.id} />
                          <button
                            className={`${styles.btn} ${styles.small} ${styles.ghost}`}
                            type="submit"
                          >
                            Retry
                          </button>
                        </form>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {order.items.some((i) => i.status === "failed") ? (
          <div className={styles.note} style={{ marginTop: 16 }}>
            Before retrying, check the supplier&apos;s own order list for this
            reference. The failure may have been a timeout on a request they
            completed, in which case a retry buys a second profile and the
            customer is charged once for two. That check is the entire reason
            this is a button rather than a loop.
          </div>
        ) : null}
      </div>

      {order.paidAt ? (
        <div className={styles.panel} style={{ marginTop: 16 }}>
          <h2>Delivery</h2>
          <p className={styles.sub}>
            The email carries a link, never the activation code. An activation
            code works once and email gets forwarded, so a resend cannot burn
            anybody&apos;s plan.
          </p>
          <form method="post" action="/console/orders/resend">
            <input type="hidden" name="orderId" value={order.id} />
            <button
              className={`${styles.btn} ${styles.ghost}`}
              type="submit"
              disabled={!customer?.email}
            >
              {customer?.email ? "Send it again" : "No address on file"}
            </button>
          </form>
        </div>
      ) : null}

      {mayRefund && order.paidAt && refunded < order.total ? (
        <div className={styles.panel} style={{ marginTop: 16 }}>
          <h2>Refund</h2>

          <div className={`${styles.note} ${styles.bad}`}>
            <strong>A refund is not a return to zero.</strong>
            <br />
            Back to the customer: {order.currency} {(order.total - refunded).toFixed(2)}.
            {seeCost ? (
              <>
                <br />
                Written off with the supplier: about USD {cost.supplierWriteOff.toFixed(2)}.
                The profile cannot be handed back; no cancellation window has been
                agreed in writing.
                <br />
                Kept by Stripe: about {order.currency} {cost.feesKeptByStripe.toFixed(2)}.
                The percentage and the fixed charge are not returned on a refunded
                payment.
              </>
            ) : null}
          </div>

          <form method="post" action="/console/orders/refund" className={styles.form}>
            <input type="hidden" name="orderId" value={order.id} />
            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor="amount">Amount in {order.currency}</label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(order.total - refunded).toFixed(2)}
                  defaultValue={(order.total - refunded).toFixed(2)}
                />
                <span className={styles.hint}>
                  Partial is usually right when one line of a multi line order
                  failed. Refunding all of it gives away the part that worked and
                  the fees on it.
                </span>
              </div>
              <div className={styles.field}>
                <label htmlFor="reason">Reason</label>
                <select id="reason" name="reason" defaultValue="requested_by_customer">
                  <option value="requested_by_customer">Customer asked</option>
                  <option value="duplicate">Duplicate charge</option>
                  <option value="fraudulent">Fraudulent</option>
                </select>
                <span className={styles.hint}>
                  Goes to Stripe and affects their risk view of this account.
                  &quot;Fraudulent&quot; is a real accusation, not a catch all.
                </span>
              </div>
            </div>
            <div>
              <button className={styles.btn} type="submit">
                Refund
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
