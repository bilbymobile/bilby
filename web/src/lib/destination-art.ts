/**
 * Artwork for the destination cards.
 *
 * ## Drawn here, not photographed anywhere
 *
 * These used to be stock photographs hotlinked from an image host, which is
 * what the reference deployment does. Two things were wrong with that. Every
 * visitor's address reached a third party before they had agreed to anything,
 * which is the exact hole the fonts were self hosted to close. And the pictures
 * lived at URLs nobody here controls, so the cards were one dead link away from
 * six grey rectangles.
 *
 * They are now generated from `scripts/art/scenes.mjs`: a landform, a plant and
 * one or two built shapes per country, composed from a shared vocabulary of
 * primitives and rendered to WebP. Thirteen plates come to 156 KB, which is
 * about one photograph.
 *
 * That also settles copyright completely. There is no source image, no
 * photographer, no licence to honour and nothing to attribute, because every
 * line comes out of a function in this repository. Each scene is abstracted to
 * a type rather than a portrait: a cone with a crater is a volcano, not any
 * particular volcano; a dome on a drum is half the skylines in Europe. That
 * abstraction is a legal position as much as an aesthetic one, since an
 * original stylisation of a building type carries none of the rights a
 * photograph of a specific building can.
 *
 * To change one, edit its scene and run `node scripts/build-destination-art.mjs`.
 */
export interface DestinationArt {
  /** The place the plate is of, which is not always the country's capital. */
  city: string;
  /** Two or three words in the reference's own voice, printed as a badge. */
  cut: string;
}

const ART: Record<string, DestinationArt> = {
  JP: { city: "Japan", cut: "Dawn cone" },
  ID: { city: "Indonesia", cut: "Two volcanoes" },
  SG: { city: "Singapore", cut: "Night crown" },
  TH: { city: "Thailand", cut: "Temple light" },
  VN: { city: "Vietnam", cut: "Still bay" },
  CN: { city: "China", cut: "Long wall" },
  AE: { city: "UAE", cut: "Dune and glass" },
  PK: { city: "Pakistan", cut: "High passes" },
  IT: { city: "Italy", cut: "Dome and cypress" },
  GB: { city: "United Kingdom", cut: "Cold river" },
  US: { city: "United States", cut: "Wide span" },
  AU: { city: "Australia", cut: "Red centre" },
  NZ: { city: "New Zealand", cut: "Fiord mirror" },
};

/**
 * The order the cards appear in.
 *
 * Asia first, because that is where the supply is deepest and where an
 * Australian outbound traveller goes most. The rest reads as a route rather
 * than an alphabet.
 */
export const FEATURED = [
  "JP", "ID", "SG", "TH", "VN", "CN", "AE", "PK", "IT", "GB", "US", "AU", "NZ",
] as const;

/**
 * What the supplier calls each of these, where it differs from what we do.
 *
 * The grid used to find a destination's region by matching our name against the
 * coverage list, which worked for twelve of the thirteen and put the United
 * Arab Emirates in Asia Pacific, because we call it "UAE" and the supplier does
 * not. A fuzzy match that is right most of the time is worse than no match at
 * all: it fails silently, on one card, in a label nobody reads twice.
 *
 * `promises.test.ts` now fails the build if any featured destination cannot be
 * resolved to a row in the coverage list.
 */
export const COVERAGE_NAME: Record<string, string> = {
  AE: "United Arab Emirates",
  CN: "China mainland",
  GB: "United Kingdom",
  US: "United States",
};

/** The supplier's name for a destination, which is usually just ours. */
export function coverageName(iso: string, ours: string): string {
  return COVERAGE_NAME[iso.toUpperCase()] ?? ours;
}

export function art(iso: string): DestinationArt | undefined {
  return ART[iso.toUpperCase()];
}

/** Served from our own origin, always. There is no remote fallback any more. */
export function photo(iso: string): string | null {
  const key = iso.toUpperCase();
  return ART[key] ? `/destinations/${key.toLowerCase()}.webp` : null;
}
