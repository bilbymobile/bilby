import { NextRequest, NextResponse } from "next/server";
import { paidSupplier } from "@/lib/suppliers";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retail catalogue.
 *
 * Retail price is computed here, server-side, from wholesale — never stored
 * per-plan and never sent from the client. Two constraints bind it:
 *
 *  - Your own target margin.
 *  - The supplier's minimum selling price, where one exists. Airalo forbids
 *    undercutting Airalo retail; violating that is a contract termination, not
 *    a warning. Whichever is higher wins.
 */
const TARGET_MARGIN = Number(process.env.RETAIL_TARGET_MARGIN ?? "0.45");

export async function GET(req: NextRequest) {
  const user = await currentUser();
  const country = req.nextUrl.searchParams.get("country") ?? undefined;

  try {
    const plans = await paidSupplier().listPlans({ country });

    const priced = plans
      .map((p) => {
        const marginPrice = p.wholesaleUsd / (1 - TARGET_MARGIN);
        const retail = Math.max(marginPrice, p.minSellUsd ?? 0);
        return {
          planId: p.planId,
          name: p.name,
          countries: p.countries,
          dataMb: p.dataMb,
          validityDays: p.validityDays,
          retailUsd: Math.round(retail * 100) / 100,
          perGbUsd: p.dataMb ? Math.round((retail / (p.dataMb / 1024)) * 100) / 100 : null,
          // Deliberately NOT exposed: wholesaleUsd. It is one screenshot away
          // from being a competitor's pricing intelligence.
        };
      })
      .sort((a, b) => a.retailUsd - b.retailUsd);

    return NextResponse.json({ country: country ?? user.country, plans: priced });
  } catch (e) {
    console.error("[catalog] supplier error:", e);
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
}
