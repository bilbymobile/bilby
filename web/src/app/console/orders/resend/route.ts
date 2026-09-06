import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { redeliver } from "@/lib/deliver";
import { audit, can, currentStaff } from "@/lib/staff";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const me = await currentStaff();
  const form = await req.formData();
  const orderId = String(form.get("orderId") ?? "");
  const back = orderId ? `/console/orders/${orderId}` : "/console/orders";

  if (!can(me, "orders.retry")) {
    return backTo(req, back, { err: "Your role cannot resend delivery." });
  }

  await audit(me, "order.resend", orderId);

  const res = await redeliver(orderId);
  return backTo(
    req,
    back,
    res.sent
      ? { done: "Sent again." }
      : {
          err:
            res.reason === "no_email"
              ? "There is no email address on this account, so there is nowhere to send it."
              : res.reason === "nothing_to_deliver"
                ? "Nothing on this order has been delivered yet, so there is nothing to send."
                : "The mail provider refused. The reason is on the health page.",
        },
  );
}
