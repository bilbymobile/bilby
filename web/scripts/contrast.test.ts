/**
 * Can every colour pair in the theme actually be read?
 *
 * Run with:
 *   npx tsx scripts/contrast.test.ts
 *
 * ## Why a test and not a designer's eye
 *
 * The palette has now been swapped twice: dark to cream, and cream to the app's
 * dark cinematic system so that website, web app and Android are one brand. A
 * palette swap is the moment contrast breaks, and the failures are quiet. Text
 * at 4.1:1 looks fine to somebody with good eyes, on a good screen, in a room
 * with the blinds down. It does not look fine to a fifty year old on a phone in
 * Australian sun, which is exactly where a travel eSIM gets used.
 *
 * Each swap broke a pair. On cream it was the brand teal as a link, at 3.85:1
 * on the page. On the dark system it would have been the success colour doing
 * double duty as a link, so links keep their own token either way.
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
 * pale it stops reading as secondary and the hierarchy the page depends on
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
const proseInk = token("prose-ink");
const noteInk = token("note-ink");
const noteOkInk = token("note-ok-ink");
const noteBadInk = token("note-bad-ink");

const AA_TEXT = 4.5;
const AA_UI = 3.0;

const pairs: Array<[string, string, string, number]> = [
  ["body text on the page", text, bg, AA_TEXT],
  ["body text on a card", text, surface, AA_TEXT],
  // The legal pages set their body in this rather than in the full ink, so it
  // is the figure a reader of the terms actually gets.
  ["legal body text on a card", proseInk, surface, AA_TEXT],
  ["legal body text on the page", proseInk, bg, AA_TEXT],
  ["secondary text on the page", muted, bg, AA_TEXT],
  ["secondary text on a card", muted, surface, AA_TEXT],
  ["secondary text on a raised chip", muted, surface2, AA_TEXT],
  ["body text on a raised chip", text, surface2, AA_TEXT],
  ["a card border against the card", token("border"), surface, 1.2],
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
  ["warning note text", noteInk, [255, 179, 71, 0.1]],
  ["success note text", noteOkInk, [70, 241, 214, 0.1]],
  ["error note text", noteBadInk, [255, 107, 107, 0.1]],
];

for (const [name, fg, [r, g, b, a]] of notes) {
  const blended = flatten(r, g, b, a, surface);
  const v = ratio(fg, blended);
  check(`${name} on its own tint  ${v.toFixed(2)}:1`, v >= AA_TEXT, `needs ${AA_TEXT}:1`);
}

/* ---- The theme is one theme ------------------------------------------- */

/*
 * One palette, defined once, and every other surface inherits it.
 *
 * The failure this guards against is not a colour being wrong, it is a colour
 * being redefined. The marketing and console blocks used to restate all sixteen
 * tokens, which meant a change to the brand had to be made in three places and
 * was twice made in one. That is how the legal pages served near white text on
 * a light ground, and how the shop stayed near black behind a warm landing page
 * for months.
 *
 * So: no colour token may appear outside `:root`. The blocks below it may still
 * set measure, radius and density, because those legitimately differ between a
 * legal page, a dashboard and a console.
 */
const colourTokens = /--(bg|surface|surface-2|border|text|muted|accent|accent-dim|accent-ink|ok|link|warn|danger|note-[a-z-]*?ink|note-[a-z]+-bg):/g;
const belowRoot = css.slice(css.indexOf("\n}", rootStart));
const redefined = [...belowRoot.matchAll(colourTokens)].map((m) => m[1]);
check(
  "no colour token is redefined outside :root",
  redefined.length === 0,
  redefined.join(", "),
);

/*
 * And the ground is genuinely dark, on every surface that has one.
 *
 * Checked by token name rather than by scanning every hex, because the text is
 * legitimately lighter than any ground and would trip a blanket "nothing light"
 * rule. What must never be light is specifically a background. The QR code's
 * white field is exempt by construction: it is a literal in a rule, not a token,
 * because a camera has to read it.
 */
const groundTokens = [...css.matchAll(/--(bg|surface|surface-2):\s*(#[0-9a-fA-F]{6})/g)];
const lightGrounds = groundTokens
  .filter(([, , hex]) => luminance(hex) > 0.2)
  .map(([, name, hex]) => `--${name}: ${hex}`);
check(
  `no light ground survives on any surface (${groundTokens.length} checked)`,
  lightGrounds.length === 0,
  lightGrounds.join(", "),
);

check(
  "the page ground is dark, so an unlabelled surface renders as Bilby",
  luminance(bg) < 0.02,
  `luminance ${luminance(bg).toFixed(4)}`,
);

check(
  "the page is the darkest thing, then the card, then the raised chip",
  luminance(bg) < luminance(surface) && luminance(surface) < luminance(surface2),
  `${luminance(bg).toFixed(4)} / ${luminance(surface).toFixed(4)} / ${luminance(surface2).toFixed(4)}`,
);

check(
  "the button is lighter than the card it sits on, because the action leads",
  luminance(accent) > luminance(surface),
  `accent ${luminance(accent).toFixed(3)} vs card ${luminance(surface).toFixed(3)}`,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
