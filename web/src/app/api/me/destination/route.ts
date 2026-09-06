import { NextResponse } from "next/server";
import { currentUser, setDestination } from "@/lib/session";
import { isSupportedDestination, DESTINATIONS, destination } from "@/lib/destinations";
import { consume, limitHeaders } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The destination list, and the user's pick.
 *
 * This route no longer prices anything. It used to return an earning rate per
 * destination, computed from the wholesale rate card, which meant the rate card
 * shape leaked into a public response. Prices now come from the catalogue, and
 * the catalogue is priced per SKU rather than per country, so this is back to
 * what it should always have been: a list of places and one selection.
 */
export async function GET() {
  const user = await currentUser({ allowCreate: true });
  const gate = await consume("read", user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: limitHeaders(gate) });
  }

  return NextResponse.json({
    selected: user.destination,
    destinations: DESTINATIONS.map((d) => ({
      iso: d.iso,
      name: d.name,
      flag: d.flag,
      blurb: d.blurb ?? null,
      caution: d.caution ?? null,
    })),
  });
}

export async function PUT(req: Request) {
  const user = await currentUser({ allowCreate: true });
  const gate = await consume("read", user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: limitHeaders(gate) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const iso = (body as { destination?: unknown } | null)?.destination;

  // Allowlist, not sanitisation. Anything not explicitly offered is rejected
  // outright, including countries the list happens to know about but we do not
  // sell.
  if (!isSupportedDestination(iso)) {
    return NextResponse.json(
      { ok: false, reason: "unsupported_destination" },
      { status: 400 }
    );
  }

  const canonical = iso.toUpperCase();
  await setDestination(user.id, canonical);
  const d = destination(canonical)!;

  return NextResponse.json({ ok: true, destination: canonical, name: d.name });
}
