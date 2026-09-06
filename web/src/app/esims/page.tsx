import Link from "next/link";
import { currentUser } from "@/lib/session";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Row {
  iccid: string;
  created_at: string;
  installed_at: string | null;
}

export default async function EsimsPage() {
  const user = await currentUser();
  const rows = await all<Row>(
    `SELECT iccid, created_at, installed_at
     FROM esims WHERE user_id = ? ORDER BY created_at DESC`,
    [user.id]
  );

  return (
    <>
      <section className="hero">
        <h1>My eSIMs</h1>
        <p>
          One profile per plan. Install it before you fly, on wifi, because
          installing an eSIM needs a working connection and the airport is the
          worst possible place to discover that.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="card">
          <h2>Nothing here yet</h2>
          <p className="sub">
            Your profile is issued when you buy a plan, not before. That way you
            never install something you have no data for.
          </p>
          <Link className="btn" href="/plans">
            See plans
          </Link>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ICCID</th>
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
