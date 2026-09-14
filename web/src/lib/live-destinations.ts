/**
 * Which destinations can somebody actually buy today?
 *
 * ## Why this is not `DESTINATIONS.length`
 *
 * The landing page said "Land connected in 13 destinations" while one plan was
 * on sale. Both halves were defensible on their own: `DESTINATIONS` is the list
 * we can quote, price and provision, and the page derived the number rather
 * than typing it, which was the whole point of deriving it.
 *
 * But "can provision" and "is on sale" are different facts, and the sentence a
 * customer reads is a claim about the second one. Under Australian Consumer Law
 * that is a representation, and the fact that a code path produced it is not a
 * defence. A number that comes from a list of intentions is still a number
 * somebody typed, just earlier and further away.
 *
 * So this reads the catalogue. A destination appears when a SKU for it is
 * active and priced, and disappears when the last one is turned off. Nobody has
 * to remember to edit a page.
 *
 * ## It never throws
 *
 * The marketing site going down because Postgres hiccupped would be a worse
 * outcome than a page that is briefly vaguer than usual. On failure this
 * returns null, which callers read as "say nothing about how many" rather than
 * as zero. Claiming none is as wrong as claiming thirteen.
 */

import { DESTINATIONS, type Destination } from "./destinations";
import { distinctAttributeValues, listCatalog } from "./platform";
import { warn } from "./observe";

/**
 * Destinations with at least one active, priced SKU, in the order
 * `DESTINATIONS` declares.
 *
 * Ordering comes from the curated list rather than from the database, because
 * that order is an editorial decision about which destinations matter most to
 * an Australian traveller, and a query has no opinion about that.
 *
 * Returns null when the catalogue could not be read at all.
 */
export async function liveDestinations(): Promise<Destination[] | null> {
  try {
    const isos = new Set(
      (await distinctAttributeValues("esim", "AUD", "country")).map((c) =>
        c.toUpperCase(),
      ),
    );
    return DESTINATIONS.filter((d) => isos.has(d.iso.toUpperCase()));
  } catch (e) {
    await warn("catalog.liveDestinations", e);
    return null;
  }
}

/**
 * The headline, and the one pill under it that carries a number.
 *
 * ## The headline stopped naming the stock
 *
 * It used to end in the catalogue: "Land connected in Japan." with one
 * destination, "Land connected in 8 destinations." with eight. That was honest
 * and it was the wrong sentence, for a reason that only shows up later. A
 * headline is the one line a stranger repeats to somebody else, and a headline
 * built out of inventory rewrites itself every time a SKU is activated. At two
 * destinations it reads as a shop that has barely opened. At a hundred and
 * ninety it reads as a list. Neither is a brand.
 *
 * So the headline is fixed and says what the product is for, and the numbers
 * move underneath it, in the pill and in the counters, where a number changing
 * is information rather than an identity crisis.
 *
 * ## The pill still tells the truth about stock
 *
 * Three shapes, because "1 destinations" is wrong and "0 destinations" is worse
 * than saying nothing:
 *
 *   null  ->  no pill
 *   []    ->  no pill
 *   [JP]  ->  "Japan"
 *   many  ->  "8 destinations"
 *
 * Naming the single destination is not a workaround for bad grammar, it is
 * better copy. "1 destination" reads as a shop that has not opened; "Japan"
 * reads as a shop that sells Japan, which is the truth and is worth saying.
 */
export function heroClaim(live: Destination[] | null): {
  /** The full headline, already split at the line break the design wants. */
  line1: string;
  line2: string;
  /** Short label for the pill, or null when there is nothing honest to put there. */
  pill: string | null;
} {
  const line1 = "Hop the";
  const line2 = "planet.";

  if (!live || live.length === 0) return { line1, line2, pill: null };
  if (live.length === 1) return { line1, line2, pill: live[0].name };
  return { line1, line2, pill: `${live.length} destinations` };
}

