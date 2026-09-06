import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { issueRefund } from "@/lib/refunds";
import { audit, can, currentStaff } from "@/lib/staff";

export const runtime = "nodejs";

/**
 * Move money back.
 *
 * The one irreversible action in the console. Audited before the attempt rather
 * than after it, so an attempt that succeeds at Stripe and then fails to record
 * still leaves a trace of who tried.
 */
export async function POST(req: NextRequest) {
  const me = await currentStaff();
  const form = await req.formData();
  const orderId = String(form.get("orderId") ?? "");
  const back = orderId ? `/console/orders/${orderId}` : "/console/orders";

  if (!can(me, "refunds.issue")) {
    return backTo(req, back, { err: "Your role cannot issue refunds." });
  }

  const raw = String(form.get("amount") ?? "");
  const amount = raw ? Number(raw) : undefined;
  if (amount !== undefined && !Number.isFinite(amount)) {
    return backTo(req, back, { err: "That is not an amount." });
  }

  const reasonRaw = String(form.get("reason") ?? "requested_by_customer");
  const reason =
    reasonRaw === "duplicate" || reasonRaw === "fraudulent"
      ? reasonRaw
      : ("requested_by_customer" as const);

  await audit(me, "order.refund", orderId, null, { amount, reason });

  const res = await issueRefund(orderId, { amount, reason });
  return backTo(
    req,
    back,
    res.ok
      ? { done: `Refunded ${res.amount?.toFixed(2)}.` }
      : { err: res.reason ?? "The refund did not go through." },
  );
}
