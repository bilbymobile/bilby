import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { requestLogin } from "@/lib/staff";
import { consume } from "@/lib/limits";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  /*
   * Limited on the address AND on the source, because they stop different
   * things. Per address stops somebody hammering one mailbox with sign in links
   * until the owner clicks one out of irritation. Per source stops somebody
   * walking a list of addresses to find out which ones are staff, and stops the
   * mail bill being set by a stranger.
   *
   * Refused silently, with the same answer as success. Telling a caller they
   * were rate limited on this route tells them the address they guessed was
   * worth limiting.
   */
  const byEmail = await consume("staffLogin", `email:${email.toLowerCase()}`);
  const bySource = await consume("staffLogin", `ip:${ip}`);

  if (!byEmail.ok || !bySource.ok) {
    return backTo(req, "/console/login", { sent: "1" });
  }

  const res = await requestLogin(email, ip);

  // The link comes back only when no mail provider is configured, so the very
  // first sign in is possible before an email key exists.
  return backTo(
    req,
    "/console/login",
    res.devLink ? { sent: "1", link: res.devLink } : { sent: "1" },
  );
}
