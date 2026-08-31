import { one, run, tx, nowIso, today } from "./db";
import { quoteAllRegions, quoteEarning, compareDestination, type VolumeTier } from "./pricing";

/**
 * Credit ledger and free-tier spend control.
 *
 * Everything in this file exists because "free data" is an unbounded promise
 * and your supplier wallet is a bounded number. Four independent brakes sit
 * between a user tapping "watch ad" and money leaving your account:
 *
 *   1. Exactly-once ad crediting     — AdMob retries; a naive handler pays twice.
 *   2. Per-user daily cap            — bounds one user's take.
 *   3. Global daily budget           — bounds EVERY user's take. The real brake.
 *   4. Redemption threshold          — you buy data in supplier-sized units,
 *                                      not per-ad, so you never pay a per-order
 *                                      fee on a 20 MB purchase.
 *
 * Remove any one of these and the free tier is a hole in the bottom of the boat.
 */

export const DEFAULT_VOLUME_TIER: VolumeTier =
  (process.env.SUPPLIER_VOLUME_TIER as VolumeTier) ?? "starter";

/** Max rewarded views credited per user per UTC day. */
export const DAILY_AD_CAP = Number(process.env.DAILY_AD_CAP ?? "10");

/**
 * Global free-tier spend ceiling per UTC day, in USD.
 *
 * Set this to a number you could lose today without it mattering. On day one
 * that is single digits. It is not a growth target — it is a blast radius.
 */
export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? "5");

/**
 * MB a user must accumulate before we actually buy data from the supplier.
 *
 * Ads credit instantly (the user sees their balance move), but we only
 * transact with the supplier once the balance clears this bar. Two reasons:
 * per-order overhead makes 20 MB purchases uneconomic, and the delay means
 * users who install, farm three ads and never travel cost you exactly nothing.
 * Expect 40-60% of accrued credits to never be redeemed. That breakage is not
 * a bug — at starter volume tier it is most of your free-tier margin.
 */
export const REDEMPTION_THRESHOLD_MB = Number(
  process.env.REDEMPTION_THRESHOLD_MB ?? "50"
);

/**
 * INVARIANT: a new user must be able to reach the redemption threshold on the
 * day they install, in every region where the free tier is switched on.
 *
 * This is not a nicety. If the threshold is unreachable in one day, every new
 * user watches their full daily allowance of ads, receives nothing, and is told
 * to come back tomorrow. Day-1 retention on that is a rounding error, and you
 * never find out whether the rest of the product works.
 *
 * It is checked at module load rather than left as a comment because the bug is
 * invisible in development: an `.env.local` with a safe value hides a unsafe
 * default, and the broken version only appears on a fresh deploy where the env
 * var was never set. That is exactly what happened here — the default was 100
 * while every environment ran 50.
 */
export function assertThresholdReachable(tier: VolumeTier = DEFAULT_VOLUME_TIER) {
  const worst = quoteAllRegions(tier)
    .filter((q) => q.contributionUsd > 0 && !q.clamped)
    .reduce((min, q) => Math.min(min, q.grantMb), Infinity);

  if (!Number.isFinite(worst)) return; // free tier off everywhere; nothing to check

  const maxPerDay = worst * DAILY_AD_CAP;
  if (REDEMPTION_THRESHOLD_MB > maxPerDay) {
    throw new Error(
      `REDEMPTION_THRESHOLD_MB (${REDEMPTION_THRESHOLD_MB}) is unreachable in one day. ` +
        `Weakest enabled region grants ${worst} MB/ad x ${DAILY_AD_CAP} ads = ${maxPerDay} MB. ` +
        `New users would earn nothing on day one. Lower the threshold, raise the ad cap, ` +
        `or disable the free tier in that region.`
    );
  }
}

/**
 * The same invariant, asked the way a user actually experiences it.
 *
 * `assertThresholdReachable` checks regions. This checks the list of
 * destinations we put in front of people — which is the list that matters,
 * because a region being fine on average is no comfort to someone who picked
 * Pakistan off a menu we wrote.
 *
 * For each offered destination it asks: can a traveller from `homeIso` reach
 * the redemption threshold in one day, by earning at home OR after arriving?
 * A destination that fails both is one where the picker would cheerfully accept
 * a choice that can never pay out — the first-run screen promising something
 * the ledger will refuse.
 *
 * Returns the failures rather than throwing, because the right response is
 * usually to drop that destination from the catalogue or annotate it, not to
 * take the whole service down.
 */
