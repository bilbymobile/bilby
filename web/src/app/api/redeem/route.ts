import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentUser } from "@/lib/session";
import { REDEMPTION_THRESHOLD_MB, balanceMb, debitForRedemption } from "@/lib/ledger";
import { freeSupplier, InsufficientSupplierBalance } from "@/lib/suppliers";
import { one, run, nowIso } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Convert accrued ad credits into real data on a real profile.
 *
 * This is the only place money leaves the business on the free tier, so the
 * ordering below is deliberate and should not be rearranged:
 *
 *   1. Check balance.
 *   2. Provision or top up with the supplier.
 *   3. THEN debit the ledger.
 *
 * Debiting first would be "safer" for us and worse for the user: a supplier
 * failure after a debit silently eats credits they earned. Provisioning first
 * means the worst case is that we hand out data we did not charge for — a bug
 * we can detect and reconcile, rather than a bug that quietly robs users and
 * shows up as one-star reviews about missing data.
 */
export async function POST() {
  const user = await currentUser();
  const mb = await balanceMb(user.id);

  if (mb < REDEMPTION_THRESHOLD_MB) {
    return NextResponse.json(
      { ok: false, reason: "below_threshold", balanceMb: mb, needMb: REDEMPTION_THRESHOLD_MB },
      { status: 400 }
    );
  }

  const supplier = freeSupplier();
  const ref = `free_${crypto.randomUUID()}`;

  // One free-tier profile per user, forever. This is the "install once" promise
  // and it is also a cost control: profile issuance is billable on most
  // suppliers, so re-provisioning per redemption would be a recurring fee.
  const existing = await one<{ iccid: string }>(
    "SELECT iccid FROM esims WHERE user_id = ? AND is_free_tier = 1 LIMIT 1",
    [user.id]
  );

  try {
    const plans = await supplier.listPlans({ country: user.country });

    // Pick the largest packet we can fully fund. Buying more than the user has
    // earned is a gift; buying less strands credits.
    const candidates = plans
      .filter((p) => p.topUpSupported && p.dataMb <= mb)
      .sort((a, b) => b.dataMb - a.dataMb);

    const plan = candidates[0];
    if (!plan) {
      return NextResponse.json(
        { ok: false, reason: "no_fundable_plan", balanceMb: mb },
        { status: 409 }
      );
    }

    let iccid: string;

    if (existing) {
      await supplier.topUp(existing.iccid, plan.planId, ref);
      iccid = existing.iccid;
    } else {
      const order = await supplier.order(plan.planId, ref);
      iccid = order.profile.iccid;

      await run(
        `INSERT INTO esims
           (iccid, user_id, supplier, supplier_order, activation_code,
            smdp_address, matching_id, is_free_tier, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          iccid,
          user.id,
          supplier.id,
          order.supplierOrderId,
          order.profile.activationCode,
          order.profile.smdpAddress,
          order.profile.matchingId,
          nowIso(),
        ]
      );
    }

    const debited = await debitForRedemption(user.id, plan.dataMb, iccid);

    await run(
      `INSERT INTO orders (id, user_id, plan_id, iccid, kind, cost_usd, status, created_at)
       VALUES (?, ?, ?, ?, 'free_redemption', ?, 'provisioned', ?)`,
      [ref, user.id, plan.planId, iccid, plan.wholesaleUsd, nowIso()]
    );

    return NextResponse.json({
      ok: true,
      iccid,
      redeemedMb: plan.dataMb,
      newBalanceMb: await balanceMb(user.id),
      // Flag the reconcile case rather than swallowing it.
      ledgerWarning: debited ? undefined : "provisioned_without_debit",
      isNewProfile: !existing,
    });
  } catch (e) {
    if (e instanceof InsufficientSupplierBalance) {
      // Users keep their credits; this is our problem, not theirs.
      console.error("[redeem] SUPPLIER WALLET EMPTY — top up immediately");
      return NextResponse.json(
        { ok: false, reason: "temporarily_unavailable" },
        { status: 503 }
      );
    }
    console.error("[redeem] failed:", e);
    return NextResponse.json({ ok: false, reason: "provisioning_failed" }, { status: 500 });
  }
}
