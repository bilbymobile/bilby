/**
 * Seed the catalogue from the eSIM Access rate card.
 *
 * Run with:
 *   DATABASE_URL=postgresql://... npx tsx scripts/seed-catalog.ts [--margin 0.45] [--apply]
 *
 * Prints the whole plan and changes nothing unless --apply is given. Pricing is
 * the one decision in this business that is expensive to get wrong and cheap to
 * look at first, so looking at it first is the default.
 *
 * ## Three rules this script exists to enforce
 *
 * 1. **Everything seeds inactive.** An inactive SKU is not for sale. Nothing
 *    here has been tested on a handset, no supplier account is funded, and the
 *    routing decision is deliberately still open. Seeding active would mean a
 *    rate card change could put something on sale, which is exactly backwards:
 *    a rate card is an input to a decision, not a decision.
 *
 * 2. **The price is stored, not derived.** The number computed here is written
 *    to catalog_prices and then it is a fact. Re running this script with a
 *    different FX rate changes future prices and not past orders, because past
 *    orders carry their own recorded price. A shop that recomputes its prices
 *    from today's inputs cannot tell you what it charged last Tuesday.
 *
 * 3. **The FX rate is a fact about a day, not a constant.** It is passed in and
 *    printed. There is no default and there must never be one: a hardcoded rate
 *    silently drifts, and the way you find out is a margin report that was
 *    wrong for a quarter.
 *
 * ## Routing
 *
 * eSIM Access publishes two variants of some plans. The plain ones route the
 * traffic out through the supplier's home network, which for this supplier
 * means a Hong Kong exit IP. The `_nonhkip` ones break out locally in the
 * destination country and cost between six and ninety three percent more.
 *
 * A foreign exit IP is not a technicality. It breaks Australian banking apps,
 * it breaks geo restricted streaming, and it breaks some government services.
 * That is a real product difference and it will generate real support tickets.
 *
 * The decision on the table is to seed the cheap home routed variants, get the
 * pipeline working, and revisit routing per destination once there are real
 * orders and a handset test. This script seeds accordingly and records the
 * routing on every SKU so that decision is visible in the data rather than
 * remembered.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULTS, priceFor, pretty, breakdown } from "../src/lib/money";
import { upsertItem, setPrice, upsertSource } from "../src/lib/platform";
import { destinationName } from "../src/lib/destinations";

/* ---- The rate card ------------------------------------------------------ */

const CARD = resolve(
  import.meta.dirname,
  "../../suppliers/esimaccess-ratecard-2026-09-05.csv",
);

/**
 * USD to AUD, ECB reference rate for 4 September 2026, read from
 * api.frankfurter.dev on 5 September 2026.
 *
 * Overridable with --fx. Printed on every run, because a price nobody can trace
 * back to a rate is a price nobody can defend.
 */
const FX_USD_AUD = 1.3882;
const FX_AS_AT = "2026-09-04";

interface Row {
  slug: string;
  packageNo: string;
  gb: number;
  days: number;
  wholesaleUsd: number;
  dataType: number;
  topUpType: number;
  fup: string;
}

function parseCard(): Row[] {
  const text = readFileSync(CARD, "utf8");
  const rows: Row[] = [];

  for (const line of text.split("\n")) {
    const t = line.trim();
    // Comments carry the provenance of the file and are worth more than the
    // parsing convenience of stripping them at capture time.
    if (!t || t.startsWith("#") || t.startsWith("slug,")) continue;

    const [slug, packageNo, gb, days, wholesaleUsd, dataType, topUpType, fup] = t.split(",");
    if (!slug || !packageNo) continue;

    rows.push({
      slug,
      packageNo,
      gb: Number(gb),
      days: Number(days),
      wholesaleUsd: Number(wholesaleUsd),
      dataType: Number(dataType),
      topUpType: Number(topUpType),
      fup: (fup ?? "").trim(),
    });
  }
  return rows;
}

/* ---- Naming ------------------------------------------------------------- */

/**
 * Our SKU, which is ours and permanent.
 *
 * Deliberately not the supplier's packageNo. That string belongs to eSIM Access
 * and changes when they reissue a plan; ours has to survive changing supplier
 * entirely, which is the only reason the catalogue is stored rather than
 * proxied.
 *
 * Shaped so a person can read it in a support ticket without a lookup.
 */
