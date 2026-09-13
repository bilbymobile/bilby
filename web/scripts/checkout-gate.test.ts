/**
 * Can the shop take money when nobody has said it may?
 *
 * Run with:
 *   npx tsx scripts/checkout-gate.test.ts
 *
 * ## The failure this exists to stop
 *
 * Tonight the shop goes live with real plans, real prices and a Stripe key set,
 * and with the supplier account not yet funded. Every one of those is fine on
 * its own. Together they describe a shop that can accept a card and deliver a
 * simulated eSIM, which is the single worst thing this product could do, and it
 * would not look like a bug from the inside: the payment would succeed, the
 * webhook would fire, an order would be marked paid, and the customer would get
 * a profile that does not connect to anything.
 *
 * So opening the shop is a separate, deliberate act from configuring Stripe,
 * and the switch fails closed in every direction: unset, empty, "1", "yes",
 * "TRUE " with a space, any of them mean closed except the exact word true.
 *
 * ## The gate is the route, not the button
 *
 * The plans page hides the Buy button when the shop is closed. That is a
 * courtesy. A hidden button is not a gate, because the request it would have
 * made can be typed by hand, and the checkout API is the thing holding the
 * money. Both are checked here, and the source of truth for both is one
 * function, so they cannot drift apart.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { checkoutOpen, paymentsConfigured, __resetStripe } from "../src/lib/stripe";

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

/**
 * Set the environment and clear the memoised Stripe client.
 *
 * The first version of this reimported the module under a cache busting query
 * string instead, on the assumption that a fresh instance would re read the
 * environment. The loader strips the query, the same instance came back with
 * its client still memoised, and the "no key" case reported the shop as open.
 * The check caught it, which is the only reason this comment exists.
 */
function gateWith(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  __resetStripe();
  return { checkoutOpen, paymentsConfigured };
}

const KEY = "sk_test_0000000000000000000000000";

async function main() {
  console.log("\nthe checkout gate\n");

  /* ---- The flag ------------------------------------------------------- */

  const cases: Array<[string, string | undefined, boolean]> = [
    ["unset means closed", undefined, false],
    ["empty means closed", "", false],
    ["\"false\" means closed", "false", false],
    ["\"1\" means closed, because it is not the word", "1", false],
    ["\"yes\" means closed, for the same reason", "yes", false],
    ["\"open\" means closed", "open", false],
    ["\"true\" opens it", "true", true],
    ["\"TRUE\" opens it", "TRUE", true],
    ["\" true \" opens it, because whitespace is an editor, not an intent", " true ", true],
  ];

  for (const [name, value, want] of cases) {
    const g = gateWith({ CHECKOUT_OPEN: value, STRIPE_SECRET_KEY: KEY });
    check(name, g.checkoutOpen() === want, g.checkoutOpen());
  }

  /* ---- Both halves are required --------------------------------------- */

  {
    const g = gateWith({ CHECKOUT_OPEN: "true", STRIPE_SECRET_KEY: undefined });
    check(
      "open with no Stripe key is still closed",
      g.checkoutOpen() === false,
      g.checkoutOpen(),
    );
  }
  {
    const g = gateWith({ CHECKOUT_OPEN: undefined, STRIPE_SECRET_KEY: KEY });
    check(
      "a Stripe key on its own does not open the shop",
      g.checkoutOpen() === false,
      g.checkoutOpen(),
    );
    check(
      "and payments being configured is still reported honestly",
      g.paymentsConfigured() === true,
    );
  }

  /* ---- The route holds it, not the button ----------------------------- */

  /*
   * Read rather than executed. Standing up the Next route handler needs a
   * request, a session, a rate limiter and a database, and the thing worth
   * pinning is not how those behave: it is that the gate is present in the
   * money path at all. A check that is expensive to run is a check that gets
   * commented out.
   */
  const route = readFileSync(
    resolve(import.meta.dirname, "../src/app/api/checkout/route.ts"),
    "utf8",
  );
  check(
    "the checkout route imports the gate",
    /import\s*{[^}]*checkoutOpen[^}]*}\s*from\s*"@\/lib\/stripe"/.test(route),
  );
  check(
    "the checkout route refuses when the shop is closed",
    /if\s*\(!checkoutOpen\(\)\)/.test(route),
  );
  check(
    "and it refuses before it writes an order",
    route.indexOf("checkoutOpen()") < route.indexOf("createDraft("),
    `${route.indexOf("checkoutOpen()")} vs ${route.indexOf("createDraft(")}`,
  );

  const plans = readFileSync(
    resolve(import.meta.dirname, "../src/app/plans/page.tsx"),
    "utf8",
  );
  check(
    "the shop asks the same function the route asks",
    plans.includes("checkoutOpen()"),
  );
  check(
    "and it does not offer a purchase it cannot complete",
    /open\s*\?\s*\(/.test(plans) && plans.includes("Opening soon"),
  );

  const checkout = readFileSync(
    resolve(import.meta.dirname, "../src/app/checkout/page.tsx"),
    "utf8",
  );
  check(
    "the checkout page asks it too, rather than only asking Stripe",
    checkout.includes("checkoutOpen()"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
