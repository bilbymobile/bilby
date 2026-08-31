import { budgetStatus, realisedEconomics, DEFAULT_VOLUME_TIER } from "@/lib/ledger";
import { quoteAllRegions, TARGET_CONTRIBUTION_MARGIN } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * Operator view.
 *
 * In production put this behind auth. It is here, unauthenticated, because the
 * numbers on it are the ones you must look at every single day of the first
 * six months, and a dashboard you have to log into is a dashboard you stop
 * opening.
 */
export default async function OpsPage() {
  const budget = await budgetStatus();
  const all = await realisedEconomics();
  const quotes = quoteAllRegions(DEFAULT_VOLUME_TIER);

  const spentPct = budget.capUsd ? (budget.spentUsd / budget.capUsd) * 100 : 0;

  return (
    <>
      <section className="hero">
        <h1>Ops</h1>
        <p>
          Free-tier exposure, realised contribution, and the ad-to-data exchange
          rate the engine is currently quoting in each region.
        </p>
      </section>

      <div className="grid two">
        <div className="card">
          <h2>Today&apos;s free-data budget</h2>
          <p className="sub">
            Hard ceiling on ad-funded data. When it&apos;s hit, the free tier
            degrades gracefully; paid is untouched.
          </p>
          <div className="balance">
            <span className="n">${budget.spentUsd.toFixed(2)}</span>
            <span className="u">of ${budget.capUsd.toFixed(2)}</span>
          </div>
          <div className="meter">
            <i style={{ width: `${Math.min(100, spentPct)}%` }} />
          </div>
          <p className="sub" style={{ margin: 0, fontSize: 13 }}>
            {budget.exhausted
              ? "Exhausted — free grants paused until 00:00 UTC."
              : `$${budget.remainingUsd.toFixed(2)} remaining.`}
          </p>
        </div>

        <div className="card">
          <h2>Realised contribution</h2>
          <p className="sub">
            Ad revenue accrued, minus data actually bought. Breakage is credit
            earned but never redeemed — at low volume it is most of the margin.
          </p>
          <div className="stat-row">
            <div className="stat">
              <span className="k">Ad revenue</span>
              <span className="v">${all.adRevenueUsd.toFixed(4)}</span>
            </div>
            <div className="stat">
              <span className="k">Effective cost</span>
              <span className="v">${all.effectiveCostUsd.toFixed(4)}</span>
            </div>
            <div className="stat">
              <span className="k">Contribution</span>
              <span
                className="v"
                style={{ color: all.contributionUsd >= 0 ? "var(--accent)" : "var(--danger)" }}
              >
                ${all.contributionUsd.toFixed(4)}
              </span>
            </div>
            <div className="stat">
              <span className="k">Breakage</span>
              <span className="v">{(all.breakageRate * 100).toFixed(0)}%</span>
            </div>
            <div className="stat">
              <span className="k">Views</span>
              <span className="v">{all.rewardedViews}</span>
            </div>
          </div>
          {all.contributionUsd < 0 && (
            <div className="note bad">
              Negative contribution. Raise TARGET_CONTRIBUTION_MARGIN or correct
              the rate table in <code className="inline">pricing.ts</code> before
              you scale spend.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Ad-to-data exchange rate by region</h2>
        <p className="sub">
          Volume tier <strong>{DEFAULT_VOLUME_TIER}</strong> · retaining{" "}
          {(TARGET_CONTRIBUTION_MARGIN * 100).toFixed(0)}% of ad revenue.
          &ldquo;Clamped&rdquo; means the honest grant fell below the 5 MB UX
          floor — those regions are served paid-only.
        </p>
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th className="num">Rev / view</th>
              <th className="num">Cost / MB</th>
              <th className="num">Grant</th>
              <th className="num">Contribution</th>
              <th className="num">Free tier</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.region}>
                <td>{q.region.replace(/_/g, " ")}</td>
                <td className="num">${q.revenuePerViewUsd.toFixed(4)}</td>
                <td className="num">${(q.dataCostUsd / q.grantMb).toFixed(5)}</td>
                <td className="num">
                  <strong>{q.grantMb} MB</strong>
                </td>
                <td
                  className="num"
                  style={{ color: q.contributionUsd > 0 ? "var(--accent)" : "var(--danger)" }}
                >
                  ${q.contributionUsd.toFixed(4)}
                </td>
                <td className="num">
                  {q.clamped || q.contributionUsd <= 0 ? (
                    <span className="badge">paid only</span>
                  ) : (
                    <span className="badge free">on</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
