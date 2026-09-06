/**
 * Is vercel.json something Vercel will accept?
 *
 * This exists because it once was not, and the way that surfaced was a
 * production build that failed before it started:
 *
 *   The `vercel.json` schema validation failed with the following message:
 *   should NOT have additional property `//`
 *
 * A `"//"` key is the usual convention for a comment in JSON, and JSON itself
 * is perfectly happy with it. Vercel validates against a closed schema and
 * rejects any property it does not recognise, so the file that documented its
 * own reasoning was the file that stopped the deploy.
 *
 * The lesson is narrow and worth keeping: a config file consumed by somebody
 * else's validator cannot carry your notes. The reasoning lives in DEPLOY.md
 * and in the commit that made the change, which are places a person reads
 * anyway.
 *
 * The property list below is from Vercel's own configuration reference. It will
 * drift as they add properties, and the failure mode when it does is a false
 * alarm here rather than a broken deploy, which is the right way round.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED = new Set([
  "$schema",
  "buildCommand",
  "bulkRedirectsPath",
  "bunVersion",
  "cleanUrls",
  "crons",
  "devCommand",
  "fluid",
  "framework",
  "functionFailoverRegions",
  "functions",
  "git",
  "headers",
  "ignoreCommand",
  "images",
  "installCommand",
  "outputDirectory",
  "public",
  "redirects",
  "regions",
  "rewrites",
  "trailingSlash",
]);

/** Every region Vercel runs functions in, from their region list. */
const REGIONS = new Set([
  "arn1", "bom1", "cdg1", "cle1", "cpt1", "dub1", "dxb1", "fra1",
  "gru1", "hkg1", "hnd1", "iad1", "icn1", "kix1", "lhr1", "pdx1",
  "sfo1", "sin1", "syd1", "yul1",
]);

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, detail ?? "");
  }
}

const path = resolve(import.meta.dirname, "../vercel.json");
const raw = readFileSync(path, "utf8");

console.log("\nvercel.json\n");

let config: Record<string, unknown>;
try {
  config = JSON.parse(raw);
  check("parses as JSON", true);
} catch (e) {
  check("parses as JSON", false, (e as Error).message);
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(1);
}

const unknown = Object.keys(config).filter((k) => !ALLOWED.has(k));
check(
  "carries no property Vercel will reject",
  unknown.length === 0,
  unknown.length ? `unknown: ${unknown.join(", ")}` : "",
);

// The specific mistake, named, so the message is unmissable if it recurs.
check(
  'has no "//" comment key',
  !("//" in config),
  'Vercel rejects it. Put the reasoning in DEPLOY.md or the commit message.',
);

const regions = config.regions;
if (regions !== undefined) {
  check("regions is an array", Array.isArray(regions));
  const bad = (regions as string[]).filter((r) => !REGIONS.has(r));
  check("every region is a real one", bad.length === 0, bad.join(", "));

  // Hobby allows exactly one. Deploying to more fails the build rather than
  // degrading, so this is worth catching here rather than there.
  check(
    "one region, which is all the Hobby plan allows",
    (regions as string[]).length === 1,
    `${(regions as string[]).length} regions`,
  );

  check(
    "that region is Sydney, next to the database",
    (regions as string[])[0] === "syd1",
    (regions as string[])[0],
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
