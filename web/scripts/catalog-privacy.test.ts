/**
 * Does the public catalogue publish anything it should not?
 *
 * This exists because it did. The seed script writes the economics of a price
 * into the item's attributes so the console can show the margin the price was
 * actually set to, and /api/catalog passed the whole attributes object through.
 * The result, live on a public URL:
 *
 *   {"pricing":{"costUsd":0.7,"actualMargin":0.4997,"contributionAud":1.97}}
 *
 * Wholesale cost, target margin and contribution per sale, for every plan on
 * sale, to anybody who asked. The route carried a comment saying cost must
 * never be exposed and the comment was accurate about the table it selects
 * from. It could not defend against the same numbers arriving through a column
 * it does select.
 *
 * So the checks below are in two halves. The first asserts the filter behaves.
 * The second reads the route's own source and asserts it still calls the
 * filter, because the failure being guarded against is not a wrong function,
 * it is somebody restoring a passthrough that looks tidier.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { publicAttributes, PUBLIC_ATTRIBUTE_KEYS } from "../src/lib/catalog-public";

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

console.log("\ncatalogue privacy\n");

/* ---- A real row, shaped exactly as the seed script writes it ------------ */

const stored = {
  country: "JP",
  dataMb: 1024,
  days: 7,
  daily: false,
  fup: null,
  routing: "home",
  topUpSupported: true,
  pricing: {
    costUsd: 0.7,
    fxUsdAud: 1.3882,
    fxAsAt: "2026-09-04",
    targetMargin: 0.45,
    actualMargin: 0.4997,
    contributionAud: 1.97,
    pricedAt: "2026-09-07",
  },
};

const out = publicAttributes(stored);

check("the pricing block does not survive", !("pricing" in out));

check(
  "everything a customer needs does survive",
  ["country", "dataMb", "days", "daily", "fup", "routing", "topUpSupported"].every(
    (k) => k in out,
  ),
  Object.keys(out).join(", "),
);

check(
  "the price the customer pays is untouched by this",
  out.dataMb === 1024 && out.days === 7 && out.routing === "home",
);

/*
 * The routing value is the one attribute here that is a product difference
 * rather than a specification, and hiding it would be dishonest rather than
 * merely inconvenient: a home routed plan exits overseas and breaks Australian
 * banking apps. It must stay public.
 */
check("routing stays public, because the buyer is entitled to it", out.routing === "home");

/* ---- Unknown keys ------------------------------------------------------- */

const withNewInternalField = publicAttributes({
  ...stored,
  supplierPlanId: "JP_1_7",
  wholesaleNote: "negotiated rate, do not publish",
});

check(
  "a field nobody allowlisted is dropped rather than published",
  !("supplierPlanId" in withNewInternalField) && !("wholesaleNote" in withNewInternalField),
  Object.keys(withNewInternalField).join(", "),
);

/* ---- Nothing commercially sensitive anywhere in the output -------------- */

const FORBIDDEN = [
  "cost", "margin", "wholesale", "supplier", "contribution", "fx", "priced",
];

function deepFindForbidden(v: unknown, path = ""): string[] {
  const hits: string[] = [];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const here = path ? `${path}.${k}` : k;
      if (FORBIDDEN.some((f) => k.toLowerCase().includes(f))) hits.push(here);
      hits.push(...deepFindForbidden(val, here));
    }
  }
  return hits;
}

const leaked = deepFindForbidden(out);
check(
  "no key anywhere in the response names a cost, a margin or a supplier",
  leaked.length === 0,
  leaked.join(", "),
);

check(
  "the allowlist itself contains nothing commercially sensitive",
  PUBLIC_ATTRIBUTE_KEYS.every((k) => !FORBIDDEN.some((f) => k.toLowerCase().includes(f))),
  PUBLIC_ATTRIBUTE_KEYS.join(", "),
);

/* ---- Edge cases, because a null row must not throw on a shop page ------- */

check("a null attributes column yields an empty object", Object.keys(publicAttributes(null)).length === 0);
check("an undefined attributes column yields an empty object", Object.keys(publicAttributes(undefined)).length === 0);

/* ---- The route still uses it -------------------------------------------- */

const routeSrc = readFileSync(
  resolve(import.meta.dirname, "../src/app/api/catalog/route.ts"),
  "utf8",
);

check(
  "the catalogue route calls the filter",
  /attributes:\s*publicAttributes\(/.test(routeSrc),
  "expected  attributes: publicAttributes(p.attributes)",
);

check(
  "the catalogue route does not pass attributes through raw",
  !/attributes:\s*p\.attributes/.test(routeSrc),
  "found a raw passthrough, which is the exact bug this file exists for",
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
