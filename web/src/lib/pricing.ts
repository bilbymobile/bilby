/**
 * Region-weighted ad-to-data exchange engine.
 *
 * This is the core commercial IP of the free tier and the single thing that
 * separates a survivable ad-funded eSIM from one that dies at scale.
 *
 * Firsty and every clone use a FLAT exchange rate: one rewarded ad view buys a
 * fixed 20 MB (or a fixed 30 minutes) no matter where the user is standing.
 * That is a structural bug, because both sides of the trade move independently:
 *
 *   - Rewarded-video eCPM varies ~6x by market. Tier 1 (AU/US/UK/CA/DE/FR/JP)
 *     runs USD 15-30 eCPM; emerging markets run USD 2-6, with fill rates
 *     dropping from ~90% to ~55% on top of that.
 *   - Wholesale roaming data varies ~5x by region. Southeast Asia is
 *     USD 0.40-0.80/GB; Oceania is USD 1.20-2.20/GB; Sub-Saharan Africa is
 *     USD 1.50-2.80/GB.
 *
 * A flat rate therefore prints money in Vietnam and bleeds cash in Fiji, and
 * you cannot see which is happening from an aggregate P&L. We instead solve
 * for MB on every single grant:
 *
 *     grantMb = (effectiveRevenuePerView * (1 - targetContributionMargin))
 *               / costPerMb(region, volumeTier)
 *
 * so that every ad view is contribution-positive by construction, everywhere,
 * on day one. The user-visible number moves (30 MB in Bangkok, 8 MB in Suva)
 * but it is never a number that loses money.
 *
 * All rates below are seed values from published 2026 benchmarks. Replace them
 * with your own AdMob reporting and your own signed supplier rate card as soon
 * as you have 30 days of real data — the whole point of this module is that it
 * is one table to edit, not logic scattered through the app.
 */

export type Region =
  | "western_europe"
  | "north_america"
  | "southeast_asia"
  | "east_asia"
  | "south_asia"
  | "mena"
  | "sub_saharan_africa"
  | "latin_america"
  | "oceania";

/** Supplier volume tier. Drives your wholesale cost per GB. */
export type VolumeTier = "starter" | "growth" | "scale" | "enterprise";

/**
 * Wholesale cost in USD per GB, by region and volume tier.
 *
 * Regional ranges are 2026 published benchmarks; the tier multiplier reflects
 * the standard reseller ladder (<500 activations/mo through 10k+). We store the
 * PESSIMISTIC end of each published range on purpose: if you model the free
 * tier on the optimistic end and your supplier quotes the other end, every
 * grant you have already made is retroactively loss-making.
 */
const WHOLESALE_USD_PER_GB: Record<Region, number> = {
  southeast_asia: 0.8,
  western_europe: 1.1,
  latin_america: 1.3,
  north_america: 1.4,
  east_asia: 1.5,
  south_asia: 1.0,
  mena: 1.8,
  oceania: 2.2,
  sub_saharan_africa: 2.8,
};

/** Multiplier applied to the base rate as your monthly volume grows. */
const TIER_MULTIPLIER: Record<VolumeTier, number> = {
  starter: 1.0, // <500 activations/mo — you pay rack rate
  growth: 0.78, // 500-2,000
  scale: 0.58, // 2,000-10,000
  enterprise: 0.4, // 10,000+
};

/**
 * Rewarded-video eCPM (USD per 1,000 completed views) and fill rate by region.
 *
 * eCPM alone is a vanity number. What you actually bank is
 * `ecpm / 1000 * fillRate`, because an unfilled ad request still costs you a
 * user who expected data and did not get it. We carry both.
 */
const AD_MARKET: Record<Region, { ecpmUsd: number; fillRate: number }> = {
  oceania: { ecpmUsd: 18.0, fillRate: 0.9 }, // AU/NZ — Tier 1
  north_america: { ecpmUsd: 22.0, fillRate: 0.92 },
  western_europe: { ecpmUsd: 16.0, fillRate: 0.88 },
  east_asia: { ecpmUsd: 14.0, fillRate: 0.85 },
  mena: { ecpmUsd: 7.0, fillRate: 0.7 },
  latin_america: { ecpmUsd: 4.5, fillRate: 0.65 },
  southeast_asia: { ecpmUsd: 4.0, fillRate: 0.62 },
  south_asia: { ecpmUsd: 2.5, fillRate: 0.58 },
  sub_saharan_africa: { ecpmUsd: 2.0, fillRate: 0.55 },
};