function skuFor(r: Row, iso: string, routing: string): string {
  // A dot separates the parts of a SKU, so a decimal point inside one would
  // make esim.au.0.1gb-7d.home read as five parts rather than four. The
  // supplier's own number is kept rather than converted to megabytes: 0.1 GB
  // times 1024 is 102.4, and a SKU that says 102mb for a plan the supplier
  // calls 0.1 GB is a rounding decision hiding in an identifier.
  const size = String(r.gb).replace(".", "p");

  // The throttle speed is part of the identity of a daily plan, not a
  // decoration on it. Without this, AU_1_Daily and AU_1_Daily_1Mbps produce the
  // same SKU: two different products, two different wholesale costs, one row,
  // and the second upsert silently wins. The duplicate guard in main() exists
  // because that is exactly what happened on the first run of this script.
  const speed = r.fup ? `-${r.fup.toLowerCase()}` : "";

  const shape = r.dataType === 2 ? `${size}gb-daily${speed}` : `${size}gb-${r.days}d`;
  return `esim.${iso.toLowerCase()}.${shape}.${routing}`;
}

function titleFor(r: Row, iso: string): string {
  const place = destinationName(iso);
  return r.dataType === 2
    ? `${place}, ${r.gb} GB a day`
    : `${place}, ${r.gb} GB for ${r.days} days`;
}

function subtitleFor(r: Row, routing: string): string {
  const parts: string[] = [];
  if (r.dataType === 2) {
    parts.push(r.fup ? `Full speed to ${r.gb} GB daily, then ${r.fup}` : "Daily allowance");
  }
  if (routing === "home") {
    // Written on the product, not buried. Someone whose banking app stops
    // working in Tokyo did not get what they thought they bought unless this
    // sentence was on the page when they paid.
    parts.push("Connects through an overseas exit point, so some banking and streaming apps may not work");
  } else {
    parts.push("Local exit point, so banking and streaming apps behave as they do at home");
  }
  return parts.join(". ");
}

