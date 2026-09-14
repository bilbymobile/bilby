/**
 * Turn the dated coverage CSV into a TypeScript module.
 *
 * Run with:
 *   npx tsx scripts/build-coverage.ts
 *
 * ## Why generate instead of reading the file at runtime
 *
 * The first version read `suppliers/esimaccess-coverage-2026-09-14.csv` with
 * `readFileSync` at module load. It worked locally and would have shipped a
 * page with no country count at all, because that file lives one directory
 * above `web/` and nothing in the deployment traces it. The build even said so:
 * "dynamic filesystem access causes tracing of the whole project", which is the
 * bundler warning that it has no idea what this code will open.
 *
 * A generated module has none of that. It is imported like any other source
 * file, so it ships, it tree shakes, and there is no read on a cold start.
 *
 * ## The CSV stays the original
 *
 * The generated file is a copy, and a copy that can drift is worse than no copy
 * at all. So `promises.test.ts` reads the CSV and compares it against the
 * generated module, and fails the build when they disagree. Editing the CSV
 * without re running this script is then a failed check rather than a page
 * quietly telling a stranger the wrong number.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = "esimaccess-coverage-2026-09-14.csv";
const READ_ON = "14 September 2026";

const csv = resolve(import.meta.dirname, "..", "..", "suppliers", FILE);
const out = resolve(import.meta.dirname, "..", "src", "lib", "coverage-data.ts");

const raw = readFileSync(csv, "utf8");
const countries: Array<[string, string]> = [];
let groups = 0;

for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || t.startsWith("kind,")) continue;
  const m = /^(\w+),"([^"]*)",(\w*)$/.exec(t);
  if (!m) continue;
  const [, kind, name, region] = m;
  if (kind === "country") countries.push([name, region]);
  else if (kind === "group") groups++;
}

if (countries.length === 0) throw new Error(`no countries parsed from ${csv}`);

const body = `/**
 * GENERATED. Do not edit.
 *
 * Written by scripts/build-coverage.ts from suppliers/${FILE},
 * which was read from the eSIM Access partner console on ${READ_ON}.
 * Change the CSV and run the script; promises.test.ts fails if they disagree.
 */

export const READ_ON = ${JSON.stringify(READ_ON)};
export const SOURCE = ${JSON.stringify(FILE)};
export const GROUPS = ${groups};

export const COUNTRIES: ReadonlyArray<readonly [string, string]> = [
${countries.map(([n, r]) => `  [${JSON.stringify(n)}, ${JSON.stringify(r)}],`).join("\n")}
];
`;

writeFileSync(out, body, "utf8");
console.log(`wrote ${countries.length} countries and ${groups} groups to ${out}`);
