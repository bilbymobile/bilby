import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Photography for the destination cards.
 *
 * ## Where the pictures come from
 *
 * The same place the reference deployment takes them: Pexels, whose licence
 * allows commercial use and modification without attribution. The reference
 * hotlinks them. So does this, for now, and that is a compromise rather than a
 * decision, for a reason worth writing down.
 *
 * Every other asset on this page is self hosted, and the fonts were moved off
 * Google specifically so that a stranger reading the landing page does not have
 * their address handed to a third party before they have agreed to anything.
 * A hotlinked photograph reopens exactly that hole, one request at a time. The
 * only thing stopping the files being pulled into `public/` right now is that
 * this build environment cannot reach the image host.
 *
 * So the lookup is written so that fixing it needs no code. Drop a file at
 * `public/destinations/<iso lowercase>.webp` and it wins. Until then the remote
 * URL is used, and if that fails to load the card falls back to a tinted plate
 * with the flag on it, which is a card rather than a hole.
 *
 * ## Six, not one hundred and ninety nine
 *
 * The grid below the cards lists every country in the supply. The cards do not,
 * and should not: a photograph is an editorial choice and a hundred and ninety
 * nine of them is a stock library, not a page. Six is what the reference shows
 * and six is what a reader can actually look at.
 */
export interface DestinationArt {
  /** The city the photograph is of, which is not always the country's capital. */
  city: string;
  /** Two or three words in the reference's own voice, printed as a badge. */
  cut: string;
  /** Remote photograph, used when no local file is present. */
  remote: string;
}

const ART: Record<string, DestinationArt> = {
  JP: {
    city: "Tokyo",
    cut: "Neon cut",
    remote:
      "https://images.pexels.com/photos/29352449/pexels-photo-29352449.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  ID: {
    city: "Bali",
    cut: "Surf cut",
    remote:
      "https://images.pexels.com/photos/36593818/pexels-photo-36593818.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  SG: {
    city: "Singapore",
    cut: "Night market",
    remote:
      "https://images.pexels.com/photos/31048512/pexels-photo-31048512.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  AE: {
    city: "Dubai",
    cut: "Dune and glass",
    remote:
      "https://images.pexels.com/photos/5577693/pexels-photo-5577693.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  US: {
    city: "New York",
    cut: "Wide angle",
    remote:
      "https://images.pexels.com/photos/19146746/pexels-photo-19146746.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  GB: {
    city: "London",
    cut: "Grey and gold",
    remote:
      "https://images.pexels.com/photos/13915404/pexels-photo-13915404.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
};

/** The order the cards appear in. Asia first: it is where our supply is deepest. */
export const FEATURED = ["JP", "ID", "SG", "AE", "GB", "US"] as const;

export function art(iso: string): DestinationArt | undefined {
  return ART[iso.toUpperCase()];
}

/**
 * The image URL for a destination, preferring a file we serve ourselves.
 *
 * Checked at module load rather than per request: `public/` does not change
 * between requests, and Next caches that directory at startup anyway, so a
 * file added while the server is running is invisible until it restarts.
 */
export function photo(iso: string): string | null {
  const key = iso.toUpperCase();
  const entry = ART[key];
  if (!entry) return null;

  const local = `/destinations/${key.toLowerCase()}.webp`;
  for (const base of [join(process.cwd(), "public"), join(process.cwd(), "web", "public")]) {
    if (existsSync(join(base, local))) return local;
  }
  return entry.remote;
}

/** True when every card is served from our own origin. Printed under the grid. */
export function allSelfHosted(): boolean {
  return FEATURED.every((iso) => photo(iso)?.startsWith("/") === true);
}
