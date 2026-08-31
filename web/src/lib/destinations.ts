/**
 * The destination catalogue.
 *
 * One list, used by the web app, the API, and (mirrored in
 * `app/lib/destinations.dart`) the Android app. Adding a destination in two
 * places is how the picker and the plan catalogue drift apart, and a user who
 * can select a destination they cannot then buy a plan for has been lied to.
 *
 * This list is deliberately short. Every entry is a destination we can actually
 * quote, price and provision — not an aspirational map of the world. Extend it
 * when a supplier rate card covers the country, not before.
 */

export interface Destination {
  iso: string;
  name: string;
  /** Regional-indicator pair. Renders as a flag on iOS/Android; degrades to
   *  two letters on Windows, which is fine and better than a broken glyph. */
  flag: string;
  /** Shown under the name in the picker. Keep to one clause. */
  blurb?: string;
  /**
   * A caveat the user should see BEFORE they start earning, not after.
   * Anything that could make someone feel misled at the airport goes here.
   */
  caution?: string;
}

export const DESTINATIONS: Destination[] = [
  {
    iso: "JP",
    name: "Japan",
    flag: "🇯🇵",
    blurb: "Excellent coverage on all three networks",
  },
  {
    iso: "ID",
    name: "Indonesia",
    flag: "🇮🇩",
    blurb: "Bali, Jakarta, Lombok",
  },
  {
    iso: "TH",
    name: "Thailand",
    flag: "🇹🇭",
    blurb: "Cheapest data of any destination we cover",
  },
  {
    iso: "VN",
    name: "Vietnam",
    flag: "🇻🇳",
  },
  {
    iso: "SG",
    name: "Singapore",
    flag: "🇸🇬",
  },
  {
    iso: "CN",
    name: "China",
    flag: "🇨🇳",
    blurb: "Roaming data is carried on your profile home network",
    // Worth stating plainly, and worth understating. Travel eSIM traffic in
    // China is normally home-routed back through the issuing operator rather
    // than breaking out locally, which is why services that are unreachable on
    // a Chinese SIM usually still work. "Usually" is doing real work in that
    // sentence: routing is the supplier's decision, it can change without
    // notice, and we are not selling a circumvention tool. Promise the
    // mechanism, never the outcome.
    caution:
      "Because your data is carried back through the home network rather than "
      + "breaking out locally, apps that are unreachable on a local Chinese SIM "
      + "generally still work. We cannot guarantee it, because routing is set "
      + "by the network rather than by us, so please do not rely on it for "
      + "anything critical.",
  },
  {
    iso: "PK",
    name: "Pakistan",
    flag: "🇵🇰",
    blurb: "Karachi, Lahore, Islamabad",
    // Note what is NOT here: "stock up before you fly". That is true for
    // Pakistan today, but it is a consequence of the current rate card, not an
    // editorial fact — `compareDestination()` derives it, and the UI renders it
    // from the engine. If a supplier deal changes the arithmetic, the message
    // changes with it instead of sitting here going quietly stale.
    caution:
      "Check your handset supports eSIM before you start earning. Support is "
      + "less widespread on phones sold in the region than elsewhere.",
  },
  {
    iso: "AE",
    name: "UAE",
    flag: "🇦🇪",
    caution:
      "Voice and video calling over the internet is restricted on UAE networks, "
      + "and that restriction can apply to roaming traffic too.",
  },
  {
    iso: "US",
    name: "United States",
    flag: "🇺🇸",
  },
  {
    iso: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
  },
  {
    iso: "IT",
    name: "Italy",
    flag: "🇮🇹",
  },
  {
    iso: "AU",
    name: "Australia",
    flag: "🇦🇺",
    blurb: "Home. Earn here before you fly, or use it around the country",
    // Australia is in the list because a destination picker that cannot accept
    // "I'm staying here" is a picker that has already decided what your life
    // looks like. It is also the single most valuable market on the ad side —
    // the best eCPM of anywhere we serve.
    //
    // What stops it today is the supply side, and only just: at rack rate an
    // Australian ad view funds 4.9 MB against a 5 MB floor. Competitors run a
    // free tier here on enterprise-volume wholesale, not on a different idea.
    // `breakEvenUsdPerGb()` prints the exact rate that flips it on — take that
    // number into supplier conversations rather than asking for "better rates".
    //
    // Before flipping it: selling data CONSUMED in Australia to Australians is
    // a materially different regulatory product from outbound travel roaming,
    // and that difference is where carriage-service-provider registration and
    // emergency-call obligations live. Engineering cannot resolve that one.
    caution:
      "Free data is not switched on for Australia yet. An ad here earns well, "
      + "but home network data still costs more than it earns at our current "
      + "supply rates. You can still earn here for a trip somewhere else.",
  },
  {
    iso: "NZ",
    name: "New Zealand",
    flag: "🇳🇿",
    // The one destination where there is no arbitrage to have: New Zealand
    // shares Australia's region, so the ad is worth exactly what it is worth at
    // home while the data costs Oceania rates — the most expensive region we
    // serve after sub-Saharan Africa. The engine refuses it at starter volume
    // and will allow it once volume earns a real rate card. Left in the list on
    // purpose: it is a destination Australians actually fly to, and showing it
    // with an honest "paid plans only" beats omitting it and looking incomplete.
    caution:
      "Free data is not available for New Zealand yet. Trans Tasman roaming "
      + "costs more than an ad earns. Paid plans work normally.",
  },
];

const BY_ISO = new Map(DESTINATIONS.map((d) => [d.iso, d]));

export function destination(iso: string): Destination | undefined {
  return BY_ISO.get(iso.toUpperCase());
}

export function destinationName(iso: string): string {
  return BY_ISO.get(iso.toUpperCase())?.name ?? iso.toUpperCase();
}

/**
 * Whether a user-supplied destination is one we actually serve.
 *
 * The destination is client-supplied and it moves the exchange rate, so it is
 * exactly the kind of value that must be validated against an allowlist rather
 * than trusted. Without this, a crafted request could nominate the cheapest
 * data region on earth and mint megabytes at the best rate we offer.
 */
export function isSupportedDestination(iso: unknown): iso is string {
  return typeof iso === "string" && BY_ISO.has(iso.toUpperCase());
}
