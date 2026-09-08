/**
 * Pull the whole supplier catalogue and price it.
 *
 *   cd web
 *   $env:DATABASE_URL="..."; $env:ESIMACCESS_ACCESS_CODE="..."; $env:ESIMACCESS_SECRET_KEY="..."; npx tsx scripts/sync-catalog.ts
 *
 * Add --apply to write. Without it nothing is written.
 *
 * ## How this differs from seed-catalog.ts
 *
 * `seed-catalog.ts` reads a CSV rate card that somebody exported by hand. It
 * was the right tool when there was no API key, and it produced 52 SKUs across
 * eight destinations. This reads the supplier's live package list, which is
 * every plan they actually sell, in every country they sell it, at the price
 * they will charge today.
 *
 * The CSV script is not deleted. A rate card you can read without credentials
 * is worth keeping for the day the API is down or the account is suspended, and
 * it is the only thing that works before a supplier relationship exists.
 *
 * ## Everything lands inactive, again
 *
 * Pulling a thousand plans is not the same as selling a thousand plans. A SKU
 * becomes visible because a person decided it should be, in the console, after
 * looking at the margin. That rule does not relax because the source changed
 * from a spreadsheet to an API; if anything it matters more, because nobody
 * read this list before it arrived.
 *
 * ## Prices are recomputed, never carried over
 *
 * Retail comes from `money.ts` at the FX rate given on the command line, and is
 * written to `catalog_prices` as a fact. Past orders are untouched: an order
 * carries the price it was sold at. Re running this on a day the dollar moved
 * changes what the shop will charge next, and changes nothing about what it
 * charged last Tuesday.
 *
 * ## What it does about plans that disappear
 *
 * Deactivates them, and says so. It does not delete: a SKU with orders against
 * it must keep existing or the order history stops making sense. A supplier
 * withdrawing a plan is a normal event and the correct response is that it
 * stops being for sale, not that it stops having ever existed.
 */

import { DESTINATIONS } from "../src/lib/destinations";
import { breakdown, DEFAULTS, priceFor, pretty } from "../src/lib/money";
import { all, run } from "../src/lib/db";
import { setPrice, upsertItem, upsertSource } from "../src/lib/platform";
import { EsimAccessSupplier } from "../src/lib/suppliers/esimaccess";
import type { CatalogPlan } from "../src/lib/suppliers/types";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const num = (name: string) => {
  const v = flag(name);
  return v === undefined ? undefined : Number(v);
};

/**
 * Only destinations the product knows how to talk about.
 *
 * The supplier sells regional and global bundles and a long tail of countries
 * nobody in this market flies to. Selling a plan for a country the picker
 * cannot show, the copy cannot name and support has never heard of is how you
 * get a refund request you cannot reason about. `--all` lifts this for the day
 * the destination list catches up.
 */
const ONLY_KNOWN = !argv.includes("--all");
const KNOWN = new Set(DESTINATIONS.map((d) => d.iso.toUpperCase()));

/**
 * The FX rate, which is a fact about a day.
 *
 * No default here on purpose. seed-catalog.ts carries one because it ships with
 * a dated rate card and the two belong together; this pulls live prices, so a
 * stale constant would silently price today's costs at last month's dollar.
 */
const FX = num("--fx");
const MARGIN = num("--margin") ?? 0.45;

interface Planned {
  sku: string;
  planId: string;
  title: string;
  subtitle: string | null;
  country: string;
  dataMb: number;
  days: number;
  wholesaleUsd: number;
  retailAud: number;
  marginPct: number;
  contributionAud: number;
  topUpSupported: boolean;
}

/**
 * A stable SKU for one supplier plan.
 *
 * Deliberately built from what the plan IS, not from the supplier's code. A
 * SKU that embeds `JC066` is a SKU that has to change the day you switch
 * supplier, which is the one thing the whole platform layering exists to avoid.
 * The supplier's own id lives in catalog_sources, where it belongs.
 *
 * Dots separate the parts, so a decimal inside one would make
 * esim.au.0.1gb-7d read as five parts rather than four. Sizes are written with
 * `p` for the point.
 */
function skuFor(p: CatalogPlan, country: string): string {
  const gb = p.dataMb / 1024;
  const size = (Number.isInteger(gb) ? String(gb) : gb.toFixed(1)).replace(".", "p");
  return `esim.${country.toLowerCase()}.${size}gb-${p.validityDays}d.esa`;
}

