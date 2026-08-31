import { paidSupplier } from "@/lib/suppliers";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TARGET_MARGIN = Number(process.env.RETAIL_TARGET_MARGIN ?? "0.45");

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const user = await currentUser();
  const iso = (country ?? "JP").toUpperCase();

  let plans: Array<{
    planId: string;
    name: string;
    dataMb: number;
    validityDays: number;
    retailUsd: number;
    perGbUsd: number | null;
  }> = [];
  let error: string | null = null;

  try {
    const raw = await paidSupplier().listPlans({ country: iso });
    plans = raw
      .filter((p) => p.dataMb >= 1024) // micro packets are free-tier plumbing, not retail
      .map((p) => {
        const retail = Math.max(p.wholesaleUsd / (1 - TARGET_MARGIN), p.minSellUsd ?? 0);
        return {
          planId: p.planId,
          name: p.name,
          dataMb: p.dataMb,
          validityDays: p.validityDays,
          retailUsd: Math.round(retail * 100) / 100,
          perGbUsd: p.dataMb ? Math.round((retail / (p.dataMb / 1024)) * 100) / 100 : null,
        };
      })
      .sort((a, b) => a.retailUsd - b.retailUsd);
  } catch (e) {
    error = (e as Error).message;
  }

  const popular = ["JP", "TH", "ID", "US", "GB", "IT", "VN", "SG", "AE", "NZ"];

  return (
    <>
      <section className="hero">
        <h1>Plans</h1>
        <p>
          Full speed, no ads, hotspot included. Buy one only for the days you
          actually need it. The free tier covers maps and messaging the rest of
          the time.
        </p>
      </section>

      <div className="card">
        <h2>Destination</h2>
        <p className="sub">Showing {iso}. Detected home market: {user.country}.</p>
        <div className="row">
          {popular.map((c) => (
            <a key={c} className={`btn ${c === iso ? "" : "ghost"}`} href={`/plans?country=${c}`}>
              {c}
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        {error ? (
          <div className="note bad">
            Catalogue unavailable: {error}
            <br />
            With no supplier configured the app falls back to the mock, so check
            <code className="inline"> PAID_SUPPLIER</code> in your env.
          </div>
        ) : plans.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>No plans for {iso}.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th className="num">Data</th>
                <th className="num">Days</th>
                <th className="num">Price</th>
                <th className="num">Per GB</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.planId}>
                  <td>{p.name}</td>
                  <td className="num">{(p.dataMb / 1024).toFixed(0)} GB</td>
                  <td className="num">{p.validityDays}</td>
                  <td className="num">
                    <strong>${p.retailUsd.toFixed(2)}</strong>
                  </td>
                  <td className="num" style={{ color: "var(--muted)" }}>
                    ${p.perGbUsd?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>A note on where you take payment</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          Google Play&apos;s Payments policy exempts purchases consumed outside a
          Play-distributed app, and mobile connectivity is consumed by the
          handset&apos;s modem rather than inside this app, which is the basis on
          which eSIM apps take card payments directly. It is an interpretation,
          not a written carve-out for eSIMs, so keep checkout on the web, link to
          it rather than embedding it, and never gate app features behind the
          purchase. That last part is what turns a data plan into an in-app
          digital good.
        </p>
      </div>
    </>
  );
}
