import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What our supply can reach, read from a file rather than typed into a page.
 *
 * ## Why this is not a constant
 *
 * "190+ countries" is the number every operator in this category prints, and
 * almost nobody sources. Under Australian Consumer Law it is a representation
 * like any other: if the page says a number, somebody has to be able to say
 * where it came from and when it was true. A constant in a component cannot
 * answer either question, and the first time the figure moves, the page and the
 * truth part company silently.
 *
 * So the count is derived from a dated file in `suppliers/`, captured from the
 * partner console on a stated day. Moving the number means capturing a newer
 * file, which means the provenance moves with it. `promises.test.ts` fails the
 * build if the landing page prints a country count that this file does not
 * support.
 *
 * ## Coverage is not stock
 *
 * This is the ceiling, not the shelf. It says where a plan could be bought
 * from, not what Bilby has activated, priced and can sell you today. Those live
 * in `catalog_prices` and are read by `live-destinations.ts`. The two numbers
 * are years apart in size and the page has to keep them apart in wording: this
 * one is "we can reach", the other is "on sale".
 *
 * Read at module load. The file is 250 lines, it ships inside the deployment,
 * and the landing page revalidates daily, so this costs one read per cold
 * start.
 */
export interface Coverage {
  /** Single country or territory entries the supplier lists. */
  countries: number;
  /** Regional and global bundles, which cover many countries at once. */
  groups: number;
  /** Every country name, in the supplier's own spelling, alphabetical. */
  names: string[];
  /** The day the list was read, for the footnote under any figure drawn from it. */
  readOn: string;
  /** The file this came from, so a reader can go and check. */
  source: string;
}

const FILE = "esimaccess-coverage-2026-09-14.csv";
const READ_ON = "14 September 2026";

function load(): Coverage {
  // Two candidates because the working directory differs between `next build`
  // at the repository root and the compiled server running inside `web/`.
  const candidates = [
    join(process.cwd(), "..", "suppliers", FILE),
    join(process.cwd(), "suppliers", FILE),
  ];

  for (const path of candidates) {
    let raw: string;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const names: string[] = [];
    let groups = 0;
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || t.startsWith("kind,")) continue;
      const [kind, ...rest] = t.split(",");
      const name = rest.join(",").replace(/^"|"$/g, "");
      if (kind === "country") names.push(name);
      else if (kind === "group") groups++;
    }
    if (names.length > 0) {
      return { countries: names.length, groups, names, readOn: READ_ON, source: FILE };
    }
  }

  /*
   * Nothing rather than a guess.
   *
   * A missing file is a deployment fault, and the honest response to one is a
   * page that says less, not a page that says "190+" because the number had to
   * be something. Every caller treats a zero count as "we have nothing to say
   * about reach" and renders the section without it.
   */
  return { countries: 0, groups: 0, names: [], readOn: READ_ON, source: FILE };
}

let cached: Coverage | undefined;

export function coverage(): Coverage {
  if (!cached) cached = load();
  return cached;
}
