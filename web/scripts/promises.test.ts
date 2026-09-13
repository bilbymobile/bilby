/**
 * Does the site promise anything the product does not do?
 *
 * Run with:
 *   DATABASE_URL=postgresql://... npx tsx scripts/promises.test.ts
 *
 * ## Why this file exists
 *
 * Every claim below was true when somebody wrote it. That is the whole problem.
 * A promise does not break at the moment it is written, it breaks months later
 * when something else changes and nobody rereads the sentence. Four of these
 * were live at once:
 *
 *  - The landing page promised "full speed throughout, no throttle after a
 *    hidden allowance" while fourteen of the fifty two plans on sale slowed to
 *    384 or 512 Kbps after a daily cap and said so in their own subtitles.
 *  - Destination cards said "local networks, full speed" while every plan on
 *    sale reached the internet through an exit point outside the destination,
 *    which the checkout page warned about on the next screen.
 *  - The privacy policy said "we show no advertising" and then, two paragraphs
 *    below, explained that it collects your country to work out "how much data
 *    one ad can actually pay for where you are".
 *  - The Play submission kit declared rewarded video ads, an advertising ID,
 *    and an app called "Free eSIM Data". There is no ad SDK in the build and
 *    nothing about the product is free.
 *
 * None of them was written to mislead. Under Australian Consumer Law that is
 * not a defence, and neither is the fact that a different page got it right.
 *
 * ## The rule this encodes
 *
 * A claim about the product is either derived from the thing it describes, or
 * it is pinned here. There is no third category called "we will remember".
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { run } from "../src/lib/db";
import { upsertItem, setPrice } from "../src/lib/platform";
import { liveShopfront } from "../src/lib/live-destinations";
import { DATA_INVENTORY, NOT_COLLECTED } from "../src/lib/legal";

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

function read(rel: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", rel), "utf8");
}

/** Source with comments stripped, so the notes about a claim are not the claim. */
function prose(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

async function main() {
  console.log("\nwhat the site promises\n");

  /* ---- Speed and routing, against rows this check puts there itself ------ */

  /*
   * It seeds its own catalogue, and that is the whole point.
   *
   * The first version of this read whatever happened to be in the database. It
   * ran inside the suite after live-destinations.test.ts, which empties the
   * catalogue on its way out, so every claim about what is on sale was being
   * checked against nothing on sale. Twenty six checks passed and none of them
   * had looked at a plan. A promise audit that goes quiet when the shelf is
   * empty is worse than no audit, because it reports confidence it has not
   * earned.
   *
   * So both states are constructed here: a shop that throttles and routes
   * overseas, and a shop that does neither. The page has to be correct in both,
   * and the check fails if it did not actually see both.
   */
  async function wipe() {
    await run(`DELETE FROM catalog_prices`);
    await run(`DELETE FROM catalog_sources`);
    await run(`DELETE FROM catalog_items`);
  }

  async function seed(
    sku: string,
    attrs: { country: string; daily?: boolean; routing: string },
  ) {
    await upsertItem({
      sku,
      category: "esim",
      title: `${attrs.country} fixture`,
      active: true,
      attributes: { dataMb: 1024, days: 7, ...attrs },
    });
    await setPrice(sku, "AUD", 4.95, true);
  }

  const home = prose(read("src/app/home/page.tsx"));
  let sawThrottled = false;
  let sawClean = false;

  await wipe();
  await seed("test.promise.daily", { country: "JP", daily: true, routing: "home" });

  {
    const shop = await liveShopfront();
    check("a shop that throttles can be read", shop !== null);
    if (shop) {
      sawThrottled = shop.anyThrottled && shop.anyRoutedOverseas;
      check(
        "a daily capped plan is reported as throttled",
        shop.anyThrottled === true,
      );
      check(
        "a plan that is not locally routed is reported as leaving the country",
        shop.anyRoutedOverseas === true,
      );
    }
  }

  await wipe();
  await seed("test.promise.clean", { country: "TH", routing: "local" });

  {
    const shop = await liveShopfront();
    check("a shop that does neither can be read", shop !== null);
    if (shop) {
      sawClean = !shop.anyThrottled && !shop.anyRoutedOverseas;
      check(
        "a plan with no daily cap is not reported as throttled",
        shop.anyThrottled === false,
      );
      check(
        "a locally routed plan is not reported as leaving the country",
        shop.anyRoutedOverseas === false,
      );
    }
  }

  await wipe();

  check(
    "this check exercised both a throttled shop and a clean one",
    sawThrottled && sawClean,
    `throttled: ${sawThrottled}, clean: ${sawClean}`,
  );

  /* ---- And the page reads those facts rather than remembering them ------ */

  check(
    "the full speed promise is not hardcoded",
    !/Full speed throughout/.test(home) || /anyThrottled/.test(home),
    "a fixed claim about speed cannot survive a catalogue change",
  );
  check(
    "the speed claim is chosen from the catalogue, not typed",
    /speedCard\(\s*shop\?\.anyThrottled/.test(home),
  );
  check(
    "destination cards do not fall back to claiming local networks",
    !/Local networks/i.test(home),
  );
  check(
    "overseas routing is disclosed on the landing page when it is true",
    /anyRoutedOverseas/.test(home) && /exit point outside the country/i.test(home),
  );

  const checkout = prose(read("src/app/checkout/page.tsx"));
  check(
    "checkout still warns about overseas routing",
    /exit point outside the country/i.test(checkout),
  );
  check(
    "checkout states the refund position, which the landing page promises it does",
    /refund/i.test(checkout) && /refunds/.test(checkout),
  );

  /* ---- Advertising: three documents, one answer --------------------------- */

  /*
   * The privacy policy, the data inventory that generates the Play Data Safety
   * form, and the submission kit have to agree about whether this product shows
   * ads. They did not. The policy said no, the inventory said yes, and the kit
   * told Google to tick the box.
   */
  const privacy = prose(read("src/app/privacy/page.tsx"));
  const kit = read("scripts/gen-play-kit.ts");

  const policySaysNoAds = /no advertising/i.test(privacy) || /do not show you ads/i.test(privacy);
  check("the privacy policy says there is no advertising", policySaysNoAds);

  const inventoryText = DATA_INVENTORY.map((d) => `${d.purpose} ${d.description}`).join(" ");
  check(
    "and the data inventory does not describe an ad funded product",
    !/\bads?\b/i.test(inventoryText),
    inventoryText.match(/[^.]*\bads?\b[^.]*/i)?.[0],
  );

  /*
   * Parsed out of the generated kit, not out of the generator's prose.
   *
   * The first version of this searched the source for the word "rewarded" and
   * failed, because the rewritten kit explains in a paragraph that it used to
   * declare rewarded video and must not again. Discussing a mistake is not
   * making it. What matters is the declaration itself, which has a fixed shape:
   * a table row, or a purpose bullet. So that is what is read.
   */
  const submission = read("../PLAY-SUBMISSION.md");

  function row(field: string): string | null {
    const m = submission.match(new RegExp(`^\\|\\s*${field}\\s*\\|([^|]*)\\|`, "m"));
    return m ? m[1].trim() : null;
  }

  const ads = row("Contains ads");
  check("the kit declares an ads answer at all", ads !== null);
  check(
    "and it declares no ads, because there is no ad SDK in the build",
    ads !== null && /^\*\*No\*\*/.test(ads),
    ads,
  );

  const iap = row("In-app purchases");
  check(
    "it declares no Play billing, because plans are bought on the web",
    iap !== null && /^\*\*No\*\*/.test(iap),
    iap,
  );

  const appName = row("App name");
  check(
    "the listing name does not call a paid product free",
    appName !== null && !/\bfree\b/i.test(appName),
    appName,
  );

  check(
    "no advertising purpose is ticked on the Data Safety form",
    !/^- \*Advertising or marketing\*/m.test(submission),
  );

  /*
   * And the file on disk is what the generator produces today. A generated
   * document that has been hand edited is a document that disagrees with its
   * source the next time anybody runs the generator, which is the exact failure
   * legal.ts exists to prevent.
   */
  check(
    "the submission kit is generated, not hand edited",
    submission.includes("Do not edit this file by hand"),
  );

  const pkg = JSON.parse(read("package.json")) as {
    dependencies: Record<string, string>;
  };
  check(
    "no advertising SDK is a dependency",
    !Object.keys(pkg.dependencies).some((d) => /admob|ads/i.test(d)),
    Object.keys(pkg.dependencies).filter((d) => /admob|ads/i.test(d)).join(","),
  );
  check(
    "and the policy still says so out loud",
    NOT_COLLECTED.some((n) => /advertising identifier/i.test(n)),
  );

  /* ---- Timing claims ----------------------------------------------------- */

  /*
   * When the shop opens depends on a supplier wallet and a handset test, and
   * neither has a date. "Opening shortly" is a representation about a future
   * matter, and the grounds for it are the same grounds as for "opening in
   * March", which is to say none.
   */
  const SOON = [/\bshortly\b/i, /\bcoming soon\b/i, /\bin the next few (days|weeks)\b/i, /\bby (January|February|March|April|May|June|July|August|September|October|November|December)\b/i];
  const soon = SOON.find((re) => re.test(home));
  check("the landing page makes no timing promise about opening", soon === undefined, soon && home.match(soon)?.[0]);

  /* ---- Reach ------------------------------------------------------------- */

  const OVERCLAIM = [/\bworldwide\b/i, /across the globe/i, /\b\d{2,}\s*\+?\s*countries\b/i, /\bevery country\b/i];
  for (const [name, rel] of [
    ["the landing page", "src/app/home/page.tsx"],
    ["the plans page", "src/app/plans/page.tsx"],
    ["the checkout page", "src/app/checkout/page.tsx"],
  ] as const) {
    const body = prose(read(rel));
    const hit = OVERCLAIM.find((re) => re.test(body));
    check(`${name} claims no reach it cannot support`, hit === undefined, hit && body.match(hit)?.[0]);
  }

  /* ---- Promises that are real, and have to stay ------------------------- */

  /*
   * The opposite failure. These are commitments the business has chosen to
   * make, they are the reason somebody would buy from a small Australian
   * reseller rather than a large one, and quietly dropping one is its own kind
   * of dishonesty. Pinned so that removing one is a decision rather than an
   * edit.
   */
  check("the page still promises a person answers", /a person in Australian hours/i.test(home) || /Someone answers/i.test(home));
  check("the page still promises no automatic renewal", /Nothing renews behind you/i.test(home));
  check("the page still promises no activation fee", /No activation fee/i.test(home));
  check("the page still names Australian Consumer Law", /Australian Consumer Law/i.test(home));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
