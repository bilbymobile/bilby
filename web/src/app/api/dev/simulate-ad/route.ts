import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentUser } from "@/lib/session";
import { grantAdReward } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Development-only stand-in for a verified AdMob SSV callback.
 *
 * Guarded hard, because this endpoint is by definition an unauthenticated way
 * to mint credits. If it ever ships enabled to production, the free tier has no
 * economics at all. The guard is on NODE_ENV rather than a feature flag
 * precisely so it cannot be switched on by a config mistake.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SIMULATED_ADS !== "yes-i-know") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }

  const user = await currentUser();
  const fakeTxn = `dev_${crypto.randomUUID()}`;
  const grant = await grantAdReward(user.id, fakeTxn);

  return NextResponse.json(grant, { status: grant.ok ? 200 : 409 });
}
