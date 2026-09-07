/**
 * Can every colour pair in the theme actually be read?
 *
 * Run with:
 *   npx tsx scripts/contrast.test.ts
 *
 * ## Why a test and not a designer's eye
 *
 * The shop was a dark theme and the brand grew away from it, so the palette was
 * swapped for the landing page's cream and navy. Swapping a palette is the
 * moment contrast breaks: every pair that was fine on near black has to be
 * re-earned on cream, and the failures are quiet. Text at 4.1:1 looks fine to
 * somebody with good eyes, on a good screen, in a room with the blinds down. It
 * does not look fine to a fifty year old on a phone in Australian sun, which is
 * exactly where a travel eSIM gets used.
 *
 * One pair did fail on the swap: the brand teal as a link colour, at 4.18:1 on
 * a card and 3.85:1 on the page. It was fixed by giving links their own darker
 * token rather than by darkening the brand and dulling every success state.
 *
 * ## It reads globals.css rather than repeating it
 *
 * A test carrying its own copy of the palette passes forever while the
 * stylesheet drifts underneath it. The tokens below are parsed out of the real
 * file, so editing a colour either keeps this passing or fails it, and there is
 * no third outcome where the test is quietly about a theme nobody ships.
 *
 * ## The thresholds
 *
 * WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and for the boundaries
 * of user interface components. Not AAA, which would push the muted tone so
 * dark it stops reading as secondary and the hierarchy the page depends on
 * disappears.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

/* ---- Colour maths, from the WCAG definition ---------------------------- */

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Flatten a translucent note background onto the card behind it.
 *
 * The note backgrounds are rgba over the card, so the colour a reader actually
 * sees is a blend, not the value in the file. Testing the ink against the card
 * instead would be testing a combination nobody has ever looked at.
 */
function flatten(
  r: number,
  g: number,
  b: number,
  a: number,
  backdrop: string,
): string {
  const [br, bg, bb] = rgb(backdrop);
  const mix = (f: number, k: number) => Math.round(f * a + k * (1 - a));
  return (
    "#" +
    [mix(r, br), mix(g, bg), mix(b, bb)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/* ---- The real tokens, parsed from the real file ------------------------ */

const css = readFileSync(
  resolve(import.meta.dirname, "../src/app/globals.css"),
  "utf8",
);

/** The `:root` block, which is what a customer sees in the shop. */
const rootStart = css.indexOf(":root {");
const root = css.slice(rootStart, css.indexOf("\n}", rootStart));

function token(name: string): string {
  const m = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) {
    throw new Error(`--${name} is missing from :root, or is not a six digit hex`);
  }
  return m[1];
}

console.log("\ntheme contrast\n");

const bg = token("bg");
const surface = token("surface");
const surface2 = token("surface-2");
const text = token("text");
const muted = token("muted");
const accent = token("accent");
const accentInk = token("accent-ink");
const ok = token("ok");
const link = token("link");
const warn = token("warn");
const danger = token("danger");
const noteInk = token("note-ink");
const noteOkInk = token("note-ok-ink");
const noteBadInk = token("note-bad-ink");

const AA_TEXT = 4.5;
const AA_UI = 3.0;

const pairs: Array<[string, string, string, number]> = [
  ["body text on the page", text, bg, AA_TEXT],
  ["body text on a card", text, surface, AA_TEXT],
  ["secondary text on the page", muted, bg, AA_TEXT],
  ["secondary text on a card", muted, surface, AA_TEXT],
  ["secondary text on a raised chip", muted, surface2, AA_TEXT],
  ["the label on a primary button", accentInk, accent, AA_TEXT],
  ["a link in a card", link, surface, AA_TEXT],
  ["a link on the page", link, bg, AA_TEXT],
  ["a link on a raised chip", link, surface2, AA_TEXT],
  ["error text on a card", danger, surface, AA_TEXT],
  // Large or non textual: a badge, a left border, a meter fill.
  ["the success colour as a badge or border", ok, surface, AA_UI],
  ["the warning colour as a border", warn, surface, AA_UI],
];

for (const [name, fg, back, need] of pairs) {
  const r = ratio(fg, back);
  check(`${name}  ${r.toFixed(2)}:1`, r >= need, `needs ${need}:1`);
}

/* ---- Note text, against the blend a reader actually sees --------------- */

const notes: Array<[string, string, [number, number, number, number]]> = [
  ["warning note text", noteInk, [200, 127, 69, 0.1]],
  ["success note text", noteOkInk, [53, 133, 122, 0.09]],
  ["error note text", noteBadInk, [179, 64, 47, 0.08]],
];

for (const [name, fg, [r, g, b, a]] of notes) {
  const blended = flatten(r, g, b, a, surface);
  const v = ratio(fg, blended);
  check(`${name} on its own tint  ${v.toFixed(2)}:1`, v >= AA_TEXT, `needs ${AA_TEXT}:1`);
}

/* ---- The theme is one theme ------------------------------------------- */

/*
 * The dark palette is gone, and staying gone is the point. Every surface that
 * used to override it back to cream was a place that had to remember, and at
 * least two of them forgot: the legal pages once served near white text on the
 * cream ground, and the shop stayed near black behind a warm cream landing page
 * for months. A stray dark ground in this file is how that returns.
 *
 * Checked by token name rather than by scanning every hex, because the navy ink
 * is legitimately darker than any ground and would trip a blanket "nothing
 * dark" rule. What must never be dark is specifically a background.
 */
const groundTokens = [...css.matchAll(/--(bg|surface|surface-2):\s*(#[0-9a-fA-F]{6})/g)];
const darkGrounds = groundTokens
  .filter(([, , hex]) => luminance(hex) < 0.5)
  .map(([, name, hex]) => `--${name}: ${hex}`);
check(
  `no dark ground survives on any surface (${groundTokens.length} checked)`,
  darkGrounds.length === 0,
  darkGrounds.join(", "),
);

check(
  "the page ground is light, so an unlabelled surface renders as Bilby",
  luminance(bg) > 0.7,
  `luminance ${luminance(bg).toFixed(3)}`,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
