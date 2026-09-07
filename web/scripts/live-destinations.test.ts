/**
 * Does the landing page claim only what is on sale?
 *
 * Run with:
 *   DATABASE_URL=postgresql://... npx tsx scripts/live-destinations.test.ts
 *
 * The bug this exists for: the hero read "Land connected in 13 destinations"
 * on a day when exactly one plan was buyable. The number was derived rather
 * than typed, which felt like enough and was not, because it was derived from
 * the list of places we can provision rather than the list of places somebody
 * can pay for. Under Australian Consumer Law the sentence is a representation,
 * and "a function produced it" is not a defence.
 *
 * So the half that matters is not "does it count correctly", it is "does it
 * ever claim more than the catalogue can fill". Both are below, against a real
 * Postgres, because the answer depends on a JOIN and an active flag.
 */

import { run } from "../src/lib/db";
import { upsertItem, setPrice } from "../src/lib/platform";
import { liveDestinations, heroClaim } from "../src/lib/live-destinations";
import { DESTINATIONS } from "../src/lib/destinations";

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

/** A SKU shaped like the seed script's, so the JSONB path is the real one. */
async function seed(
  sku: string,
  country: string,
  opts: { active: boolean; priced: boolean },
) {
  await upsertItem({
    sku,
    category: "esim",
    title: `${country} test`,
    active: opts.active,
    attributes: { country, dataMb: 1024, days: 7 },
  });
  if (opts.priced) await setPrice(sku, "AUD", 3.95, true);
}

async function main() {
  /* ---- The pure half: how the sentence is built ------------------------ */

  console.log("\nThe hero sentence\n");

  const jp = DESTINATIONS.find((d) => d.iso === "JP")!;
  const th = DESTINATIONS.find((d) => d.iso === "TH")!;

  const none = heroClaim([]);
  check(
    "nothing on sale makes no claim about how many",
    !/\d/.test(none.line1 + none.line2) && none.pill === null,
    `${none.line1} ${none.line2}`,
  );

  const broken = heroClaim(null);
  check(
    "an unreadable catalogue makes no claim either, rather than claiming zero",
    !/\d/.test(broken.line1 + broken.line2) && broken.pill === null,
    `${broken.line1} ${broken.line2}`,
  );

  const one = heroClaim([jp]);
  check(
    'one destination is named, not counted',
    one.line2 === "Japan." && one.pill === "Japan",
    `${one.line1} ${one.line2}`,
  );
  check(
    'and never reads "1 destinations"',
    !/\b1 destinations\b/.test(one.line1 + one.line2 + (one.pill ?? "")),
  );

  const two = heroClaim([jp, th]);
  check(
    "two or more are counted",
    two.line2 === "2 destinations." && two.pill === "2 destinations",
    `${two.line1} ${two.line2}`,
  );

  /* ---- The half that talks to the database ----------------------------- */

  console.log("\nWhat the catalogue says is on sale\n");

  await run(`DELETE FROM catalog_prices`);
  await run(`DELETE FROM catalog_sources`);
  await run(`DELETE FROM catalog_items`);

  check("an empty catalogue is empty, not thirteen", (await liveDestinations())?.length === 0);

  // Inactive but priced. This is the state every SKU lands in after seeding,
  // and it is the exact state the page used to count as a destination.
  await seed("test.jp.inactive", "JP", { active: false, priced: true });
  check(
    "a seeded but inactive SKU does not put its country on the page",
    (await liveDestinations())?.length === 0,
  );

  // Active but with no price in AUD. listCatalog would not sell it, so nothing
  // else may advertise it either.
  await seed("test.id.unpriced", "ID", { active: true, priced: false });
  check(
    "an active SKU with no price in this currency is not on sale",
    (await liveDestinations())?.length === 0,
  );

  await seed("test.jp.live", "JP", { active: true, priced: true });
  const oneLive = await liveDestinations();
  check("activating one SKU adds exactly its country", oneLive?.length === 1 && oneLive[0].iso === "JP");
  check(
    "and the headline follows without anybody editing the page",
    heroClaim(oneLive).line2 === "Japan.",
  );

  // Two SKUs, same country. A destination is a place, not a product line.
  await seed("test.jp.live2", "JP", { active: true, priced: true });
  check("a second SKU for the same country does not count twice", (await liveDestinations())?.length === 1);

  await seed("test.th.live", "TH", { active: true, priced: true });
  const twoLive = await liveDestinations();
  check("a second country counts", twoLive?.length === 2);
  check(
    "order comes from the curated list, not from insertion",
    twoLive?.map((d) => d.iso).join(",") ===
      DESTINATIONS.filter((d) => ["JP", "TH"].includes(d.iso)).map((d) => d.iso).join(","),
    twoLive?.map((d) => d.iso).join(","),
  );

  /* ---- The claim can never exceed the shelf ---------------------------- */

  const live = (await liveDestinations()) ?? [];
  check(
    "the claim never exceeds what is on sale",
    live.length <= DESTINATIONS.length &&
      live.every((d) => DESTINATIONS.some((k) => k.iso === d.iso)),
  );

  // Switching the last SKU for a country off must remove it again, or the page
  // becomes a ratchet that only ever grows.
  await seed("test.th.live", "TH", { active: false, priced: true });
  check(
    "turning the last SKU off removes the destination again",
    (await liveDestinations())?.length === 1,
  );

  await run(`DELETE FROM catalog_prices`);
  await run(`DELETE FROM catalog_sources`);
  await run(`DELETE FROM catalog_items`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
