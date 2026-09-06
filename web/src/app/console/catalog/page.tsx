import { redirect } from "next/navigation";

import { listCatalogForAdmin } from "@/lib/platform";
import { can, currentStaff } from "@/lib/staff";
import { destinationName } from "@/lib/destinations";
import styles from "../console.module.css";

export const dynamic = "force-dynamic";

interface Pricing {
  costUsd: number;
  fxUsdAud: number;
  fxAsAt: string;
  targetMargin: number;
  actualMargin: number;
  contributionAud: number;
  pricedAt: string;
}

/** The economics recorded when this SKU was priced, if it was priced by the seeder. */
function pricing(i: { attributes: Record<string, unknown> }): Pricing | null {
  const p = i.attributes.pricing;
  return p && typeof p === "object" ? (p as Pricing) : null;
}

/**
 * What is on sale, and what is not.
 *
 * Fifty two SKUs arrive from the rate card seeder and every one of them is
 * inactive. That is the design: a rate card is an input to a decision, not a
 * decision, and nothing here has been installed on a handset yet. This page is
 * where a person makes that decision one plan at a time.
 *
 * Cost and margin are shown, which means this page is the commercial core of
 * the business rendered on one screen. It is gated on costing.read for exactly
 * that reason: a support agent has no need for the wholesale column, and a
 * screenshot of it is a competitor's pricing intelligence or a supplier's
 * leverage in the next rate negotiation.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; done?: string; country?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/console/login");

  const seeCost = can(me, "costing.read");
  const mayChange = can(me, "costing.edit");
  const sp = await searchParams;

  const items = await listCatalogForAdmin("esim");
  const countries = [...new Set(items.map((i) => String(i.attributes.country ?? "")))]
    .filter(Boolean)
    .sort();
  const filter = sp.country?.toUpperCase();
  const shown = filter ? items.filter((i) => i.attributes.country === filter) : items;

  const live = items.filter((i) => i.active).length;

  return (
    <>
      <h1 className={styles.h1}>Catalogue</h1>
      <p className={styles.lede}>
        {live === 0 ? (
          <>
            Nothing is on sale. Every SKU below was seeded from the supplier rate
            card and starts inactive, because a price on a rate card is not a
            decision to sell something.
          </>
        ) : (
          <>
            {live} of {items.length} SKUs are on sale. The rest are seeded and
            waiting on a decision.
          </>
        )}
      </p>

      {sp.err ? <div className={`${styles.note} ${styles.bad}`}>{sp.err}</div> : null}
      {sp.done ? (
        <div className={`${styles.note} ${styles.ok}`}>
          Changed <b className={styles.code}>{sp.done}</b>.
        </div>
      ) : null}

      <div className={styles.panel}>
        <h2>Destination</h2>
        <p className={styles.sub}>
          {filter ? destinationName(filter) : "Everything"}, {shown.length} SKUs.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a className={`${styles.btn} ${styles.small} ${filter ? styles.ghost : ""}`} href="/console/catalog">
            All
          </a>
          {countries.map((c) => (
            <a
              key={c}
              className={`${styles.btn} ${styles.small} ${filter === c ? "" : styles.ghost}`}
              href={`/console/catalog?country=${c}`}
            >
              {c}
            </a>
          ))}
        </div>
      </div>

      <div className={styles.panel} style={{ marginTop: 16 }}>
        <h2>Plans</h2>
        <p className={styles.sub}>
          Activating checks that the SKU has a price and a supplier who can fill
          it, and refuses if either is missing. Both of those failures look
          identical to a customer, and both are trivially preventable here.
        </p>

        {shown.length === 0 ? (
          <div className={styles.empty}>
            Nothing seeded. Run the catalogue seeder against this database.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Routing</th>
                  {seeCost ? <th className={styles.num}>Cost</th> : null}
                  <th className={styles.num}>Price</th>
                  {seeCost ? <th className={styles.num}>Margin</th> : null}
                  <th>Supplier</th>
                  <th>State</th>
                  {mayChange ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const routing = String(i.attributes.routing ?? "");
                  return (
                    <tr key={i.sku}>
                      <td>
                        <div className={styles.code}>{i.sku}</div>
                        <div style={{ color: "var(--muted)", fontSize: ".8em" }}>{i.title}</div>
                      </td>
                      <td>
                        <span className={`${styles.pill} ${routing === "local" ? styles.on : ""}`}>
                          {routing}
                        </span>
                      </td>
                      {seeCost ? (
                        <td className={styles.num}>
                          {i.costAmount === null
                            ? ""
                            : `${i.costCurrency} ${i.costAmount.toFixed(2)}`}
                        </td>
                      ) : null}
                      <td className={styles.num}>
                        {i.sellAmount === null ? (
                          <span style={{ color: "var(--danger)" }}>none</span>
                        ) : (
                          `${i.currency} ${i.sellAmount.toFixed(2)}`
                        )}
                      </td>
                      {seeCost ? (
                        <td className={styles.num} style={{ color: "var(--muted)" }}>
                          {/*
                            Read back, never recomputed.
                            
                            The obvious thing to write here is price minus cost
                            over price, but that needs an FX rate, and the only
                            honest rate to use is the one the price was actually
                            solved against. Dividing by today's rate would show
                            a margin this plan was never set to and would move
                            every historical number every time the dollar moves.
                            money.ts solves for the real contribution margin at
                            seeding time, after GST, payment fees, disputes and
                            refunds, and that is the number stored and shown.
                          */}
                          {pricing(i)
                            ? `${(pricing(i)!.actualMargin * 100).toFixed(0)}%`
                            : ""}
                        </td>
                      ) : null}
                      <td>
                        {i.fulfillerId ? (
                          <>
                            <span className={styles.code}>{i.fulfillerId}</span>
                            {i.sourceEnabled === false ? (
                              <span className={`${styles.pill} ${styles.off}`} style={{ marginLeft: 6 }}>
                                off
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span style={{ color: "var(--danger)" }}>none</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.pill} ${i.active ? styles.on : styles.off}`}>
                          {i.active ? "on sale" : "off"}
                        </span>
                      </td>
                      {mayChange ? (
                        <td className={styles.num}>
                          <form method="post" action="/console/catalog/toggle">
                            <input type="hidden" name="sku" value={i.sku} />
                            <input type="hidden" name="next" value={i.active ? "0" : "1"} />
                            <button
                              className={`${styles.btn} ${styles.small} ${styles.ghost}`}
                              type="submit"
                            >
                              {i.active ? "Take off sale" : "Put on sale"}
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.note} style={{ marginTop: 24 }}>
        Every SKU seeded so far routes through an overseas exit point, which is
        why it is cheap. That breaks some banking apps, some streaming and some
        government services in the destination country. The plan description
        says so on the product page, and it should stay there. Before putting
        one on sale, install it on a real handset in the destination and check
        the thing you would be angriest to find broken.
      </div>
    </>
  );
}