/**
 * Contribution margin retained on every ad-funded grant.
 *
 * 0.35 means: of the money an ad view actually earns, 65% is spent on data and
 * 35% is kept. That 35% is not profit — it is the buffer that pays for
 * payment fees, refunds, support, the ~30-day gap between AdMob accruing your
 * revenue and AdMob paying it, and the fact that your measured eCPM will drop
 * the first time you scale past your seed audience.
 *
 * Do not set this below 0.25 while you are pre-revenue. It is the difference
 * between "the free tier is marketing spend I control" and "the free tier is an
 * uncapped liability".
 */
export const TARGET_CONTRIBUTION_MARGIN = 0.35;

/** ISO-3166 alpha-2 to region. Extend freely; unknown codes fall back. */
const COUNTRY_TO_REGION: Record<string, Region> = {
  AU: "oceania", NZ: "oceania", FJ: "oceania", PG: "oceania", NC: "oceania",
  US: "north_america", CA: "north_america", MX: "latin_america",
  GB: "western_europe", IE: "western_europe", FR: "western_europe",
  DE: "western_europe", ES: "western_europe", IT: "western_europe",
  PT: "western_europe", NL: "western_europe", BE: "western_europe",
  CH: "western_europe", AT: "western_europe", SE: "western_europe",
  NO: "western_europe", DK: "western_europe", FI: "western_europe",
  GR: "western_europe", PL: "western_europe", CZ: "western_europe",
  JP: "east_asia", KR: "east_asia", CN: "east_asia", TW: "east_asia",
  HK: "east_asia", MO: "east_asia",
  TH: "southeast_asia", VN: "southeast_asia", ID: "southeast_asia",
  MY: "southeast_asia", SG: "southeast_asia", PH: "southeast_asia",
  KH: "southeast_asia", LA: "southeast_asia", MM: "southeast_asia",
  IN: "south_asia", LK: "south_asia", NP: "south_asia", BD: "south_asia",
  PK: "south_asia", MV: "south_asia",
  AE: "mena", SA: "mena", QA: "mena", TR: "mena", EG: "mena",
  IL: "mena", JO: "mena", MA: "mena",
  BR: "latin_america", AR: "latin_america", CL: "latin_america",
  PE: "latin_america", CO: "latin_america", CR: "latin_america",
  ZA: "sub_saharan_africa", KE: "sub_saharan_africa",
  TZ: "sub_saharan_africa", NG: "sub_saharan_africa",
};

export function regionForCountry(iso2: string): Region {
  // Unknown country codes resolve to the most expensive region rather than the
  // cheapest. A wrong guess should shrink the grant, never inflate it.
  return COUNTRY_TO_REGION[iso2.toUpperCase()] ?? "sub_saharan_africa";
}

/** Wholesale cost of one MB, in USD, for a region at a given volume tier. */
export function costPerMb(region: Region, tier: VolumeTier): number {
  return (WHOLESALE_USD_PER_GB[region] * TIER_MULTIPLIER[tier]) / 1024;
}

/** What one completed rewarded view is actually worth, after fill. */
export function revenuePerView(region: Region): number {
  const m = AD_MARKET[region];
  return (m.ecpmUsd / 1000) * m.fillRate;
}

export interface GrantQuote {
  region: Region;
  grantMb: number;
  revenuePerViewUsd: number;
  dataCostUsd: number;
  contributionUsd: number;
  /** True when the trade is so thin that we clamp instead of granting honestly. */
  clamped: boolean;
}

/**
 * Minimum grant we are willing to show a user. Below ~5 MB the reward stops
 * feeling like a reward and the user churns, which costs more than the data.
 */
const MIN_GRANT_MB = 5;

/**
 * Maximum grant per view. Caps blast radius if an eCPM figure in the table
 * above is ever wrong by an order of magnitude, or if a supplier rate is
 * mis-entered as 0.
 */
const MAX_GRANT_MB = 60;

/**
 * Solve for the MB we can hand out for one rewarded view in a given country
 * while retaining the target contribution margin.
 */
