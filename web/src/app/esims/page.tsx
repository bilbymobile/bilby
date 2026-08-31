import Link from "next/link";
import { currentUser } from "@/lib/session";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Row {
  iccid: string;
  is_free_tier: number;
  created_at: string;
  installed_at: string | null;
}

export default async function EsimsPage() {
  const user = await currentUser();
  const rows = await all<Row>(
    `SELECT iccid, is_free_tier, created_at, installed_at
     FROM esims WHERE user_id = ? ORDER BY created_at DESC`,
    [user.id]
  );

  return (
    <>
      <section className="hero">
        <h1>My eSIMs</h1>
        <p>
          Every ad you watch tops up this same profile rather than issuing a new
          one, so you install once and keep using it. If you go about four months
          without topping up, the network reclaims the profile and we issue you a
          fresh one free on your next trip.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="card">
          <h2>Nothing here yet</h2>
          <p className="sub">
            Earn at least 100 MB and load it onto an eSIM, and we&apos;ll issue your
            profile then, not before. That way you never install something you
            haven&apos;t got data for.
          </p>
          <Link className="btn" href="/">
            Start earning
          </Link>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ICCID</th>
                <th>Type</th>
                <th>Issued</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.iccid}>
                  <td>
                    <code>{r.iccid}</code>
                  </td>
                  <td>
                    <span className={`badge ${r.is_free_tier ? "free" : ""}`}>
                      {r.is_free_tier ? "Free tier" : "Paid"}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted)" }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ color: "var(--muted)" }}>
                    {r.installed_at ? "Installed" : "Not installed"}
                  </td>
                  <td className="num">
                    <Link href={`/esims/${r.iccid}`}>Install →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