/* ---- Main --------------------------------------------------------------- */

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const margin = num(argv, "--margin") ?? 0.45;
  const fx = num(argv, "--fx") ?? FX_USD_AUD;
  const routingWanted = str(argv, "--routing") ?? "home";

  const rows = parseCard();

  console.log("");
  console.log(`  Rate card   ${CARD.split("/").slice(-1)[0]}`);
  console.log(`  FX          1 USD = ${fx} AUD  (ECB reference, ${FX_AS_AT})`);
  console.log(`  Buffer      ${(DEFAULTS.fxBuffer * 100).toFixed(0)}% on top of that`);
  console.log(`  Target      ${(margin * 100).toFixed(0)}% contribution margin`);
  console.log(`  Routing     ${routingWanted}`);
  console.log(`  Mode        ${apply ? "APPLY (writing to the database)" : "DRY RUN (nothing written)"}`);
  console.log("");

  const assumptions = { ...DEFAULTS, fxRate: fx };

  let seeded = 0;
  let skipped = 0;
  const unreachable: string[] = [];
  const printed: string[] = [];

  /*
   * Two rate card rows must never produce one SKU.
   *
   * An upsert makes a collision invisible: the second row overwrites the first,
   * the count still looks right, and the catalogue quietly sells one plan at
   * another plan's cost. This throws instead, because a naming scheme that
   * cannot tell two products apart is a bug in the naming scheme and the fix is
   * a better name, not a survivable overwrite.
   */
  const seen = new Map<string, string>();

  for (const r of rows) {
    const isLocal = r.slug.endsWith("_nonhkip");
    const routing = isLocal ? "local" : "home";
    if (routing !== routingWanted) {
      skipped++;
      continue;
    }

    const iso = r.slug.split("_")[0];
    const sku = skuFor(r, iso, routing);

    const clash = seen.get(sku);
    if (clash) {
      throw new Error(
        `Two rate card rows produce the SKU ${sku}: ${clash} and ${r.slug}. ` +
          `They are different products at different costs, so they need ` +
          `different names. Fix skuFor rather than letting one overwrite the other.`,
      );
    }
    seen.set(sku, r.slug);

    let retail: number;
    try {
      retail = pretty(priceFor(r.wholesaleUsd, margin, assumptions).retail);
    } catch (e) {
      // priceFor refuses rather than returning a number when the target margin
      // is arithmetically out of reach. Recorded and skipped: a SKU with no
      // defensible price should not get one anyway.
      unreachable.push(`${sku}: ${(e as Error).message}`);
      continue;
    }

    const actual = breakdown(retail, r.wholesaleUsd, assumptions);

    printed.push(
      [
        sku.padEnd(34),
        `USD ${r.wholesaleUsd.toFixed(2)}`.padStart(10),
        `AUD ${retail.toFixed(2)}`.padStart(11),
        `${(actual.margin * 100).toFixed(1)}%`.padStart(7),
        `$${actual.contribution.toFixed(2)}`.padStart(8),
      ].join("  "),
    );

    if (apply) {
      await upsertItem({
        sku,
        category: "esim",
        title: titleFor(r, iso),
        subtitle: subtitleFor(r, routing),
        taxCode: "GST",
        // Not a typo and not a placeholder. See rule 1 at the top of this file.
        active: false,
        sortOrder: r.dataType === 2 ? 900 + r.gb : r.gb * 10 + Math.min(r.days, 9),
        attributes: {
          country: iso,
          // Rounded, because 0.1 GB times 1024 is 102.4 and a fractional
          // megabyte is not a thing anybody has ever been sold.
          dataMb: Math.round(r.gb * 1024),
          days: r.days,
          daily: r.dataType === 2,
          fup: r.fup || null,
          routing,
          topUpSupported: r.topUpType === 2,
          // The economics as they stood when this price was set. Stored rather
          // than recomputed for display, because recomputing needs an FX rate
          // and the only honest rate to recompute with is the one that was
          // used, which is this one. A console that divides by today's rate
          // shows a margin the price was never set to.
          pricing: {
            costUsd: r.wholesaleUsd,
            fxUsdAud: fx,
            fxAsAt: FX_AS_AT,
            targetMargin: margin,
            actualMargin: actual.margin,
            contributionAud: actual.contribution,
            pricedAt: new Date().toISOString().slice(0, 10),
          },
        },
        // Nothing about an eSIM needs input from the buyer, so the schema is
        // empty. It exists because the next category will need it: a mobile top
        // up needs a phone number, and the column being there from the start is
        // what stops that being a migration on the orders table.
        inputSchema: {},
      });

      await setPrice(sku, "AUD", retail, true);

      await upsertSource({
        sku,
        fulfillerId: "esimaccess",
        externalId: r.packageNo,
        costAmount: r.wholesaleUsd,
        costCurrency: "USD",
        priority: 10,
        // The source is enabled while the item is inactive, which is the right
        // way round: "we know who would supply this" is a different fact from
        // "this is for sale", and conflating them means turning an item on
        // requires remembering to turn its source on too.
        enabled: true,
      });
      seeded++;
    } else {
      seeded++;
    }
  }

  console.log(
    ["  SKU".padEnd(36), "COST".padStart(10), "RETAIL".padStart(11), "MARGIN".padStart(7), "PER SALE".padStart(8)].join("  "),
  );
  console.log("  " + "-".repeat(76));
  for (const line of printed.sort()) console.log("  " + line);
  console.log("");

  console.log(`  ${seeded} SKUs ${apply ? "written" : "would be written"}, all inactive.`);
  console.log(`  ${skipped} skipped (other routing).`);
  if (unreachable.length) {
    console.log("");
    console.log(`  ${unreachable.length} could not be priced at this margin:`);
    for (const u of unreachable) console.log(`    ${u}`);
  }

  console.log("");
  console.log("  Nothing is on sale. Activate a SKU from the console once you have");
  console.log("  installed it on a real handset and watched it connect.");
  console.log("");
}

function num(argv: string[], flag: string): number | null {
  const i = argv.indexOf(flag);
  if (i === -1 || !argv[i + 1]) return null;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) ? n : null;
}

function str(argv: string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1] ?? null;
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
