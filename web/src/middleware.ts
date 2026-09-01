import { NextResponse, type NextRequest } from "next/server";

import { HOSTS, roleForHost } from "@/lib/hosts";

/**
 * Host routing, and access control for the operator surfaces.
 *
 * ## Why this exists
 *
 * `/ops` and `/api/economics` were publicly readable on the live site. Between
 * them they publish, to anyone who types the URL:
 *
 *   * wholesale cost per megabyte for every region
 *   * realised contribution per ad view
 *   * the target contribution margin
 *   * supplier wallet balances
 *   * the daily free tier budget and how much of it is spent
 *
 * That is the commercial core of the business. `pricing.ts` opens with the
 * observation that a competitor should have to guess at the rate card rather
 * than read it out of a response, and then the dashboard rendering that same
 * rate card shipped without a lock on it. A competitor could have read the
 * entire model in ten seconds, and so could a supplier during a rate
 * negotiation, which is worse.
 *
 * ## Why HTTP Basic and not a login screen
 *
 * There is exactly one operator and no user accounts anywhere in this product.
 * A login page would mean a users table, a password hash, a session, a reset
 * flow and a forgot password email, all to protect one dashboard. Basic auth is
 * a browser native prompt, it works from curl for scripting, and over HTTPS the
 * credentials are inside the TLS session like any other header.
 *
 * ## Fail closed
 *
 * If `OPS_PASSWORD` is unset the routes return 404 rather than opening. An
 * unset secret is far more likely to be a misconfigured deploy than a
 * deliberate decision to publish your margins, and a 404 also declines to
 * confirm the route exists at all.
 */

const PROTECTED = ["/ops", "/api/economics"];

/**
 * Routes that are the product, not the marketing site.
 *
 * Reachable on the apex today purely because one deployment serves both names.
 * Serving them there would mean the same page on two hostnames, which splits
 * search signals and, worse, means a customer can end up with a session on the
 * apex and a different one on the app host and never understand why their
 * balance moved.
 */
const PRODUCT = ["/plans", "/esims", "/checkout"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = roleForHost(req.headers.get("host"));

  /*
   * The apex is the marketing face; the product lives on `app.`. Both want to
   * own "/", so the marketing root is rewritten to the landing page rather than
   * redirected. A rewrite keeps the URL as the bare apex, which is what the
   * canonical tag, the Play listing and every link anyone shares should all
   * agree on.
   *
   * Deliberately only the root. Everything else on the apex, including
   * /app-ads.txt and the legal pages, is served untouched, because the
   * app-ads.txt crawl must resolve at the root with no redirect or AdMob drops
   * into limited serving and never explains why.
   */
  if (role === "marketing" && pathname === "/") {
    return NextResponse.rewrite(new URL("/home", req.url));
  }

  // The landing page has one address. Reaching it directly, or on the product
  // host, sends you to the canonical one instead of serving a duplicate.
  if (role === "marketing" && PRODUCT.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const to = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${HOSTS.app}`);
    return NextResponse.redirect(to, 308);
  }

  if (pathname === "/home") {
    return role === "marketing"
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.redirect(new URL("https://" + req.headers.get("host")?.replace(/^app\./, "") + "/"));
  }

  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const expected = process.env.OPS_PASSWORD;
  const user = process.env.OPS_USER ?? "ops";

  // Not configured. Behave as though the route does not exist.
  if (!expected) {
    return new NextResponse("Not found", { status: 404 });
  }

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    // atob rather than Buffer: middleware runs on the edge runtime, which has
    // no Node globals.
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      decoded = "";
    }

    // Split on the FIRST colon only. A password containing a colon is legal
    // and splitting naively would silently truncate it, producing an auth
    // failure that looks like a wrong password.
    const idx = decoded.indexOf(":");
    const suppliedUser = idx === -1 ? "" : decoded.slice(0, idx);
    const suppliedPass = idx === -1 ? "" : decoded.slice(idx + 1);

    if (suppliedUser === user && timingSafeEqual(suppliedPass, expected)) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Bilby ops", charset="UTF-8"',
      // Never let a proxy or the browser keep a copy of an operator page.
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Constant time string comparison.
 *
 * `===` on secrets returns as soon as two characters differ, so the time taken
 * leaks how much of the prefix was correct, and a patient attacker recovers the
 * password one character at a time. The edge runtime has no `crypto.timingSafeEqual`,
 * so this compares every character regardless of mismatches.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/*
 * Broad matcher, because the host rewrite has to see "/" as well as the
 * protected paths. Static assets and the well known text routes are excluded:
 * app-ads.txt and assetlinks.json are fetched by crawlers that are unforgiving
 * about redirects, and there is no reason for them to pass through here at all.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|app-ads.txt|.well-known|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|json)$).*)",
  ],
};
