import Link from "next/link";
import { redirect } from "next/navigation";

import { all } from "@/lib/db";
import { stuckItems } from "@/lib/fulfil";
import { can, currentStaff } from "@/lib/staff";
import styles from "../console.module.css";

export const dynamic = "force-dynamic";

/**
 * Orders, and the operations queue above them.
 *
 * The queue is first on the page and that ordering is the whole design. A list
 * of orders is a record; a list of things that are stuck is a job. Anything in
 * the queue is a customer who has paid and does not yet have what they paid
 * for, which is the only situation in this business that gets worse by itself.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; done?: string; status?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/console/login");
  if (!can(me, "orders.read")) redirect("/console");

  const sp = await searchParams;
  const filter = sp.status;

  const stuck = await stuckItems(50);

  const orders = await all<{
    id: string;
    user_id: string;
    status: string;
    sell_currency: string;
    sell_amount: string;
    refunded_amount: string;
    created_at: Date;
    paid_at: Date | null;
    lines: string;
    done: string;
  }>(
    `SELECT o.id, o.user_id, o.status, o.sell_currency, o.sell_amount,
            o.refunded_amount, o.created_at, o.paid_at,
            COUNT(oi.id)::text AS lines,
            COUNT(oi.id) FILTER (WHERE oi.status = 'fulfilled')::text AS done
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE (? OR o.status = ?)
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [!filter, filter ?? ""],
  );

  return (
    <>
      <h1 className={styles.h1}>Orders</h1>
      <p className={styles.lede}>
        Everything that has been bought, and everything that is stuck. Nothing
        here needs a database client.
      </p>

      {sp.err ? <div className={`${styles.note} ${styles.bad}`}>{sp.err}</div> : null}
      {sp.done ? <div className={`${styles.note} ${styles.ok}`}>{sp.done}</div> : null}

      <div className={styles.panel}>
        <h2>Needs attention</h2>
        <p className={styles.sub}>
          Paid orders with a line that has not been delivered. Nothing retries
          itself, on purpose: a timeout against a supplier is indistinguishable
          from a success we did not hear about, and retrying automatically is how
          one payment buys two profiles. Look at the reason, check the supplier,
          then retry.
        </p>

        {stuck.length === 0 ? (
          <div className={styles.empty}>Nothing is stuck.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>SKU</th>
                  <th>State</th>
                  <th className={styles.num}>Tries</th>
                  <th>Why</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {stuck.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className={styles.code} href={`/console/orders/${s.order_id}`}>
                        {s.order_id}
                      </Link>
                    </td>
                    <td className={styles.code}>{s.sku}</td>
                    <td>
                      <span className={`${styles.pill} ${s.status === "failed" ? styles.off : ""}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className={styles.num}>{s.attempts}</td>
                    <td style={{ maxWidth: 340, color: "var(--muted)", fontSize: ".86em" }}>
                      {s.last_error ?? "Not attempted yet"}
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>
                      {age(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.panel} style={{ marginTop: 16 }}>
        <h2>All orders</h2>
        <p className={styles.sub}>
          <a href="/console/orders">Everything</a>
          {" · "}
          <a href="/console/orders?status=paid">Paid</a>
          {" · "}
          <a href="/console/orders?status=partial">Partial</a>
          {" · "}
          <a href="/console/orders?status=fulfilled">Fulfilled</a>
          {" · "}
          <a href="/console/orders?status=refunded">Refunded</a>
          {" · "}
          <a href="/console/orders?status=draft">Never paid</a>
        </p>

        {orders.length === 0 ? (
          <div className={styles.empty}>
            {filter ? `Nothing with status ${filter}.` : "Nobody has bought anything yet."}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>When</th>
                  <th className={styles.num}>Amount</th>
                  <th className={styles.num}>Lines</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const refunded = Number(o.refunded_amount);
                  return (
                    <tr key={o.id}>
                      <td className={styles.code}>{o.id}</td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>
                        {new Date(o.created_at).toLocaleString("en-AU")}
                      </td>
                      <td className={styles.num}>
                        {o.sell_currency} {Number(o.sell_amount).toFixed(2)}
                        {refunded > 0 ? (
                          <div style={{ color: "var(--danger)", fontSize: ".8em" }}>
                            −{refunded.toFixed(2)} refunded
                          </div>
                        ) : null}
                      </td>
                      <td className={styles.num}>
                        {o.done} of {o.lines}
                      </td>
                      <td>
                        <span
                          className={`${styles.pill} ${
                            o.status === "fulfilled"
                              ? styles.on
                              : o.status === "refunded" || o.status === "partial"
                                ? styles.off
                                : ""
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className={styles.num}>
                        <Link href={`/console/orders/${o.id}`}>Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function age(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}
