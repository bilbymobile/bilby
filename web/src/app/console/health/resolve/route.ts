import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { currentStaff, can, audit } from "@/lib/staff";
import { resolveError } from "@/lib/observe";

export const runtime = "nodejs";

/**
 * Mark one failure group handled.
 *
 * Audited, because "who decided this was fine" is exactly the question asked
 * three weeks later when it turns out it was not.
 */
export async function POST(req: NextRequest) {
  const me = await currentStaff();
  if (!me || !can(me, "orders.retry")) {
    return backTo(req, "/console/health", { denied: "1" });
  }

  const form = await req.formData();
  const fingerprint = String(form.get("fingerprint") ?? "");
  if (!fingerprint) return backTo(req, "/console/health");

  const changed = await resolveError(fingerprint);
  if (changed) await audit(me, "health.resolve", fingerprint);

  return backTo(req, "/console/health");
}
