/**
 * Guards the one invariant the whole free tier rests on:
 *
 *   Every region where the free tier is ENABLED must be contribution-positive.
 *
 * If someone later "improves" the UX by raising MIN_GRANT_MB, or drops
 * TARGET_CONTRIBUTION_MARGIN to be generous, this test is what tells them they
 * just turned the free tier into an uncapped liability — instead of the
 * supplier invoice telling them six weeks later.
 *
 * Run: npx tsx scripts/economics.test.ts
 */
import assert from "node:assert";
import {
  quoteAllRegions,
  quoteGrant,
  quoteEarning,
  compareDestination,
  breakEvenUsdPerGb,
  costPerMb,
  regionForCountry,
  freeTierAllowed,
  type VolumeTier,
} from "../src/lib/pricing";
import { DESTINATIONS, isSupportedDestination } from "../src/lib/destinations";

const TIERS: VolumeTier[] = ["starter", "growth", "scale", "enterprise"];
let pass = 0;

function check(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
  pass++;
}

for (const tier of TIERS) {
  check(`[${tier}] every enabled region is contribution-positive`, () => {
    for (const q of quoteAllRegions(tier)) {
      if (freeTierAllowed(q.sampleCountry, tier)) {
        assert.ok(
          q.contributionUsd > 0,
          `${q.region} enabled but contributes ${q.contributionUsd}`
        );
      }
    }
  });

  check(`[${tier}] grants never exceed the hard ceiling`, () => {
    for (const q of quoteAllRegions(tier)) {
      assert.ok(q.grantMb <= 60, `${q.region} granted ${q.grantMb} MB`);
    }
  });
}

check("unknown country codes fail closed, not open", () => {
  const unknown = quoteGrant("ZZ", "starter");
  const worst = quoteGrant("ZA", "starter"); // sub-Saharan Africa: most expensive
  assert.equal(unknown.region, worst.region);
  assert.equal(
    freeTierAllowed("ZZ", "starter"),
    false,
    "an unrecognised country must not unlock the free tier"
  );
});

check("cheaper supply raises the grant monotonically", () => {
  const s = quoteGrant("US", "starter").grantMb;
  const g = quoteGrant("US", "growth").grantMb;
  const sc = quoteGrant("US", "scale").grantMb;
  assert.ok(s <= g && g <= sc, `expected starter<=growth<=scale, got ${s},${g},${sc}`);
});

check("the AU home market is correctly refused at starter volume", () => {
  // Oceania roaming wholesale is the second most expensive region on earth.
  // At rack rate an ad view cannot fund a usable grant there — the engine must
  // say so rather than quietly hand out 5 MB at a loss.
  assert.equal(freeTierAllowed("AU", "starter"), false);
  // ...and it must become viable once volume earns a real rate card.
  assert.equal(freeTierAllowed("AU", "scale"), true);
});


// ── Day-one reachability ───────────────────────────────────────────────────
// The bug this catches shipped once already: the code default was 100 MB while
// every .env ran 50, so development looked fine and a fresh deploy would have
// given every new user, in every country, nothing on their first day.
check("a new user can reach the redemption threshold on day one", () => {
  const { assertThresholdReachable, REDEMPTION_THRESHOLD_MB, DAILY_AD_CAP } =
    require("../src/lib/ledger");
  assertThresholdReachable("starter");
  console.log(
    `      (threshold ${REDEMPTION_THRESHOLD_MB} MB, cap ${DAILY_AD_CAP} ads/day)`
  );
});

// ── The destination model ──────────────────────────────────────────────────
// Everything below guards the change that separated "where the ad is served"
// from "where the data is used". The bug it fixes was not a crash — it was an
// app that worked perfectly and told its best users to go away.

const HOME = "AU";

check("every offered destination can pay out on day one, somehow", () => {
  const { unreachableDestinations } = require("../src/lib/ledger");
  const broken = unreachableDestinations(
    HOME,
    DESTINATIONS.map((d) => d.iso),
    "starter"
  );
  assert.deepEqual(
    broken,
    [],
    `destinations in the picker that can never reach the threshold: ${JSON.stringify(broken)}`
  );
});

check("earning at home is priced at the full home rate, no roaming discount", () => {
  // The whole justification for the feature. An Australian watching an
  // Australian ad on an Australian IP is not a hypothesis about how much eCPM
  // survives roaming — so no retention factor may be applied.
  const atHome = quoteEarning({
    homeIso: "AU",
    currentIso: "AU",
    destinationIso: "TH",
  });
  const abroad = quoteEarning({
    homeIso: "AU",
    currentIso: "TH",
    destinationIso: "TH",
  });
  assert.ok(
    atHome.blendedRevenuePerViewUsd > abroad.blendedRevenuePerViewUsd,
    "at-home revenue must exceed roaming revenue for the same destination"
  );
  assert.ok(
    atHome.grantMb > abroad.grantMb,
    `expected a larger grant at home, got ${atHome.grantMb} vs ${abroad.grantMb}`
  );
});

