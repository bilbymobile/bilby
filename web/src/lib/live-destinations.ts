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
import { distinctAttributeValues } from "./platform";
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
 * How the hero sentence ends.
 *
 * Three shapes, because "1 destinations" is wrong and "0 destinations" is worse
 * than saying nothing:
 *
 *   null  ->  "Land connected, not hunting for wifi."
 *   []    ->  "Land connected, not hunting for wifi."
 *   [JP]  ->  "Land connected in Japan."
 *   many  ->  "Land connected in 8 destinations."
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
  if (!live || live.length === 0) {
    // Deliberately not "before you fly": the lede two lines below already says
    // that, and a headline that echoes the sentence under it reads like a
    // placeholder. This state is rare but it is reachable on a live site when
    // the catalogue cannot be read, so it has to stand on its own.
    return { line1: "Land connected,", line2: "not hunting for wifi.", pill: null };
  }
  if (live.length === 1) {
    return { line1: "Land connected in", line2: `${live[0].name}.`, pill: live[0].name };
  }
  return {
    line1: "Land connected in",
    line2: `${live.length} destinations.`,
    pill: `${live.length} destinations`,
  };
}
