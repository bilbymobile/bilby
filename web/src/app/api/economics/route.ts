import { NextResponse } from "next/server";
import { budgetStatus, realisedEconomics, DEFAULT_VOLUME_TIER } from "@/lib/ledger";
import { quoteAllRegions, TARGET_CONTRIBUTION_MARGIN } from "@/lib/pricing";
import { freeSupplier, paidSupplier } from "@/lib/suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator dashboard feed.
 *
 * The one number to watch daily is `realised.contributionUsd`. If it is
 * negative for three consecutive days, the exchange rate in pricing.ts is wrong
 * for your actual traffic mix — lower the grant or raise
 * TARGET_CONTRIBUTION_MARGIN. Do not wait for the supplier invoice to tell you.
 */
export async function GET() {
  let freeWallet: number | null = null;
  let paidWallet: number | null = null;
  try {
    freeWallet = await freeSupplier().balanceUsd();
  } catch {}
  try {
    paidWallet = await paidSupplier().balanceUsd();
  } catch {}

  const since30d = new Date(Date.now() - 30 * 864e5).toISOString();

  return NextResponse.json({
    volumeTier: DEFAULT_VOLUME_TIER,
    targetContributionMargin: TARGET_CONTRIBUTION_MARGIN,
    budget: await budgetStatus(),
    realisedAllTime: await realisedEconomics(),
    realised30d: await realisedEconomics(since30d),
    supplierWallets: {
      free: Number.isNaN(freeWallet) ? null : freeWallet,
      paid: Number.isNaN(paidWallet) ? null : paidWallet,
    },
    regionQuotes: quoteAllRegions(DEFAULT_VOLUME_TIER),
  });
}
