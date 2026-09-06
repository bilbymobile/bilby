import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { one } from "@/lib/db";
import { paidSupplier } from "@/lib/suppliers";
import { consume, limitHeaders } from "@/lib/limits";
import { warn } from "@/lib/observe";

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
  const user = await currentUser({ allowCreate: true });

  /*
   * The lookup below is already scoped to this user, so a stranger cannot read
   * somebody else's activation material by guessing. This limit is about the
   * guessing itself: without it, a stolen cookie can be walked against an
   * unbounded number of ICCIDs at full speed, and the 404s that come back are
   * themselves an answer.
   */
  const gate = await consume("esimRead", user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: limitHeaders(gate) });
  }

  const row = (await one(
    `SELECT iccid, activation_code, smdp_address, matching_id, supplier
     FROM esims WHERE iccid = ? AND user_id = ?`,
    [iccid, user.id]
  )) as
    | {
        iccid: string;
        activation_code: string;
        smdp_address: string;
        matching_id: string;
        supplier: string;
      }
    | undefined;

  if (!row) {
    // 404 rather than 403: confirming an ICCID exists but belongs to someone
    // else is itself a leak.
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: limitHeaders(gate) },
    );
  }

  // Usage is best-effort. The activation material is the part the client
  // actually needs to function, so a supplier outage must not block it.
  let usage = null;
  try {
    usage = await paidSupplier().usage(iccid);
  } catch (e) {
    // Warning, not error: the customer still gets everything they need to
    // install. It is recorded because a usage endpoint that has been failing
    // for a week is a supplier conversation, and nobody starts that
    // conversation from a log line nobody reads.
    void warn("esim.usage", e, { iccid, supplier: row.supplier });
  }

  return NextResponse.json({
    iccid: row.iccid,
    activationCode: row.activation_code,
    smdpAddress: row.smdp_address,
    matchingId: row.matching_id,
    usage,
    // Both platforms, built server-side so the client never has to know the
    // encoding rules.
    installLinks: {
      ios: `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(row.activation_code)}`,
      android: `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(row.activation_code)}`,
    },
  }, { headers: limitHeaders(gate) });
}