export function unreachableDestinations(
  homeIso: string,
  destinationIsos: string[],
  tier: VolumeTier = DEFAULT_VOLUME_TIER
): { iso: string; bestMbPerDay: number }[] {
  return destinationIsos
    .map((iso) => {
      const c = compareDestination(homeIso, iso, tier);
      const best = Math.max(
        c.atHomeAllowed ? c.atHomeMb : 0,
        c.onArrivalAllowed ? c.onArrivalMb : 0
      );
      return { iso, bestMbPerDay: best * DAILY_AD_CAP };
    })
    .filter((r) => r.bestMbPerDay > 0 && r.bestMbPerDay < REDEMPTION_THRESHOLD_MB);
}

export interface GrantResult {
  ok: boolean;
  reason?: "duplicate" | "daily_cap" | "budget_exhausted" | "banned" | "region_blocked";
  grantedMb?: number;
  balanceMb?: number;
}

/**
 * Credit a verified rewarded-ad view.
 *
 * `adTransactionId` MUST be the transaction id from the ad network's
 * server-side callback, never a client-supplied value. See admob-ssv.ts.
 *
 * Note the signature: user id and transaction id, nothing else.
 *
 * It used to take a country, which meant every caller had to know which of the
 * three relevant countries to pass — and the SSV route, which is the only path
 * that can create credits, was passing the handset's current location as though
 * it were the destination. Reading all three from the row the grant is being
 * written against removes the chance of a caller getting it wrong, and there is
 * no round trip saved by passing them in: the function has to load the user to
 * check the ban flag anyway.
 */
export async function grantAdReward(
  userId: string,
  adTransactionId: string
): Promise<GrantResult> {
  const user = await one<{
    id: string;
    banned_at: string | null;
    country: string;
    home_country: string;
    destination: string | null;
  }>(
    `SELECT id, banned_at, country, home_country, destination
     FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return { ok: false, reason: "banned" };
  if (user.banned_at) return { ok: false, reason: "banned" };

  // Cost follows where the data will be USED; revenue follows where the ad was
  // actually served, lifted toward the home market by whatever premium survives
  // roaming. See pricing.ts: these are three separate countries, not one.
  const quote = quoteEarning({
    homeIso: user.home_country ?? user.country,
    currentIso: user.country,
    destinationIso: user.destination ?? user.country,
    tier: DEFAULT_VOLUME_TIER,
  });

  // A clamped quote means we floored the grant for UX and are now underwater.
  // Refuse rather than pay for goodwill we cannot afford. Checked before the
  // transaction opens, because there is no reason to hold a write connection
  // open to decide something that depends on nothing in the database.
  if (quote.clamped || quote.contributionUsd <= 0) {
    return { ok: false, reason: "region_blocked" };
  }

  return tx(async (t) => {
    // (1) Exactly once. The unique partial index is the real guarantee; this
    // check just returns a clean answer instead of a constraint violation.
    const dupe = await t.one("SELECT 1 AS x FROM credit_ledger WHERE reason = 'ad_reward' AND ref = ?", [
      adTransactionId,
    ]);
    if (dupe) return { ok: false, reason: "duplicate" } as GrantResult;

    // (2) Per user daily cap.
    const startOfDay = today() + "T00:00:00.000Z";
    const cnt = await t.one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM credit_ledger
       WHERE user_id = ? AND reason = 'ad_reward' AND created_at >= ?`,
      [userId, startOfDay]
    );
    if ((cnt?.n ?? 0) >= DAILY_AD_CAP) {
      return { ok: false, reason: "daily_cap" } as GrantResult;
    }

    // (3) Global budget. Reserved now, at grant time, rather than at redemption
    // time, because otherwise a whole day of grants can be issued before any of
    // them charges the budget.
    //
    // The UPDATE carries its own guard in the WHERE clause, so the check and
    // the decrement are one statement and cannot interleave. Doing it as a
    // SELECT then an UPDATE would let two concurrent callbacks both read a
    // budget with room and both spend it.
    await t.run(
      `INSERT INTO daily_budget (day, spent_usd, cap_usd)
       VALUES (?, 0, ?) ON CONFLICT(day) DO NOTHING`,
      [today(), DAILY_BUDGET_USD]
    );
    const reserved = await t.run(
      `UPDATE daily_budget SET spent_usd = spent_usd + ?
       WHERE day = ? AND spent_usd + ? <= cap_usd`,
      [quote.dataCostUsd, today(), quote.dataCostUsd]
    );
    if (reserved !== 1) return { ok: false, reason: "budget_exhausted" } as GrantResult;

    await t.run(
      `INSERT INTO credit_ledger
         (user_id, delta_mb, reason, ref, revenue_usd, cost_usd, region, created_at)
       VALUES (?, ?, 'ad_reward', ?, ?, ?, ?, ?)`,
      [
        userId,
        quote.grantMb,
        adTransactionId,
        quote.blendedRevenuePerViewUsd,
        quote.dataCostUsd,
        quote.region,
        nowIso(),
      ]
    );

    const bal = await t.one<{ mb: number }>(
      "SELECT COALESCE(SUM(delta_mb), 0) AS mb FROM credit_ledger WHERE user_id = ?",
      [userId]
    );

    return { ok: true, grantedMb: quote.grantMb, balanceMb: bal?.mb ?? 0 } as GrantResult;
  });
}