function titleFor(p: CatalogPlan, country: string): string {
  const name = DESTINATIONS.find((d) => d.iso.toUpperCase() === country)?.name ?? country;
  const gb = p.dataMb / 1024;
  const size = gb >= 1 ? `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB` : `${p.dataMb} MB`;
  const days = p.validityDays === 1 ? "1 day" : `${p.validityDays} days`;
  return `${name}, ${size} for ${days}`;
}

async function main() {
  if (!FX || !Number.isFinite(FX) || FX <= 0) {
    console.error("\n  --fx is required, and there is no default.\n");
    console.error("  This prices live supplier costs, so the rate has to be a fact");
    console.error("  about today rather than a constant somebody set once.\n");
    console.error("    npx tsx scripts/sync-catalog.ts --fx 1.39\n");
    process.exit(1);
  }

  const supplier = new EsimAccessSupplier();

  console.log("");
  console.log(`  Source      eSIM Access, live package list`);
  console.log(`  FX          1 USD = ${FX} AUD`);
  console.log(`  Buffer      ${(DEFAULTS.fxBuffer * 100).toFixed(0)}% on top of that`);
  console.log(`  Target      ${(MARGIN * 100).toFixed(0)}% contribution margin`);
  console.log(`  Scope       ${ONLY_KNOWN ? `${KNOWN.size} known destinations` : "everything they sell"}`);
  console.log(`  Mode        ${APPLY ? "APPLY (writing to the database)" : "DRY RUN (nothing written)"}`);
  console.log("");

  let raw: CatalogPlan[];
  try {
    raw = await supplier.listPlans();
  } catch (e) {
    console.error(`  Could not read the supplier catalogue: ${(e as Error).message}\n`);
    console.error("  Check ESIMACCESS_ACCESS_CODE and ESIMACCESS_SECRET_KEY.\n");
    process.exit(1);
  }

  console.log(`  ${raw.length} packages returned.`);

  const assumptions = { ...DEFAULTS, fxRate: FX };
  const planned = new Map<string, Planned>();
  const skipped = { multiCountry: 0, unknown: 0, noData: 0, duplicate: 0 };

  for (const p of raw) {
    // Multi country bundles have no single destination, so the picker cannot
    // place them and the copy cannot name them. Worth selling one day, as their
    // own product with their own page, not smuggled in as a country plan.
    if (p.countries.length !== 1) {
      skipped.multiCountry++;
      continue;
    }
    const country = p.countries[0];
    if (ONLY_KNOWN && !KNOWN.has(country)) {
      skipped.unknown++;
      continue;
    }
    if (!p.dataMb || !p.validityDays) {
      skipped.noData++;
      continue;
    }

    const sku = skuFor(p, country);

    /*
     * Two supplier plans can reduce to the same SKU: same country, same data,
     * same days, different throttle or different network. Keeping the cheaper
     * one is the right default, because the difference we cannot see in the
     * identifier is a difference the customer cannot see on the card either,
     * and the cheaper one earns more for the same promise.
     */
    const existing = planned.get(sku);
    if (existing) {
      skipped.duplicate++;
      if (existing.wholesaleUsd <= p.wholesaleUsd) continue;
    }

    // pretty() rounds to the .95 ladder the shop prices on, so the breakdown
    // is recomputed against the price actually charged rather than the exact
    // one the formula produced. Reporting the margin of a price nobody pays is
    // the kind of small dishonesty that compounds into a wrong quarter.
    const retail = pretty(priceFor(p.wholesaleUsd, MARGIN, assumptions).retail);
    const b = breakdown(retail, p.wholesaleUsd, assumptions);

    planned.set(sku, {
      sku,
      planId: p.planId,
      title: titleFor(p, country),
      subtitle: null,
      country,
      dataMb: p.dataMb,
      days: p.validityDays,
      wholesaleUsd: p.wholesaleUsd,
      retailAud: retail,
      marginPct: b.margin,
      contributionAud: b.contribution,
      topUpSupported: p.topUpSupported,
    });
  }

  const rows = [...planned.values()].sort((a, b) => a.sku.localeCompare(b.sku));

  /* ---- What is already here ------------------------------------------- */

  const existing = await all<{ sku: string; active: boolean }>(
    `SELECT i.sku, i.active FROM catalog_items i
       JOIN catalog_sources s ON s.sku = i.sku AND s.fulfiller_id = 'esimaccess'
      WHERE i.category = 'esim'`,
  );
  const known = new Map(existing.map((r) => [r.sku, r.active]));
  const incoming = new Set(rows.map((r) => r.sku));
  const vanished = existing.filter((r) => !incoming.has(r.sku));

  /* ---- The table ------------------------------------------------------- */

  const byCountry = new Map<string, Planned[]>();
  for (const r of rows) {
    const list = byCountry.get(r.country) ?? [];
    list.push(r);
    byCountry.set(r.country, list);
  }

  console.log("");
  console.log("  SKU                                       COST       RETAIL   MARGIN  PER SALE  ");
  console.log("  " + "-".repeat(78));

  for (const [country, list] of [...byCountry.entries()].sort()) {
    for (const r of list) {
      const state = known.has(r.sku) ? (known.get(r.sku) ? " live" : "") : " NEW";
      console.log(
        "  " +
          r.sku.padEnd(38) +
          `USD ${r.wholesaleUsd.toFixed(2)}`.padStart(10) +
          `AUD ${r.retailAud.toFixed(2)}`.padStart(12) +
          `${(r.marginPct * 100).toFixed(1)}%`.padStart(9) +
          `$${r.contributionAud.toFixed(2)}`.padStart(10) +
          state,
      );
    }
    void country;
  }

  console.log("");
  console.log(`  ${rows.length} SKUs across ${byCountry.size} destinations.`);
  const fresh = rows.filter((r) => !known.has(r.sku)).length;
  console.log(`  ${fresh} new, ${rows.length - fresh} already in the catalogue.`);
  console.log(
    `  Skipped: ${skipped.multiCountry} regional or global, ${skipped.unknown} outside the ` +
      `destination list, ${skipped.noData} with no data or validity, ${skipped.duplicate} duplicate shapes.`,
  );
  if (vanished.length) {
    console.log(
      `  ${vanished.length} SKUs are no longer offered and will be deactivated` +
        `${vanished.some((v) => v.active) ? ", including some currently on sale" : ""}.`,
    );
  }

  if (!APPLY) {
    console.log("");
    console.log("  Nothing written. Read the margins, then run again with --apply.");
    console.log("");
    return;
  }

  /* ---- Write ----------------------------------------------------------- */

  for (const r of rows) {
    await upsertItem({
      sku: r.sku,
      category: "esim",
      title: r.title,
      subtitle: r.subtitle,
      // Never flips an existing decision. A SKU that is on sale stays on sale
      // through a price refresh; a new one arrives inactive. Passing a literal
      // here would either put a thousand untested plans on sale or take the
      // tested ones off, and both are worse than asking a person.
      active: known.get(r.sku) ?? false,
      sortOrder: r.dataMb,
      attributes: {
        country: r.country,
        dataMb: r.dataMb,
        days: r.days,
        daily: false,
        fup: null,
        routing: "esa",
        topUpSupported: r.topUpSupported,
        // Internal. The allowlist in catalog-public.ts keeps this off the wire;
        // see the commit where it did not.
        pricing: {
          costUsd: r.wholesaleUsd,
          fxUsdAud: FX,
          targetMargin: MARGIN,
          actualMargin: r.marginPct,
          contributionAud: r.contributionAud,
          pricedAt: new Date().toISOString().slice(0, 10),
        },
      },
      inputSchema: {},
    });

    await setPrice(r.sku, "AUD", r.retailAud, true);

    await upsertSource({
      sku: r.sku,
      fulfillerId: "esimaccess",
      externalId: r.planId,
      costAmount: r.wholesaleUsd,
      costCurrency: "USD",
      enabled: true,
    });
  }

  for (const v of vanished) {
    await run(`UPDATE catalog_items SET active = false WHERE sku = ?`, [v.sku]);
    await run(
      `UPDATE catalog_sources SET enabled = false WHERE sku = ? AND fulfiller_id = 'esimaccess'`,
      [v.sku],
    );
  }

  console.log("");
  console.log(`  ${rows.length} SKUs written, ${fresh} of them new and inactive.`);
  if (vanished.length) console.log(`  ${vanished.length} withdrawn SKUs deactivated.`);
  console.log("");
  console.log("  Nothing new is on sale. Activate from the console, one at a time,");
  console.log("  after you have looked at the margin and installed it on a handset.");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
