import { NextResponse } from "next/server";
import { currentUser, setDestination } from "@/lib/session";
import { isSupportedDestination, DESTINATIONS, destination } from "@/lib/destinations";
import { compareDestination } from "@/lib/pricing";
import { DEFAULT_VOLUME_TIER } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The destination catalogue, priced for THIS user.
 *
 * Priced server-side rather than shipping the rate card to the client. The
 * wholesale table in pricing.ts is the commercial core of the product; a
 * competitor should have to guess at it, not read it out of a JSON response.
 */
export async function GET() {
  const user = await currentUser();

  return NextResponse.json({
    selected: user.destination,
    destinations: DESTINATIONS.map((d) => {
      const c = compareDestination(user.homeCountry, d.iso, DEFAULT_VOLUME_TIER);
      return {
        iso: d.iso,
        name: d.name,
        flag: d.flag,
        blurb: d.blurb ?? null,
        caution: d.caution ?? null,
        atHomeMb: c.atHomeMb,
        onArrivalMb: c.onArrivalMb,
        // Three booleans rather than one status string, because the UI makes
        // three different decisions from them and a string would have to be
        // parsed back apart.
        freeTierAtHome: c.atHomeAllowed,
        freeTierOnArrival: c.onArrivalAllowed,
        bankBeforeYouFly: c.bankBeforeYouFly,
      };
    }),
  });
}

export async function PUT(req: Request) {
  const user = await currentUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const iso = (body as { destination?: unknown } | null)?.destination;

  // Allowlist, not sanitisation. This value selects a row in the wholesale rate
  // card, so anything not explicitly offered is rejected outright — including
  // countries the engine happens to know about but we do not sell.
  if (!isSupportedDestination(iso)) {
    return NextResponse.json(
      { ok: false, reason: "unsupported_destination" },
      { status: 400 }
    );
  }

  const canonical = iso.toUpperCase();
  setDestination(user.id, canonical);

  const c = compareDestination(user.homeCountry, canonical, DEFAULT_VOLUME_TIER);
  const d = destination(canonical)!;

  return NextResponse.json({
    ok: true,
    destination: canonical,
    name: d.name,
    // Echoing the new rate back saves the client a second round trip and, more
    // usefully, means the number it shows came from the same call that changed
    // it — no window where the UI shows a rate for the previous destination.
    atHomeMb: c.atHomeMb,
    onArrivalMb: c.onArrivalMb,
    bankBeforeYouFly: c.bankBeforeYouFly,
  });
}