/** Current spendable MB for a user. A SUM, never a stored column. */
export async function balanceMb(userId: string): Promise<number> {
  const row = await one<{ mb: number }>(
    "SELECT COALESCE(SUM(delta_mb), 0) AS mb FROM credit_ledger WHERE user_id = ?",
    [userId]
  );
  return row?.mb ?? 0;
}

/** Consume MB when we actually provision data. Returns false if underfunded. */
export async function debitForRedemption(
  userId: string,
  mb: number,
  iccid: string
): Promise<boolean> {
  return tx(async (t) => {
    // Balance is read INSIDE the transaction on purpose. Reading it outside and
    // passing it in would let two concurrent redemptions each see the same
    // balance and both succeed, which is how a user spends the same megabytes
    // twice.
    const bal = await t.one<{ mb: number }>(
      "SELECT COALESCE(SUM(delta_mb), 0) AS mb FROM credit_ledger WHERE user_id = ?",
      [userId]
    );
    if ((bal?.mb ?? 0) < mb) return false;

    await t.run(
      `INSERT INTO credit_ledger
         (user_id, delta_mb, reason, ref, created_at)
       VALUES (?, ?, 'redemption', ?, ?)`,
      [userId, -mb, iccid, nowIso()]
    );
    return true;
  });
}

/**
 * Reverse a previously granted reward — fraud, chargeback, or an ad network
 * clawback. Inserts a negation rather than editing history.
 */
export async function reverseGrant(ledgerId: number, note = "fraud"): Promise<boolean> {
  const row = await one<{ user_id: string; delta_mb: number }>(
    "SELECT user_id, delta_mb FROM credit_ledger WHERE id = ?",
    [ledgerId]
  );
  if (!row) return false;

  await run(
    `INSERT INTO credit_ledger (user_id, delta_mb, reason, ref, created_at)
     VALUES (?, ?, 'reversal', ?, ?)`,
    [row.user_id, -row.delta_mb, `${ledgerId}:${note}`, nowIso()]
  );
  return true;
}

export interface BudgetStatus {
  day: string;
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  exhausted: boolean;
}

export async function budgetStatus(): Promise<BudgetStatus> {
  const day = today();
  const row = await one<{ spent_usd: number; cap_usd: number }>(
    "SELECT spent_usd, cap_usd FROM daily_budget WHERE day = ?",
    [day]
  );

  const spent = row?.spent_usd ?? 0;
  const cap = row?.cap_usd ?? DAILY_BUDGET_USD;
  return {
    day,
    spentUsd: round(spent, 4),
    capUsd: cap,
    remainingUsd: round(Math.max(0, cap - spent), 4),
    exhausted: spent >= cap,
  };
}

/** Contribution margin actually realised, from the ledger. Not a projection. */
export async function realisedEconomics(sinceIso?: string) {
  const since = sinceIso ?? "1970-01-01T00:00:00.000Z";
  const row = await one<{
    revenue: number;
    cost: number;
    granted_mb: number;
    redeemed_mb: number;
    views: number;
  }>(
      `SELECT
         COALESCE(SUM(revenue_usd), 0) AS revenue,
         COALESCE(SUM(cost_usd), 0)    AS cost,
         COALESCE(SUM(CASE WHEN reason='ad_reward' THEN delta_mb ELSE 0 END), 0) AS granted_mb,
         COALESCE(-SUM(CASE WHEN reason='redemption' THEN delta_mb ELSE 0 END), 0) AS redeemed_mb,
         COUNT(CASE WHEN reason='ad_reward' THEN 1 END) AS views
       FROM credit_ledger WHERE created_at >= ?`,
    [since]
  ) ?? { revenue: 0, cost: 0, granted_mb: 0, redeemed_mb: 0, views: 0 };

  const breakage =
    row.granted_mb > 0 ? 1 - row.redeemed_mb / row.granted_mb : 0;

  return {
    adRevenueUsd: round(row.revenue, 4),
    projectedDataCostUsd: round(row.cost, 4),
    // Unredeemed credits were reserved against budget but never bought. This is
    // the number that decides whether the free tier is actually viable.
    effectiveCostUsd: round(row.cost * (1 - breakage), 4),
    contributionUsd: round(row.revenue - row.cost * (1 - breakage), 4),
    grantedMb: row.granted_mb,
    redeemedMb: row.redeemed_mb,
    breakageRate: round(breakage, 4),
    rewardedViews: row.views,
  };
}

function round(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
