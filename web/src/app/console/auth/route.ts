import { NextResponse, type NextRequest } from "next/server";

import { consumeLogin } from "@/lib/staff";

/**
 * Exchange a sign in link for a session.
 *
 * ## Two things here were bugs, and both are worth reading before editing
 *
 * **The redirect target is built from the Host header.** Neither `req.url` nor
 * `req.nextUrl` carries the host the browser asked for inside a route handler:
 * both report the origin the server is bound to, which locally is `localhost`
 * and on a platform is the internal deployment address. Redirecting there sends
 * the person to a different origin from the one their new cookie belongs to, so
 * they arrive signed out and bounce back to the sign in page. It presents as
 * "the session is never created".
 *
 * **The cookie is set on this response, not through `cookies()`.** The request
 * scoped helper only reaches the browser when Next constructs the response
 * itself. Setting it there and returning our own response drops it silently,
 * which is the same symptom from a completely different cause.
 *
 * The token is consumed with a conditional update, so a mail scanner that
 * prefetches the link cannot produce a second session. It can still burn the
 * link, which is why the failure path sends people back to request another
 * rather than showing an error and stopping.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.includes(".local") ? "http" : "https");

  const to = (path: string) => NextResponse.redirect(`${proto}://${host}${path}`, 307);

  const raw = req.nextUrl.searchParams.get("t");
  if (!raw) return to("/console/login");

  const result = await consumeLogin(raw, {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    ua: req.headers.get("user-agent") ?? undefined,
    secure: proto === "https",
  });

  if (!result) return to("/console/login?expired=1");

  const res = to("/console");
  res.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options);
  return res;
}