check("cost always follows the destination, never the current location", () => {
  // Same destination, three very different places to be standing. Every quote
  // must be costed at the DESTINATION's per-MB rate — if standing somewhere
  // cheap made the data cheaper, the arbitrage would be imaginary and the
  // ledger would be booking costs it never incurs.
  //
  // Compared against costPerMb rather than against each other: the grants
  // legitimately differ between these cases (that is the whole point), so
  // dividing dataCostUsd by grantMb compares two differently-rounded numbers
  // and fails on floating-point noise rather than on anything real.
  const expectedPerMb = costPerMb(regionForCountry("JP"), "starter");

  for (const currentIso of ["AU", "US", "TH"]) {
    const q = quoteEarning({ homeIso: "AU", currentIso, destinationIso: "JP" });
    assert.equal(q.destinationRegion, "east_asia");
    assert.ok(
      Math.abs(q.dataCostUsd - q.grantMb * expectedPerMb) < 1e-5,
      `standing in ${currentIso}: cost ${q.dataCostUsd} != ${q.grantMb} MB x ${expectedPerMb}`
    );
  }
});

check("no destination is ever granted at a loss", () => {
  for (const d of DESTINATIONS) {
    for (const currentIso of [HOME, d.iso]) {
      const q = quoteEarning({
        homeIso: HOME,
        currentIso,
        destinationIso: d.iso,
      });
      // A clamped quote is refused upstream, so only unclamped ones must be
      // positive — but a clamped quote that is ALSO positive would mean the
      // floor is costing us nothing, which is worth knowing if it ever happens.
      if (!q.clamped) {
        assert.ok(
          q.contributionUsd > 0,
          `${d.iso} from ${currentIso} contributes ${q.contributionUsd}`
        );
      }
    }
  }
});

check("the destination allowlist rejects anything not in the catalogue", () => {
  // This value selects a row in the wholesale rate card. Anything that gets
  // past it prices a grant.
  assert.equal(isSupportedDestination("TH"), true);
  assert.equal(isSupportedDestination("th"), true, "must be case-insensitive");
  // ZA is a country the pricing engine knows about but we do not sell — the
  // allowlist has to be the catalogue, not the engine's country table.
  assert.equal(isSupportedDestination("ZA"), false);
  assert.equal(isSupportedDestination(""), false);
  assert.equal(isSupportedDestination(null), false);
  assert.equal(isSupportedDestination(42), false);
});

check("bank-before-you-fly is set only when arriving genuinely fails", () => {
  for (const d of DESTINATIONS) {
    const c = compareDestination(HOME, d.iso, "starter");
    if (c.bankBeforeYouFly) {
      assert.ok(c.atHomeAllowed, `${d.iso} flagged but earning at home fails`);
      assert.ok(
        !c.onArrivalAllowed,
        `${d.iso} flagged but earning on arrival works fine`
      );
    }
  }
});

check("Australia is one rate card away, not structurally impossible", () => {
  // The competitor runs a free tier in Australia. So can we — the blocker is
  // the supply side and it is small. If this assertion ever starts failing
  // because the gap widened, that is a commercial signal, not a test to delete.
  const b = breakEvenUsdPerGb("AU", "AU", "starter");
  assert.ok(
    b.shortfallPct > 0 && b.shortfallPct < 10,
    `AU should be within 10% of viable at rack rate, is ${b.shortfallPct}%`
  );
  // ...and it must actually switch on once volume earns a better rate.
  assert.equal(compareDestination("AU", "AU", "starter").atHomeAllowed, false);
  assert.equal(compareDestination("AU", "AU", "growth").atHomeAllowed, true);
  console.log(
    `      (AU needs $${b.requiredUsdPerGb}/GB, rack rate is $${b.currentUsdPerGb} — ` +
      `${b.shortfallPct}% away; viable from the growth tier)`
  );
});

check("China and Pakistan are priced, not just listed", () => {
  for (const iso of ["CN", "PK"]) {
    assert.ok(isSupportedDestination(iso), `${iso} missing from the catalogue`);
    const c = compareDestination(HOME, iso, "starter");
    assert.ok(
      c.atHomeMb > 0 && c.atHomeAllowed,
      `${iso} must be earnable before departure, got ${c.atHomeMb} MB allowed=${c.atHomeAllowed}`
    );
  }
  // Pakistan specifically: south Asian ad rates cannot fund it in-country, so
  // it must be flagged rather than quietly offered and then refused at the
  // moment the user actually tries to earn.
  assert.equal(
    compareDestination(HOME, "PK", "starter").bankBeforeYouFly,
    true,
    "Pakistan should be flagged as bank-before-you-fly at starter volume"
  );
});

console.log(`\n${pass} checks passed`);
