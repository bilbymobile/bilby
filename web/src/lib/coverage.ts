import { COUNTRIES, GROUPS, READ_ON, SOURCE } from "./coverage-data";

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
 * partner console on a stated day, compiled into `coverage-data.ts` by
 * `scripts/build-coverage.ts`. Moving the number means capturing a newer file,
 * which means the provenance moves with it. `promises.test.ts` fails the build
 * if the landing page prints a country count the file does not support, and
 * fails again if the generated module and the CSV have drifted apart.
 *
 * Generated rather than read at runtime because the CSV lives one directory
 * above `web/` and nothing in the deployment traces it. Reading it on Vercel
 * would have found nothing and rendered a page with no count at all.
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
/** The four buckets the destinations grid filters by. */
export type Region = "apac" | "europe" | "mea" | "americas";

export const REGIONS: Array<{ key: Region; label: string }> = [
  { key: "apac", label: "Asia Pacific" },
  { key: "europe", label: "Europe" },
  { key: "mea", label: "Middle East and Africa" },
  { key: "americas", label: "Americas" },
];

export interface CoveredCountry {
  name: string;
  region: Region;
}

export interface Coverage {
  /** Single country or territory entries the supplier lists. */
  countries: number;
  /** Regional and global bundles, which cover many countries at once. */
  groups: number;
  /** Every country name, in the supplier's own spelling, alphabetical. */
  names: string[];
  /** The same list with its region, for the grid's filter. */
  list: CoveredCountry[];
  /** The day the list was read, for the footnote under any figure drawn from it. */
  readOn: string;
  /** The file this came from, so a reader can go and check. */
  source: string;
}

function load(): Coverage {
  const list: CoveredCountry[] = COUNTRIES.map(([name, region]) => ({
    name,
    region: region as Region,
  }));

  return {
    countries: list.length,
    groups: GROUPS,
    names: list.map((c) => c.name),
    list,
    readOn: READ_ON,
    source: SOURCE,
  };
}

let cached: Coverage | undefined;

export function coverage(): Coverage {
  if (!cached) cached = load();
  return cached;
}
