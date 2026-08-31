import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { one } from "@/lib/db";
import { freeSupplier, paidSupplier } from "@/lib/suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Activation material and live usage for one eSIM.
 *
 * Added for the Flutter client, which needs the LPA string to hand to the
 * system installer. Scoped to the requesting user — an ICCID is guessable
 * enough that an unscoped lookup would let anyone enumerate other people's
 * activation codes, and an activation code is bearer credential: whoever holds
 * it can install the profile.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ iccid: string }> }
) {
  const { iccid } = await params;
  const user = await currentUser();

  const row = (await one(
    `SELECT iccid, activation_code, smdp_address, matching_id, supplier, is_free_tier
     FROM esims WHERE iccid = ? AND user_id = ?`,
    [iccid, user.id]
  )) as
    | {
        iccid: string;
        activation_code: string;
        smdp_address: string;
        matching_id: string;
        supplier: string;
        is_free_tier: number;
      }
    | undefined;

  if (!row) {
    // 404 rather than 403: confirming an ICCID exists but belongs to someone
    // else is itself a leak.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Usage is best-effort. The activation material is the part the client
  // actually needs to function, so a supplier outage must not block it.
  let usage = null;
  try {
    const supplier = row.is_free_tier ? freeSupplier() : paidSupplier();
    usage = await supplier.usage(iccid);
  } catch (e) {
    console.warn(`[esim] usage lookup failed for ${iccid}:`, e);
  }

  return NextResponse.json({
    iccid: row.iccid,
    activationCode: row.activation_code,
    smdpAddress: row.smdp_address,
    matchingId: row.matching_id,
    isFreeTier: row.is_free_tier === 1,
    usage,
    // Both platforms, built server-side so the client never has to know the
    // encoding rules.
    installLinks: {
      ios: `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(row.activation_code)}`,
      android: `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(row.activation_code)}`,
    },
  });
}
