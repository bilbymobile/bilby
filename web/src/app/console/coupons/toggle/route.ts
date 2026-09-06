import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { setActive } from "@/lib/discounts";
import { audit, can, currentStaff } from "@/lib/staff";

export async function POST(req: NextRequest) {
  const me = await currentStaff();
  if (!can(me, "discounts.manage")) {
    return backTo(req, "/console/coupons", { err: "Your role cannot manage discounts." });
  }

  const form = await req.formData();
  const code = String(form.get("code") ?? "");
  const next = String(form.get("next")) === "1";

  const ok = await setActive(code, next);
  if (ok) await audit(me, next ? "discount.enable" : "discount.disable", code);

  return backTo(req, "/console/coupons", ok ? {} : { err: "No such code." });
}