export function quoteGrant(
  iso2: string,
  tier: VolumeTier = "starter"
): GrantQuote {
  const region = regionForCountry(iso2);
  const revenue = revenuePerView(region);
  const budget = revenue * (1 - TARGET_CONTRIBUTION_MARGIN);
  const perMb = costPerMb(region, tier);

  const raw = budget / perMb;
  const grantMb = Math.max(MIN_GRANT_MB, Math.min(MAX_GRANT_MB, Math.floor(raw)));
  const clamped = grantMb !== Math.floor(raw);

  const dataCost = grantMb * perMb;

  return {
    region,
    grantMb,
    revenuePerViewUsd: round(revenue, 5),
    dataCostUsd: round(dataCost, 5),
    contributionUsd: round(revenue - dataCost, 5),
    clamped,
  };
}

/**
 * Countries where the free tier is allowed to run at all.
 *
 * A grant clamped at MIN_GRANT_MB is by definition loss-making — we floored it
 * for UX reasons, not economic ones. Rather than quietly bleed in those markets
 * we return them here so the app can show a paid-only experience instead.
 * This is the switch that keeps a viral free tier from becoming an uncapped
 * liability the week a travel influencer finds you.
 */
export function freeTierAllowed(iso2: string, tier: VolumeTier = "starter"): boolean {
  const q = quoteGrant(iso2, tier);
  return q.contributionUsd > 0 && !q.clamped;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/* ------------------------------------------------------------------------ *
 * The traveller arbitrage
 * ------------------------------------------------------------------------ */

/**
 * Quote a grant for a TRAVELLER rather than a resident.
 *
 * This is the most valuable idea in this file, and it falls straight out of the
 * regional table above once you look at it the right way.
 *
 * Run `quoteAllRegions("starter")` and the ad-funded free tier is viable in
 * exactly four regions — North America, Western Europe, East Asia, and (once
 * you have volume) Oceania. It is underwater everywhere else. Which reads like
 * a death sentence for a travel product, because the destinations Australians
 * actually fly to most are Indonesia, Thailand, Vietnam and Japan.
 *
 * But the two sides of the trade are not driven by the same thing:
 *
 *   - DATA COST is set by where the handset physically is. A megabyte consumed
 *     in Bali costs Southeast Asia rates. Nothing changes that.
 *   - AD REVENUE is set by who the advertiser thinks they are buying. Bid
 *     density follows the audience's commercial value — locale, language,
 *     app-store account country, device tier, historical signals — not purely
 *     the IP the request came from.
 *
 * An Australian in Bali is therefore a Tier-1 audience consuming Tier-3-cost
 * data. That gap is not a rounding error; on the seeded numbers it is the
 * difference between -$0.0014 and +$0.011 of contribution per view. It is the
 * single strongest argument for targeting OUTBOUND travellers from a
 * high-eCPM market rather than building a general-purpose global free eSIM.
 *
 * IMPORTANT — this is a hypothesis with a real number attached, not a
 * measurement. How much of the home-market eCPM actually survives being served
 * to a device sitting on an Indonesian IP is an empirical question that only
 * your own AdMob reporting can answer. `HOME_MARKET_RETENTION` below is the
 * knob, deliberately set pessimistic. Measure it in week one:
 *
 *   1. Segment AdMob reporting by device country vs app-store country.
 *   2. Compare realised eCPM for AU-account users abroad against local users.
 *   3. Set HOME_MARKET_RETENTION to what you measure, not what you hope.
 *
 * If retention turns out to be near zero, this function degrades exactly to
 * `quoteGrant` and you have lost nothing. If it is even 0.5, the free tier
 * works across all of Southeast Asia and the business is a different shape.
 */
export const HOME_MARKET_RETENTION = Number(
  process.env.HOME_MARKET_RETENTION ?? "0.4"
);

export interface TravellerQuote extends GrantQuote {
  homeRegion: Region;
  destinationRegion: Region;
  /** Where the handset physically is while watching the ad. */
  servedRegion: Region;
  /** Blended revenue actually assumed for this traveller. */
  blendedRevenuePerViewUsd: number;
  /** Grant the same person would get with naive destination-only pricing. */
  naiveGrantMb: number;
}

/* ------------------------------------------------------------------------ *
 * Three countries, not two
 * ------------------------------------------------------------------------ */

/**
 * The original model conflated two different questions into one country code,
 * and that conflation is what killed the product at the departure gate.
 *
 * There are actually THREE locations in play, and they answer different things:
 *
 *   HOME        — who the advertiser thinks they are buying. Set once, at
 *                 signup, never updated. Drives the ceiling on ad value.
 *   CURRENT     — where the handset physically is when the ad plays. This is
 *                 what the ad exchange sees, so it sets the floor on ad value.
 *   DESTINATION — where the megabytes will actually be consumed. This, and
 *                 only this, sets the cost.
 *
 * Collapsing CURRENT and DESTINATION into one value meant a Sydney user
 * planning a trip to Tokyo was priced as though they were consuming Australian
 * roaming data — the second most expensive region on earth, where the free tier
 * is switched off entirely. So the app told them free data was unavailable in
 * their country, in the exact week they were most motivated to install it, and
 * on the only connection reliable enough to download an eSIM profile.
 *
 * Separating them does more than fix a bug. When CURRENT equals HOME, the
 * blend below collapses to the full home-market rate with no retention
 * discount at all — and correctly so: an Australian watching an Australian ad
 * on an Australian IP is not a hypothesis about how much eCPM survives
 * roaming, it is simply an Australian ad impression. Earning before you fly is
 * therefore both cheaper for us and larger for the user, at the same time.
 * See `compareDestination()` for the size of that gap.
 */
export interface EarningContext {
  /** Signup market. Immutable. */
  homeIso: string;
  /** Where the handset is right now. From the CDN geo header. */
  currentIso: string;
  /** Where the data will be used. Chosen by the user. */
  destinationIso: string;
  tier?: VolumeTier;
}

export function quoteEarning({
  homeIso,
  currentIso,
  destinationIso,
  tier = "starter",
}: EarningContext): TravellerQuote {
  const homeRegion = regionForCountry(homeIso);
  const servedRegion = regionForCountry(currentIso);
  const destRegion = regionForCountry(destinationIso);

  const homeRev = revenuePerView(homeRegion);
  const servedRev = revenuePerView(servedRegion);

  // Floor is whatever the ad genuinely fetches where the device is standing;
  // we only ever ADD the portion of the home-market premium we believe
  // survives. When served region === home region the two terms are equal and
  // this is just the home rate — no hypothesis involved.
  const blended = Math.max(
    servedRev,
    servedRev + (homeRev - servedRev) * HOME_MARKET_RETENTION
  );

  // Cost follows the destination and nothing else. A megabyte consumed in Bali
  // costs Southeast Asia rates regardless of where it was earned.
  const perMb = costPerMb(destRegion, tier);
  const budget = blended * (1 - TARGET_CONTRIBUTION_MARGIN);

  const raw = budget / perMb;
  const grantMb = Math.max(MIN_GRANT_MB, Math.min(MAX_GRANT_MB, Math.floor(raw)));
  const clamped = grantMb !== Math.floor(raw);
  const dataCost = grantMb * perMb;

  return {
    region: destRegion,
    homeRegion,
    servedRegion,
    destinationRegion: destRegion,
    grantMb,
    naiveGrantMb: quoteGrant(destinationIso, tier).grantMb,
    revenuePerViewUsd: round(servedRev, 5),
    blendedRevenuePerViewUsd: round(blended, 5),
    dataCostUsd: round(dataCost, 5),
    contributionUsd: round(blended - dataCost, 5),
    clamped,
  };
}

/** Free tier availability for a specific earning context. */
export function freeTierAllowedForEarning(ctx: EarningContext): boolean {
  const q = quoteEarning(ctx);
  return q.contributionUsd > 0 && !q.clamped;
}

export interface DestinationComparison {
  destinationIso: string;
  /** Grant per ad while still in the home market, before departure. */
  atHomeMb: number;
  /** Grant per ad once the handset is actually at the destination. */
  onArrivalMb: number;
  atHomeAllowed: boolean;
  onArrivalAllowed: boolean;
  /** True when the free tier only works if they bank before they fly. */
  bankBeforeYouFly: boolean;
}

/**
 * The two numbers the destination picker shows.
 *
 * `bankBeforeYouFly` is the interesting one: for several destinations the free
 * tier is viable ONLY if the user earns at home first, because the ad revenue
 * available in-country cannot fund a usable grant. Rather than switch those
 * destinations off, we tell the user to stock up before departure — which is
 * the behaviour we wanted anyway, since it is also the only moment they
 * reliably have the Wi-Fi needed to install an eSIM profile.
 */
export function compareDestination(
  homeIso: string,
  destinationIso: string,
  tier: VolumeTier = "starter"
): DestinationComparison {
  const atHome = quoteEarning({
    homeIso,
    currentIso: homeIso,
    destinationIso,
    tier,
  });
  const onArrival = quoteEarning({
    homeIso,
    currentIso: destinationIso,
    destinationIso,
    tier,
  });

  const atHomeAllowed = atHome.contributionUsd > 0 && !atHome.clamped;
  const onArrivalAllowed = onArrival.contributionUsd > 0 && !onArrival.clamped;

  return {
    destinationIso,
    atHomeMb: atHome.grantMb,
    onArrivalMb: onArrival.grantMb,
    atHomeAllowed,
    onArrivalAllowed,
    bankBeforeYouFly: atHomeAllowed && !onArrivalAllowed,
  };
}

/**
 * Back-compat wrapper: the traveller has already arrived, so current country
 * and destination are the same. Every existing caller means this.
 */
export function quoteTravellerGrant(
  homeIso: string,
  destinationIso: string,
  tier: VolumeTier = "starter"
): TravellerQuote {
  return quoteEarning({
    homeIso,
    currentIso: destinationIso,
    destinationIso,
    tier,
  });
}

/** Free tier availability for a traveller, using the blended rate. */
export function freeTierAllowedForTraveller(
  homeIso: string,
  destinationIso: string,
  tier: VolumeTier = "starter"
): boolean {
  const q = quoteTravellerGrant(homeIso, destinationIso, tier);
  return q.contributionUsd > 0 && !q.clamped;
}

/**
 * The wholesale rate that would switch the free tier on for a destination.
 *
 * Written for supplier negotiations. "Can you do better on Oceania?" is a
 * question a rate desk can ignore; "we need to land under $2.15/GB on AU to
 * turn a free tier on, we're being quoted $2.20" is a question with a yes or a
 * no. It also tells you instantly whether a destination is one deal away or
 * structurally impossible — Australia is off by 2%, sub-Saharan Africa is off
 * by a factor of three, and those two facts deserve completely different
 * responses.
 *
 * Returns the USD/GB at which `grantMb` would reach MIN_GRANT_MB exactly, at
 * the given volume tier, for a traveller from `homeIso` earning at home.
 */
export function breakEvenUsdPerGb(
  homeIso: string,
  destinationIso: string,
  tier: VolumeTier = "starter"
): { requiredUsdPerGb: number; currentUsdPerGb: number; shortfallPct: number } {
  const homeRev = revenuePerView(regionForCountry(homeIso));
  const budget = homeRev * (1 - TARGET_CONTRIBUTION_MARGIN);

  // Solve budget / perMb >= MIN_GRANT_MB for perGb, then undo the tier
  // multiplier so the answer is quotable as a rack rate.
  const requiredPerMb = budget / MIN_GRANT_MB;
  const requiredUsdPerGb = (requiredPerMb * 1024) / TIER_MULTIPLIER[tier];

  const destRegion = regionForCountry(destinationIso);
  const currentUsdPerGb = WHOLESALE_USD_PER_GB[destRegion];

  return {
    requiredUsdPerGb: round(requiredUsdPerGb, 3),
    currentUsdPerGb,
    shortfallPct: round((currentUsdPerGb / requiredUsdPerGb - 1) * 100, 1),
  };
}

/**
 * Free-tier throughput cap, in kbps. 0 disables the cap.
 *
 * Borrowed from Firsty, who cap their free tier at 1 Mbps — and it is a cost
 * control wearing a UX costume. Megabytes leave via video, video needs
 * throughput, and a hard 1 Mbps ceiling makes the free tier excellent for maps,
 * messaging and boarding passes while being quietly useless for Netflix. That
 * shifts realised cost per granted MB down without reducing the number you get
 * to print on the button, which is the rare lever that improves the economics
 * and the offer at the same time.
 *
 * Enforced by the supplier at provisioning time, not by us — which means it is
 * a field on the plan you buy, and it belongs in the free-tier packet
 * definition. Surfaced here so the number lives with the rest of the
 * commercial model.
 */
export const FREE_TIER_SPEED_KBPS = Number(
  process.env.FREE_TIER_SPEED_KBPS ?? "1024"
);

/** Every region, quoted — used by the admin economics view. */
export function quoteAllRegions(tier: VolumeTier = "starter") {
  const sample: Record<Region, string> = {
    oceania: "AU",
    north_america: "US",
    western_europe: "GB",
    east_asia: "JP",
    mena: "AE",
    latin_america: "BR",
    southeast_asia: "TH",
    south_asia: "IN",
    sub_saharan_africa: "ZA",
  };
  return (Object.keys(sample) as Region[]).map((r) => ({
    sampleCountry: sample[r],
    ...quoteGrant(sample[r], tier),
  }));
}
