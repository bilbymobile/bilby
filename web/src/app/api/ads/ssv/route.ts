import { NextRequest, NextResponse } from "next/server";
import { verifyAdMobCallback, VerifierKeysUnavailable } from "@/lib/admob-ssv";
import { userIdFromSignedValue } from "@/lib/session";
import { grantAdReward } from "@/lib/ledger";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AdMob rewarded SSV callback.
 *
 * This URL is configured in the AdMob console, called by Google's servers, and
 * is the ONLY code path in the application permitted to create ad credits.
 *
 * Response contract matters: AdMob retries non-2xx. Return 200 for anything we
 * have definitively handled — including duplicates and cap rejections — and
 * non-2xx only for transient failures we genuinely want retried. Returning 500
 * on "daily cap reached" produces an infinite retry storm against your own API.
 */
export async function GET(req: NextRequest) {
  let result;
  try {
    result = await verifyAdMobCallback(req.url);
  } catch (e) {
    if (e instanceof VerifierKeysUnavailable) {
      // Retryable. Do NOT 403 here — during a key-server blip that would
      // permanently discard every reward earned, and users would simply see
      // ads that stopped paying out.
      console.error("[ssv]", e.message);
      return new NextResponse("verifier unavailable", { status: 503 });
    }
    console.error("[ssv] unexpected verification error:", e);
    return new NextResponse("invalid", { status: 403 });
  }

  if (!result.valid) {
    // Unsigned or forged. Do not retry, do not credit, do log.
    console.warn("[ssv] rejected callback:", result.reason);
    return new NextResponse("invalid", { status: 403 });
  }

  const { transactionId, userId: signedUserId } = result;
  if (!transactionId || !signedUserId) {
    return new NextResponse("missing fields", { status: 400 });
  }

  const userId = await userIdFromSignedValue(signedUserId);
  if (!userId) {
    console.warn("[ssv] valid signature but unknown user");
    return new NextResponse("ok", { status: 200 });
  }

  // No country lookup here any more. grantAdReward reads home, current and
  // destination from the user row itself — this route used to pass the
  // handset's current location as the destination, which is precisely the
  // conflation that switched the free tier off for anyone earning before they
  // flew.
  const grant = await grantAdReward(userId, transactionId);

  if (!grant.ok) {
    // All of these are terminal states, not errors. 200 so Google stops retrying.
    console.info(`[ssv] no grant for ${userId}: ${grant.reason}`);
    return NextResponse.json({ ok: false, reason: grant.reason }, { status: 200 });
  }

  return NextResponse.json({ ok: true, grantedMb: grant.grantedMb }, { status: 200 });
}
