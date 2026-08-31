import { NextResponse } from "next/server";
import { currentUser, signUserId, effectiveDestination } from "@/lib/session";
import {
  DAILY_AD_CAP,
  REDEMPTION_THRESHOLD_MB,
  balanceMb,
  budgetStatus,
} from "@/lib/ledger";
import { one, all, today } from "@/lib/db";
import { quoteEarning, freeTierAllowedForEarning, compareDestination } from "@/lib/pricing";
import { destinationName } from "@/lib/destinations";
import { DEFAULT_VOLUME_TIER } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the client needs to render the earn screen in one round trip. */
export async function GET() {
  const user = await currentUser();
  const dest = effectiveDestination(user);

  // Three countries, three jobs: home sets the ceiling on ad value, country
  // sets the floor, destination sets the cost. See pricing.ts.
  const ctx = {
    homeIso: user.homeCountry,
    currentIso: user.country,
    destinationIso: dest,
    tier: DEFAULT_VOLUME_TIER,
  };
  const quote = quoteEarning(ctx);
  const comparison = compareDestination(user.homeCountry, dest, DEFAULT_VOLUME_TIER);
  const budget = await budgetStatus();

  const adsToday = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM credit_ledger
     WHERE user_id = ? AND reason = 'ad_reward' AND created_at >= ?`,
    [user.id, today() + "T00:00:00.000Z"]
  );
  const n = adsToday?.n ?? 0;

  const esims = await all(
    `SELECT iccid, is_free_tier, created_at, installed_at
     FROM esims WHERE user_id = ? ORDER BY created_at DESC`,
    [user.id]
  );

  const mb = await balanceMb(user.id);

  return NextResponse.json({
    // Signed id is what the Android SDK passes as AdMob's `user_id`, so the SSV
    // callback can attribute the reward without trusting the client.
    ssvUserId: signUserId(user.id),
    country: user.country,
    homeCountry: user.homeCountry,

    // ── Destination ──────────────────────────────────────────────────────
    // `destination` is null until the user has been through the picker, and
    // the app uses exactly that to decide whether to show it. Do not coalesce
    // this to a country code for tidiness — doing so would silently skip
    // first-run setup for every user, which is the bug this whole change
    // exists to fix.
    destination: user.destination,
    destinationName: destinationName(dest),
    needsDestination: user.destination === null,
    // Is the handset currently in the market it will use the data in? Drives
    // the "you're earning at home rates" framing.
    atHome: user.country === user.homeCountry,
    atHomeMbPerAd: comparison.atHomeMb,
    onArrivalMbPerAd: comparison.onArrivalMb,
    // True when the free tier for this destination only works if they stock up
    // before departure. Rendered as a nudge, not an error.
    bankBeforeYouFly: comparison.bankBeforeYouFly,

    balanceMb: mb,
    mbPerAd: quote.grantMb,
    // What destination-only pricing would have given — the visible size of the
    // traveller arbitrage, so you can watch it in the wild.
    naiveMbPerAd: quote.naiveGrantMb,
    adsWatchedToday: n,
    dailyAdCap: DAILY_AD_CAP,
    adsRemainingToday: Math.max(0, DAILY_AD_CAP - n),
    redemptionThresholdMb: REDEMPTION_THRESHOLD_MB,
    canRedeem: mb >= REDEMPTION_THRESHOLD_MB,
    // Deliberately TWO fields, not one boolean.
    //
    // "we don't serve your country" and "today's pool is spent" are different
    // facts with different fixes and different emotional weight. Collapsing
    // them meant that whenever the global cap tripped, an honesty-branded app
    // told every user in every country that their destination was unsupported
    // — which is false, and is the single message that would destroy the
    // differentiator fastest.
    regionSupported: freeTierAllowedForEarning(ctx),
    freeTierAvailable: freeTierAllowedForEarning(ctx) && !budget.exhausted,
    // Surfaced honestly rather than failing silently — a user who knows the
    // free pool is empty until tomorrow churns less than one whose ads
    // mysteriously stop crediting.
    budgetExhausted: budget.exhausted,
    esims,
  });
}
