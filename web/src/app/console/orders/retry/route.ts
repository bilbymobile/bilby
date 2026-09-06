import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { retryItem } from "@/lib/fulfil";
import { audit, can, currentStaff } from "@/lib/staff";

export const runtime = "nodejs";

/**
 * Try one failed line again.
 *
 * This is the only path that clears a claimed idempotency key, and it exists as
 * a button rather than a loop for one reason: a timeout against a supplier is
 * indistinguishable from a success we did not hear about, so somebody has to
 * decide it is safe. Audited, because "who authorised the second attempt" is
 * exactly the question asked when a customer turns out to have two profiles.
 */
export async function POST(req: NextRequest) {
  const me = await currentStaff();
  const form = await req.formData();
  const itemId = String(form.get("itemId") ?? "");
  const orderId = String(form.get("orderId") ?? "");
  const back = orderId ? `/console/orders/${orderId}` : "/console/orders";

  if (!can(me, "orders.retry")) {
    return backTo(req, back, { err: "Your role cannot retry fulfilment." });
  }
  if (!itemId) return backTo(req, back, { err: "No line named." });

  await audit(me, "order.retry", itemId);

  const ok = await retryItem(itemId);
  return backTo(
    req,
    back,
    ok
      ? { done: "Delivered." }
      : { err: "It failed again. The reason is on the line below." },
  );
}
