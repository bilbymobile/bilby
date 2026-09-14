/**
 * Do the legal pages say what they think they say?
 *
 * Run with:
 *   npx tsx scripts/legal.test.ts
 *
 * ## Why a check and not a proofread
 *
 * A previous version of the terms carved its liability clause out by reference
 * to "section 6". The Australian Consumer Law is section 7. Section 6 is plans
 * and payment. A liability cap carved out by reference to the wrong section is
 * a liability cap with no carve out, and it survived several careful readings
 * because "Subject to section 6" is a perfectly ordinary sentence. Nothing about
 * it looks wrong. You have to go and count.
 *
 * Counting is what a machine is for. Everything below is the class of mistake
 * that is invisible to a reader and obvious to a parser: a cross reference to a
 * section that does not exist, an effective date in the future, a contact
 * address typed into a page rather than read from the one place it is defined,
 * a claim about reach that nobody can support.
 *
 * ## It reads the pages, not a copy of them
 *
 * The source files are parsed. A check carrying its own copy of the terms
 * passes forever while the page drifts underneath it.
 *
 * Comments are stripped first. The files are full of prose explaining the
 * drafting, including the words "section 6", and a check that cannot tell the
 * document from the notes about the document is a check that fails on its own
 * explanation.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { LEGAL_ENTITY } from "../src/lib/legal";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, detail === undefined ? "" : detail);
  }
}

const PAGES = ["terms", "privacy", "refunds"] as const;
type Page = (typeof PAGES)[number];

function source(page: Page): string {
  return readFileSync(
    resolve(import.meta.dirname, `../src/app/${page}/page.tsx`),
    "utf8",
  );
}

/** The file with every comment removed, so only the document is left. */
function prose(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

/** Visible text, with tags and JSX expressions collapsed to spaces. */
function text(src: string): string {
  return prose(src)
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\s+/g, " ");
}

console.log("\nthe legal pages\n");

/* ---- Cross references resolve ------------------------------------------ */

const termsSrc = source("terms");
const termsProse = prose(termsSrc);

/** "1. What Bilby is" out of every <h2>. */
const headings = [...termsProse.matchAll(/<h2>\s*(\d+)\.\s*([^<]*)</g)].map(
  ([, n, title]) => ({ n: Number(n), title: title.trim() }),
);

check(
  `the terms have numbered sections (${headings.length} found)`,
  headings.length >= 8,
  headings.map((h) => h.n).join(","),
);

check(
  "section numbers run 1 upwards with no gaps and no repeats",
  headings.every((h, i) => h.n === i + 1),
  headings.map((h) => h.n).join(","),
);

const numbers = new Set(headings.map((h) => h.n));
const referenced = [...text(termsSrc).matchAll(/\bsection (\d+)\b/gi)].map(
  ([, n]) => Number(n),
);

check(
  `every cross reference points at a section that exists (${referenced.length} checked)`,
  referenced.every((n) => numbers.has(n)),
  referenced.filter((n) => !numbers.has(n)).join(","),
);

/*
 * And specifically: the section the liability clause defers to has to be the
 * Australian Consumer Law one. This is the check that would have caught the
 * original mistake, and it is the reason this file exists.
 */
const aclSection = headings.find((h) => /Australian Consumer Law/i.test(h.title));
check("there is an Australian Consumer Law section", aclSection !== undefined);

const liability = headings.find((h) => /Liability/i.test(h.title));
check("there is a liability section", liability !== undefined);

if (aclSection && liability) {
  // The paragraph under the liability heading, up to the next heading.
  const start = termsProse.indexOf(`${liability.n}. ${liability.title}`);
  const after = termsProse.slice(start);
  const end = after.indexOf("<h2>");
  const clause = text(end > 0 ? after.slice(0, end) : after);
  const deferred = [...clause.matchAll(/\bsection (\d+)\b/gi)].map(([, n]) => Number(n));

  check(
    "the liability cap is carved out by the ACL section, not by its neighbour",
    deferred.includes(aclSection.n),
    `defers to ${deferred.join(",") || "nothing"}, ACL is ${aclSection.n}`,
  );
  /*
   * And the cap is measured against what the customer actually paid, with no
   * figure of our own in it. An earlier draft set a floor of AUD $100, which
   * reads as generosity and is a standing promise to pay at least that on any
   * claim, including one worth a single plan. The ACL carve out above is what
   * protects a customer with a real loss; a hardcoded floor only protects one
   * with a trivial one, at our expense and forever.
   */
  check(
    "the cap is measured against what the customer paid",
    /amount you paid us/i.test(clause),
    clause.slice(0, 160),
  );
  check(
    "and the liability clause names no dollar figure of its own",
    !/(AUD|A\$|US\$|\$)\s?\d/i.test(clause),
    clause.match(/(AUD|A\$|US\$|\$)\s?\d[\d,.]*/i)?.[0],
  );
}

/* ---- Effective dates --------------------------------------------------- */

