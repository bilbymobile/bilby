import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { setItemActive } from "@/lib/platform";
import { audit, can, currentStaff } from "@/lib/staff";

export const runtime = "nodejs";

/**
 * Put one SKU on sale, or take it off.
 *
 * The single most consequential button in the console: it is the difference
 * between a plan nobody can buy and a plan that will take a stranger's money in
 * the next minute. Audited, permission checked, and refused with a reason
 * rather than a shrug.
 */
export async function POST(req: NextRequest) {
  const me = await currentStaff();
  if (!can(me, "costing.edit")) {
    return backTo(req, "/console/catalog", {
      err: "Your role cannot change what is on sale.",
    });
  }

  const form = await req.formData();
  const sku = String(form.get("sku") ?? "");
  const next = String(form.get("next")) === "1";

  const res = await setItemActive(sku, next);
  if (!res.ok) {
    return backTo(req, "/console/catalog", { err: `${sku}: ${res.reason}` });
  }

  await audit(me, next ? "catalog.activate" : "catalog.deactivate", sku);
  return backTo(req, "/console/catalog", { done: sku });
}
