import { redirect } from "next/navigation";

import { DESTINATIONS } from "@/lib/destinations";
import { generateCode, listCodes } from "@/lib/discounts";
import { can, currentStaff } from "@/lib/staff";
import styles from "../console.module.css";

export const dynamic = "force-dynamic";

/**
 * Discount codes.
 *
 * The whole point is that this is a form. Every rule a code can carry is a
 * field, so issuing one for a campaign on a Friday afternoon costs a minute and
 * involves nobody. Nothing here needs an engineer, which is the difference
 * between a business that runs promotions and one that talks about running
 * them.
 */
export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ made?: string; err?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/console/login");

  const allowed = can(me, "discounts.manage");
  const codes = await listCodes();
  const sp = await searchParams;

  const suggestion = generateCode();

  return (
    <>
      <h1 className={styles.h1}>Discounts</h1>
      <p className={styles.lede}>
        Codes take effect the moment you save one. Disabling a code stops new orders using it and
        leaves orders already placed with it alone.
      </p>

      {sp.made ? (
        <div className={`${styles.note} ${styles.ok}`}>
          Created <b className={styles.code}>{sp.made}</b>. It is live now.
        </div>
      ) : null}
      {sp.err ? <div className={`${styles.note} ${styles.bad}`}>{sp.err}</div> : null}

      {allowed ? (
        <div className={styles.panel}>
          <h2>New code</h2>
          <p className={styles.sub}>
            Leave the code blank and one is generated for you, avoiding characters that get misread
            when a code is read down a phone.
          </p>
          <form className={styles.form} method="post" action="/console/coupons/create">
            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor="code">Code</label>
                <input id="code" name="code" placeholder={suggestion} autoComplete="off" />
                <span className={styles.hint}>Blank generates one</span>
              </div>
              <div className={styles.field}>
                <label htmlFor="kind">Type</label>
                <select id="kind" name="kind" defaultValue="percent">
                  <option value="percent">Percentage off</option>
                  <option value="fixed">Fixed amount off</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="value">Amount</label>
                <input id="value" name="value" type="number" step="0.01" min="0.01" required />
                <span className={styles.hint}>Percent 1 to 100, or dollars</span>
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor="maxRedemptions">Total uses</label>
                <input id="maxRedemptions" name="maxRedemptions" type="number" min="1" />
                <span className={styles.hint}>Blank is unlimited</span>
              </div>
              <div className={styles.field}>
                <label htmlFor="perUserLimit">Uses per customer</label>
                <input id="perUserLimit" name="perUserLimit" type="number" min="1" defaultValue={1} />
              </div>
              <div className={styles.field}>
                <label htmlFor="minSpend">Minimum spend</label>
                <input id="minSpend" name="minSpend" type="number" step="0.01" min="0" />
                <span className={styles.hint}>Blank is any order</span>
              </div>
              <div className={styles.field}>
                <label htmlFor="expiresAt">Expires</label>
                <input id="expiresAt" name="expiresAt" type="datetime-local" />
                <span className={styles.hint}>Blank never expires</span>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="destinations">Limit to destinations</label>
              <select id="destinations" name="destinations" multiple size={5}>
                {DESTINATIONS.map((d) => (
                  <option key={d.iso} value={d.iso}>{d.name}</option>
                ))}
              </select>
              <span className={styles.hint}>Select none for any destination</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="note">Why this code exists</label>
              <input id="note" name="note" placeholder="OzBargain launch post, September" />
              <span className={styles.hint}>For whoever finds it in six months. Internal only.</span>
            </div>

            <div><button className={styles.btn} type="submit">Create code</button></div>
          </form>
        </div>
      ) : (
        <div className={styles.note}>
          Your role is <b>{me.role}</b>, which can see codes but not change them. Discounts are
          owner and finance.
        </div>
      )}

      <div className={styles.panel} style={{ marginTop: 16 }}>
        <h2>All codes</h2>
        <p className={styles.sub}>{codes.length} in total, newest first.</p>
        {codes.length === 0 ? (
          <div className={styles.empty}>No codes yet. The form above makes the first one.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Worth</th><th className={styles.num}>Used</th><th>Limits</th>
                  <th>Expires</th><th>Status</th><th>Note</th><th />
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code}>
                    <td className={styles.code}>{c.code}</td>
                    <td>
                      {c.kind === "percent"
                        ? `${Number(c.value)}% off`
                        : `$${Number(c.value).toFixed(2)} off`}
                    </td>
                    <td className={styles.num}>
                      {c.redeemed_count}
                      {c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ""}
                    </td>
                    <td>
                      {[
                        c.per_user_limit > 1 ? `${c.per_user_limit} per customer` : null,
                        c.min_spend !== null ? `min $${Number(c.min_spend).toFixed(2)}` : null,
                        c.destinations?.length ? c.destinations.join(", ") : null,
                      ].filter(Boolean).join(" · ") || "None"}
                    </td>
                    <td>
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-AU") : "Never"}
                    </td>
                    <td>
                      <span className={`${styles.pill} ${c.active ? styles.on : styles.off}`}>
                        {c.active ? "Live" : "Off"}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{c.note ?? ""}</td>
                    <td>
                      {allowed ? (
                        <form method="post" action="/console/coupons/toggle">
                          <input type="hidden" name="code" value={c.code} />
                          <input type="hidden" name="next" value={c.active ? "0" : "1"} />
                          <button className={`${styles.btn} ${styles.ghost} ${styles.small}`} type="submit">
                            {c.active ? "Disable" : "Enable"}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