const today = new Date();
for (const page of PAGES) {
  const when = LEGAL_ENTITY.effective[page];
  const at = new Date(`${when} UTC`);

  check(`${page} has a readable effective date (${when})`, !Number.isNaN(at.getTime()));
  check(
    `${page} does not take effect in the future`,
    at.getTime() <= today.getTime(),
    when,
  );
  check(
    `${page} prints its own date rather than a shared one`,
    source(page).includes(`LEGAL_ENTITY.effective.${page}`),
  );
}

/* ---- One source of truth for who we are -------------------------------- */

for (const page of PAGES) {
  const src = source(page);
  check(
    `${page} does not hardcode the support address`,
    !prose(src).includes(LEGAL_ENTITY.contactEmail),
  );
}

check(
  "the terms name a governing law",
  /governed by the laws of/i.test(text(termsSrc)),
);
check(
  "and take it from the entity rather than naming a state in the page",
  termsProse.includes("LEGAL_ENTITY.governingLaw"),
);

/* ---- Claims we cannot support ------------------------------------------ */

/*
 * An earlier draft opened with partnering to bring you local networks "across
 * the globe". Eight destinations are on sale. Reach is the one number everybody
 * in this category inflates, and under Australian Consumer Law a statement
 * about what we cover is a representation whether it appears in an advert or in
 * clause 1 of the terms.
 */
const OVERCLAIMS = [
  /across the globe/i,
  /\bworldwide\b/i,
  /\bglobal(?:ly)? coverage\b/i,
  /\b\d{2,}\s*\+?\s*countries\b/i,
  /\bany country\b/i,
  /\banywhere in the world\b/i,
  /\b100%\b/,
  /\bguarantee[sd]? (?:uninterrupted|connectivity|coverage)\b/i,
];

for (const page of PAGES) {
  const body = text(source(page));
  const hit = OVERCLAIMS.find((re) => re.test(body));
  check(
    `${page} claims no reach or uptime it cannot support`,
    hit === undefined,
    hit && body.match(hit)?.[0],
  );
}

/* ---- House style ------------------------------------------------------- */

/*
 * No em dashes in anything a customer reads. It is a house rule rather than a
 * grammatical one: they are the tell of text nobody wrote, and a legal page is
 * the last place a reader should be wondering whether a person stood behind the
 * words. Comments are exempt, which is why this runs on the prose.
 */
for (const page of PAGES) {
  const body = prose(source(page));
  const n = (body.match(/—/g) ?? []).length;
  check(`${page} uses no em dashes in the document itself`, n === 0, n);
}

/* ---- The promises the code has to keep --------------------------------- */

/*
 * Two sentences in the terms are commitments rather than descriptions, and both
 * are cheap to keep and expensive to forget. Pinning them here does not make
 * them true; it makes their removal deliberate.
 */
const termsText = text(termsSrc);
check(
  "the terms still promise validity runs from first use",
  /validity runs from\s*first use/i.test(termsText.replace(/\s+/g, " ")),
);
check(
  "the terms still tell a customer with a lapsed profile to contact us",
  /if yours lapses before you travel, contact us/i.test(termsText),
);
check(
  "the terms still promise notice of a material change reaches email, not only the app",
  /by email to the address you gave at checkout/i.test(termsText),
);
check(
  "the terms still say there is no emergency calling",
  /no emergency calling/i.test(termsText),
);

/* ---- Promises we deliberately do not make ------------------------------ */

/*
 * The inverse of the block above, and the harder half to keep.
 *
 * A promise is easy to add in a sentence and expensive to withdraw once a
 * customer has read it, so the three that were withdrawn in this revision are
 * pinned here by their absence. Each was written in good faith and each
 * committed the business to a number nobody had measured: a free reissue, a fee
 * capped at the price of a plan, and a liability floor. Wanting any of them back
 * is a reasonable position. Reaching them by accident, through a paste from an
 * older draft, is not.
 */
const RETIRED = [
  [/at no charge/i, "a free reissue"],
  [/free of charge/i, "a free reissue"],
  [/never more than the price of the plan/i, "a fee capped at the plan price"],
  [/\bAUD \$?\d/i, "a dollar figure in the document"],
] as const;

for (const page of PAGES) {
  const body = text(source(page));
  const hit = RETIRED.find(([re]) => re.test(body));
  check(
    `${page} makes none of the money promises this revision withdrew`,
    hit === undefined,
    hit && `${hit[1]}: ${body.match(hit[0])?.[0]}`,
  );
}

/*
 * And it does not narrate the supply chain.
 *
 * Explaining that we buy wholesale and resell tells a customer nothing they can
 * act on, invites the question of what we pay, and was being used in section 6
 * to excuse a rule we can simply state. Expiry is a term of the plan. It does
 * not need a reason drawn from our contracts to be enforceable, and giving one
 * hands a competitor the shape of our cost base for free.
 */
const SUPPLY_CHAIN = [
  /\bwholesale\b/i,
  /\bresell(?:s|er|ing)?\b/i,
  /\bour supplier\b/i,
  /\bbilled us\b/i,
  /\bwe are billed\b/i,
  /\bmargin\b/i,
];

for (const page of PAGES) {
  const body = text(source(page));
  const hit = SUPPLY_CHAIN.find((re) => re.test(body));
  check(
    `${page} does not narrate how the data is bought`,
    hit === undefined,
    hit && body.match(hit)?.[0],
  );
}


console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