/**
 * The cheapest real price, per destination and overall.
 *
 * ## Why the landing page is allowed to show prices now
 *
 * It was not, and the section saying so was correct at the time: there was no
 * rate card, so any number would have been a guess wearing a dollar sign. That
 * has changed. The catalogue holds activated SKUs with prices somebody set, and
 * a price that has been set is a price we will honour.
 *
 * What has not changed is where the number comes from. Nobody types a price
 * into a marketing page. This reads the same rows the shop charges from, so the
 * page and the till can never disagree, and a price change in the console moves
 * the landing page without anyone remembering to.
 *
 * ## One query, not one per country
 *
 * The obvious shape is a loop over destinations asking for each one's cheapest
 * plan. On a page that renders at build time that is thirteen round trips to
 * Sydney to answer a question one query answers, and it grows with the
 * catalogue. So: pull the active priced eSIM rows once and reduce them here.
 *
 * ## It never throws
 *
 * Same contract as `liveDestinations`. On failure the caller gets nulls and
 * says nothing about price, which is the honest degradation. A marketing page
 * that 500s because Postgres hiccupped is worse than one that is briefly vaguer
 * than usual.
 */
export interface Shopfront {
  /** Live destinations, cheapest first price attached, in curated order. */
  destinations: Array<Destination & { fromAmount: number }>;
  /**
   * Does anything on sale slow down after a daily allowance?
   *
   * The landing page promised "full speed throughout, no throttle after a
   * hidden allowance" while fourteen of the fifty two active SKUs throttled to
   * 384 or 512 Kbps after a daily cap, and said so in their own subtitles two
   * clicks away. Neither sentence was written to mislead. They were written
   * months apart and nobody reread one while editing the other, which is how
   * every claim like this breaks.
   *
   * So the page asks the catalogue instead of remembering.
   */
  anyThrottled: boolean;
  /**
   * Does anything on sale route the traffic out through an overseas exit point?
   *
   * Every SKU seeded so far does. It is a real product difference: it breaks
   * Australian banking apps and geo checked streaming, the checkout page warns
   * about it, and the plan subtitle says it. The landing page was describing
   * the same plans as "local networks, full speed".
   */
  anyRoutedOverseas: boolean;
  /**
   * The cheapest plan anywhere in the catalogue, or null if nothing is on sale.
   *
   * In major units. `catalog_prices.sell_amount` is NUMERIC dollars, not cents,
   * and the first version of this treated it as cents: the hero rendered
   * "$0.03" for a $2.95 plan, and it rendered it confidently, because nothing
   * about a number is self describing. The unit is now named in the field, in
   * the formatter, and in a check.
   */
  fromAmount: number | null;
  /** How many activated, priced SKUs there are. */
  planCount: number;
  currency: string;
}

export async function liveShopfront(currency = "AUD"): Promise<Shopfront | null> {
  try {
    const items = await listCatalog("esim", currency);

    // Cheapest per country. The attribute is read defensively because a SKU
    // written by a supplier sync is not required to have every field a curated
    // SKU has, and a missing country must drop the row rather than throw the
    // whole page away.
    const cheapest = new Map<string, number>();
    for (const it of items) {
      const iso = String(it.attributes.country ?? "").toUpperCase();
      if (!iso) continue;
      const now = cheapest.get(iso);
      if (now === undefined || it.sellAmount < now) cheapest.set(iso, it.sellAmount);
    }

    const destinations = DESTINATIONS.flatMap((d) => {
      const c = cheapest.get(d.iso.toUpperCase());
      return c === undefined ? [] : [{ ...d, fromAmount: c }];
    });

    const all = [...cheapest.values()];
    return {
      destinations,
      fromAmount: all.length ? Math.min(...all) : null,
      planCount: items.length,
      // Read off the rows rather than off a memory of what we seeded. A plan
      // that throttles carries a daily cap; one that breaks out locally is
      // marked "local" and anything else leaves the destination country.
      anyThrottled: items.some((i) => i.attributes.daily === true),
      anyRoutedOverseas: items.some((i) => String(i.attributes.routing ?? "") !== "local"),
      currency,
    };
  } catch (e) {
    await warn("catalog.liveShopfront", e);
    return null;
  }
}

/**
 * A stored price to something a person reads.
 *
 * The argument is in MAJOR units, which is how `catalog_prices.sell_amount` is
 * stored: 4.95 means four dollars ninety five. It is worth saying twice because
 * the alternative convention is common enough that assuming it is the natural
 * mistake, and the mistake is silent. A hero reading "$0.05" looks like a
 * deliberate loss leader, not like a bug.
 *
 * Whole dollars lose the ".00" because "$5" is what a price tag says and
 * "$5.00" is what a receipt says, and the hero is a price tag.
 */
export function money(amount: number, currency = "AUD"): string {
  const body = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return currency === "AUD" ? `$${body}` : `${body} ${currency}`;
}
