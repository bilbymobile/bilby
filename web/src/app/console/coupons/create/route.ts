import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { createCode, type DiscountKind } from "@/lib/discounts";
import { audit, can, currentStaff } from "@/lib/staff";

export async function POST(req: NextRequest) {
  const me = await currentStaff();
  if (!can(me, "discounts.manage")) {
    return backTo(req, "/console/coupons", { err: "Your role cannot manage discounts." });
  }

  const form = await req.formData();
  const text = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const num = (k: string) => (text(k) === null ? null : Number(form.get(k)));

  try {
    const dests = form.getAll("destinations").map(String).filter(Boolean);
    const made = await createCode({
      code: text("code") ?? undefined,
      kind: (String(form.get("kind")) as DiscountKind) || "percent",
      value: Number(form.get("value")),
      maxRedemptions: num("maxRedemptions"),
      perUserLimit: num("perUserLimit") ?? 1,
      minSpend: num("minSpend"),
      destinations: dests.length ? dests : null,
      expiresAt: text("expiresAt"),
      note: text("note"),
      createdBy: me?.email ?? null,
    });

    await audit(me, "discount.create", made.code, undefined, made);
    return backTo(req, "/console/coupons", { made: made.code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create that code.";
    return backTo(req, "/console/coupons", { err: msg });
  }
}
