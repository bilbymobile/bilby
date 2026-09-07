import { NextRequest, NextResponse } from "next/server";
import { listCatalog } from "@/lib/platform";
import { isSupportedDestination } from "@/lib/destinations";
import { publicAttributes } from "@/lib/catalog-public";
import { callerIp, consume, limitHeaders } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The retail catalogue, as the mobile client sees it.
 *
 * Reads stored rows. It used to call the supplier on every request and compute
 * retail from wholesale times a margin constant, which meant three things: the
 * price could differ between two requests, a supplier outage emptied the shop,
 * and the response was one arithmetic step away from being the wholesale rate
 * card. Nothing here divides by anything.
 *
 * Only active items are returned, and inactive is the default for a newly
 * seeded item. A SKU becomes visible because somebody decided it should be, not
 * because it appeared on a rate card.
 */
export async function GET(req: NextRequest) {
  const gate = await consume("catalog", await callerIp());
  if (!gate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: limitHeaders(gate) });
  }

  const country = req.nextUrl.searchParams.get("country");
  const currency = (req.nextUrl.searchParams.get("currency") ?? "AUD").toUpperCase();

  // Allowlisted, because it selects catalogue rows. Absent means everything.
  if (country !== null && !isSupportedDestination(country)) {
    return NextResponse.json({ error: "unsupported_destination" }, { status: 400 });
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: "bad_currency" }, { status: 400 });
  }

  const items = await listCatalog(
    "esim",
    currency,
    country ? { attribute: ["country", country.toUpperCase()] } : {},
  );

  return NextResponse.json({
    country: country?.toUpperCase() ?? null,
    currency,
    plans: items.map((p) => ({
      sku: p.sku,
      title: p.title,
      subtitle: p.subtitle,
      // Attributes are the category's own facts, filtered to the ones a
      // customer may see. This used to pass the whole object through, on the
      // reasoning that adding a field to an eSIM SKU should not mean editing
      // this route. That reasoning cost us: the seed script writes the
      // economics into attributes for the console, so wholesale cost, target
      // margin and contribution per sale were served to anybody with the URL.
      //
      // The filter is an allowlist in @/lib/catalog-public. Adding a customer
      // facing field now does mean editing one line there, and that is the
      // correct price for making the default safe.
      attributes: publicAttributes(p.attributes),
      currency: p.currency,
      price: p.sellAmount,
      // Deliberately NOT exposed: anything from catalog_sources, and anything
      // in attributes that is not on the allowlist. Cost, supplier identity and
      // the external plan id are one screenshot away from being a competitor's
      // pricing intelligence, and a supplier's name is leverage they can use in
      // the next rate negotiation.
    })),
  }, { headers: limitHeaders(gate) });
}
