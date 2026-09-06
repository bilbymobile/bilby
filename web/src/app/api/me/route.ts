import { NextResponse } from "next/server";
import { currentUser, effectiveDestination } from "@/lib/session";
import { entitlementsFor } from "@/lib/platform";
import { destinationName } from "@/lib/destinations";
import { all } from "@/lib/db";
import { consume, limitHeaders } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything the client needs to render the account screen in one round trip.
 *
 * This used to be the earn screen: ad counts, a megabyte balance, a daily cap
 * and a redemption threshold. All of that is gone with the free tier. What is
 * left is the only thing a paying customer actually asks the server: who am I,
 * where am I going, and what have I bought.
 *
 * Entitlements come from the platform layer and are deliberately not eSIM
 * shaped. An entitlement is "a thing you are owed", and the payload it carries
 * is opaque here. The moment this route learns what an ICCID is, the platform
 * boundary has been crossed and the second category becomes expensive.
 */
export async function GET() {
  const user = await currentUser({ allowCreate: true });

  // Counted against the session rather than the source address. A signed in
  // caller has an identity worth limiting, and limiting by IP here would punish
  // everybody behind one mobile carrier's NAT for one of them.
  const gate = await consume("read", user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: limitHeaders(gate) });
  }

  const dest = effectiveDestination(user);

  const ents = await entitlementsFor(user.id);

  const orders = await all(
    `SELECT id, sell_currency, sell_amount, status, created_at, paid_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`,
    [user.id]
  );

  return NextResponse.json({
    country: user.country,
    homeCountry: user.homeCountry,

    // ── Destination ──────────────────────────────────────────────────────
    // `destination` is null until the user has been through the picker, and
    // the app uses exactly that to decide whether to show it. Do not coalesce
    // this to a country code for tidiness — doing so would silently skip
    // first run setup for every user.
    destination: user.destination,
    destinationName: destinationName(dest),
    needsDestination: user.destination === null,
    atHome: user.country === user.homeCountry,

    orders,
    entitlements: ents,
  }, { headers: limitHeaders(gate) });
}
