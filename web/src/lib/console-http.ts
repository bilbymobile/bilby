import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirect helpers for the console's form handlers.
 *
 * The console uses plain HTML form posts against route handlers rather than
 * server actions.
 *
 * To be straight about how that decision was reached: it was first made on a
 * misdiagnosis. A test was clicking the wrong submit button, the sign out one
 * in the header, and the resulting bounce to the sign in page looked exactly
 * like server actions losing the session cookie. They were not.
 *
 * The choice stands anyway, on its own merits. A form post works with
 * JavaScript disabled or still loading, which for a tool whose whole job is to
 * fix things when something is broken is worth having. Every mutation is a
 * plain HTTP request you can reproduce with curl, which is what made the real
 * bug findable in the end. And the handlers are ordinary routes rather than
 * closures, so permission checks sit at the top of a file rather than nested
 * inside a component.
 *
 * The redirect target is built from the Host header, never from `req.url` or
 * `req.nextUrl`: inside a route handler both report the origin the server is
 * bound to rather than the one the browser asked for, which sends people to a
 * different origin from the one their cookie belongs to.
 */
export function backTo(req: NextRequest, path: string, params?: Record<string, string>) {
  const host = req.headers.get("host") ?? req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.includes(".local") ? "http" : "https");

  const u = new URL(`${proto}://${host}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) u.searchParams.set(k, v);

  // 303 so the browser follows with GET. A 307 would repeat the POST on
  // refresh, which for "create a discount code" means two codes.
  return NextResponse.redirect(u, 303);
}
