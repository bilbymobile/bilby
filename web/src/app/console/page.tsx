import { redirect } from "next/navigation";

import { all } from "@/lib/db";
import { currentStaff, recentAudit, can, inBootstrapWindow } from "@/lib/staff";
import styles from "./console.module.css";

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * Deliberately small, and honest about being small. There are no orders yet, so
 * a wall of charts would be a wall of zeroes pretending to be insight. It shows
 * what actually exists and says plainly what is not connected, which is more
 * useful on day one than a dashboard that looks finished.
 */
export default async function ConsoleHome() {
  const me = await currentStaff();
  if (!me) redirect("/console/login");

  const [counts] = await all<{
    customers: string;
    orders: string;
    esims: string;
    codes: string;
    redemptions: string;
    paid: string;
    revenue: string;
    live: string;
    stuck: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM users)::text                AS customers,
       (SELECT COUNT(*) FROM orders)::text               AS orders,
       (SELECT COUNT(*) FROM esims)::text                AS esims,
       (SELECT COUNT(*) FROM discount_codes)::text       AS codes,
       (SELECT COUNT(*) FROM discount_redemptions)::text AS redemptions,
       (SELECT COUNT(*) FROM orders WHERE paid_at IS NOT NULL)::text AS paid,
       -- Money taken, net of refunds. Not "revenue": revenue is a word with an
       -- accounting definition and this number includes GST, which was never
       -- ours. The label on the tile says what it is.
       (SELECT TO_CHAR(COALESCE(SUM(sell_amount - refunded_amount), 0), 'FM999999990.00')
          FROM orders WHERE paid_at IS NOT NULL)         AS revenue,
       (SELECT COUNT(*) FROM catalog_items WHERE active)::text AS live,
       (SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE oi.status IN ('pending','failed')
           AND o.status NOT IN ('draft','cancelled'))::text AS stuck`,
  );

  const log = can(me, "audit.read") ? await recentAudit(12) : [];
  const bootstrapping = await inBootstrapWindow();

  return (
    <>
      <h1 className={styles.h1}>Dashboard</h1>
      <p className={styles.lede}>
        What is actually in the database right now. No projections, no sample data.
      </p>

      {bootstrapping ? (
        <div className={`${styles.note} ${styles.bad}`} style={{ marginBottom: 20 }}>
          <strong>Set RESEND_API_KEY now.</strong> Until you do, this console hands a working
          sign in link to anybody who reaches the login page and types the owner address. That
          address is not a secret. The window closes on its own the moment a session exists,
          which will be as soon as this page finishes loading, but every later sign in needs
          email working.
        </div>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.stat}><b>{counts?.customers ?? "0"}</b><span>Customers</span></div>
        <div className={styles.stat}><b>{counts?.orders ?? "0"}</b><span>Orders</span></div>
        <div className={styles.stat}><b>{counts?.esims ?? "0"}</b><span>eSIMs issued</span></div>
        <div className={styles.stat}><b>{counts?.codes ?? "0"}</b><span>Discount codes</span></div>
        <div className={styles.stat}><b>{counts?.redemptions ?? "0"}</b><span>Codes redeemed</span></div>
      </div>

      <div className={styles.grid} style={{ marginTop: 14 }}>
        <div className={styles.stat}>
          <b>{counts?.paid ?? "0"}</b>
          <span>Paid orders</span>
        </div>
        <div className={styles.stat}>
          <b>{counts?.revenue ?? "0.00"}</b>
          <span>Taken, AUD, GST inclusive</span>
        </div>
        <div className={styles.stat}>
          <b>{counts?.live ?? "0"}</b>
          <span>SKUs on sale</span>
        </div>
        <div className={styles.stat}>
          <b>{counts?.stuck ?? "0"}</b>
          <span>Lines needing attention</span>
        </div>
      </div>

      {Number(counts?.stuck ?? 0) > 0 ? (
        <div className={`${styles.note} ${styles.bad}`} style={{ marginTop: 20 }}>
          {counts?.stuck} paid {Number(counts?.stuck) === 1 ? "line has" : "lines have"} not
          been delivered. Somebody has paid for something they do not have, which is the
          only situation here that gets worse by itself.{" "}
          <a href="/console/orders">Open the queue</a>.
        </div>
      ) : null}

      {Number(counts?.live ?? 0) === 0 ? (
        <div className={styles.note} style={{ marginTop: 20 }}>
          Nothing is on sale. Every SKU seeded from the supplier rate card starts
          inactive, so the shop is empty until somebody decides otherwise.{" "}
          <a href="/console/catalog">Open the catalogue</a>.
        </div>
      ) : null}

      {can(me, "audit.read") ? (
        <div className={styles.panel} style={{ marginTop: 24 }}>
          <h2>Recent activity</h2>
          <p className={styles.sub}>
            Every change made in this console, append only. Nobody can delete from it, including you.
          </p>
          {log.length === 0 ? (
            <div className={styles.empty}>Nothing has been changed yet.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr>
                </thead>
                <tbody>
                  {log.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleString("en-AU")}</td>
                      <td>{r.actor_email}</td>
                      <td className={styles.code}>{r.action}</td>
                      <td className={styles.code}>{r.target ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
