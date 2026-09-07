import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { setItemActive } from "@/lib/platform";
import { audit, can, currentStaff } from "@/lib/staff";
import { capture } from "@/lib/observe";

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

  /*
   * The landing page counts destinations that are on sale, and this is the only
   * thing in the system that changes that answer. Telling it here is what lets
   * that page be static: without this it would have to poll, and polling on the
   * page a stranger sees first means somebody pays for a database round trip
   * before the hero image starts loading.
   *
   * Both paths, because the apex serves the landing page at "/" through a
   * middleware rewrite while the cache entry is keyed on "/home".
   *
   * Not awaited into the response contract on purpose: a revalidation that
   * fails must not turn a successful activation into an error the operator has
   * to interpret. The SKU is on sale either way; the worst case is a page that
   * is up to a day stale, which is what the revalidate window is for.
   */
  try {
    revalidatePath("/home");
    revalidatePath("/");
  } catch (e) {
    await capture("catalog.revalidate", e, { sku });
  }

  return backTo(req, "/console/catalog", { done: sku });
}
