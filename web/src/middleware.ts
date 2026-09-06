import { NextResponse, type NextRequest } from "next/server";

import { HOSTS, roleForHost, isRealHost } from "@/lib/hosts";
import { brand } from "@/lib/brand";

const UID_COOKIE = `${brand.slug}_uid`;
const UID_HEADER = "x-bilby-uid";

/**
 * Host routing.
 *
 * Five hostnames, one deployment. This decides which of them a request arrived
 * on and what that host is allowed to serve. It does not decide who anybody is:
 * middleware runs on the edge runtime where the Postgres driver cannot, so the
 * only auth question it can answer is "is there a cookie at all". The
 * authoritative check lives in the console layout, which is a server component
 * with a database connection.
 *
 * The operator dashboard that used to be protected here is gone. It published
 * wholesale cost per megabyte, contribution per ad view and supplier wallet
 * balances, all of which belonged to the free tier, and it was guarded with
 * HTTP Basic against an environment variable. Costing now lives inside the
 * staff console behind a real session, so there is no second auth scheme to
 * keep honest.
 */

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = roleForHost(req.headers.get("host"));

  /*
   * The staff console owns the whole of its host.
   *
   * The check here is cookie presence only, not validity: middleware runs on
   * the edge runtime where the Postgres driver cannot, so it cannot ask the
   * database whether a session is real. The authoritative check is in the
   * console layout, which is a server component with a database connection and
   * redirects to the sign in page when the session does not resolve.
   *
   * That split is fine and is the normal shape for this framework, but it is
   * worth being precise about what each half buys: this one turns away anyone
   * with no cookie at all, cheaply and before any rendering; the layout is what
   * actually decides who you are.
   */
  if (role === "admin") {
    const open = pathname.startsWith("/console/login") || pathname.startsWith("/console/auth");
    // Built from nextUrl rather than req.url so the browser's own host survives.
    // See the note in console/auth/route.ts: redirecting to the server's
    // internal URL lands people on an origin their cookie does not belong to,
    // and the symptom is a sign in loop.
    const here = (path: string, param?: [string, string]) => {
      const u = req.nextUrl.clone();
      u.pathname = path;
      u.search = "";
      if (param) u.searchParams.set(param[0], param[1]);
      return u;
    };

    if (pathname === "/") return NextResponse.rewrite(here("/console"));
    if (!pathname.startsWith("/console")) {
      // Nothing customer facing is ever served from this host.
      return NextResponse.redirect(here("/console"));
    }
    if (!open && !req.cookies.has("bilby_staff")) {
      return NextResponse.redirect(here("/console/login", ["next", pathname]));
    }
    return NextResponse.next();
  }

  // The console exists on one host only. Reaching it anywhere else is either a
  // mistake or somebody probing, and both get the same answer.
  if (pathname.startsWith("/console")) {
    return new NextResponse("Not found", { status: 404 });
  }

  /*
   * The apex is the marketing face; the product lives on `app.`. Both want to
   * own "/", so the marketing root is rewritten to the landing page rather than
   * redirected. A rewrite keeps the URL as the bare apex, which is what the
   * canonical tag, the Play listing and every link anyone shares should all
   * agree on.
   *
   * Deliberately only the root. Everything else on the apex, including the
   * legal pages, is served untouched.
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

  /*
   * The landing page has one address, except on a preview.
   *
   * On the real hosts /home is a duplicate of the apex root and redirects, so
   * search engines and shared links agree on one URL. On a preview deployment
   * or localhost it renders, because a preview is not a duplicate of anything
   * and Vercel marks it noindex regardless.
   *
   * Without this a preview URL could not show the landing page at all: it is
   * not the marketing host, so /home redirected to / on the same host, which
   * serves the product. The one surface that most needs reviewing before it
   * ships was the one surface a preview could not show.
   */
  if (pathname === "/home" && isRealHost(req.headers.get("host"))) {
    return role === "marketing"
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.redirect(new URL("https://" + req.headers.get("host")?.replace(/^app\./, "") + "/"));
  }

  return withIdentity(req);
}

/**
 * Mint the anonymous session, here and nowhere else.
 *
 * ## Why this moved
 *
 * The session used to be created by the first thing that needed it, which was
 * fine while that was always a route handler. The moment a server component
 * asked for a user, every product page returned a 500: the framework will not
 * let a component set a cookie, because rendering can be replayed, streamed and
 * cached, so there is no well defined moment for a Set-Cookie to happen at.
 *
 * A build that compiled and typechecked cleanly served a 500 on every page a
 * customer could reach. It was found by starting the thing and asking for a
 * page, which is the only way it was ever going to be found.
 *
 * ## The forward header
 *
 * A cookie set on this response does not come back until the NEXT request, so
 * the render immediately following would still see no identity and create a
 * second one. The id is therefore also forwarded on a request header for this
 * one render. It is signed either way, so the header is not a trust boundary:
 * the render verifies the signature exactly as it would from a cookie.
 *
 * ## Web Crypto
 *
 * Middleware runs on the edge runtime, which has no node:crypto. The HMAC below
 * is the same construction as the one in session.ts, expressed against
 * SubtleCrypto so both sides agree on the bytes.
 */
async function withIdentity(req: NextRequest): Promise<NextResponse> {
  const existing = req.cookies.get(UID_COOKIE)?.value;
  if (existing) return NextResponse.next();

  const id = crypto.randomUUID();
  const value = `${id}.${await hmac(id)}`;

  const headers = new Headers(req.headers);
  headers.set(UID_HEADER, value);

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(UID_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return res;
}

async function hmac(id: string): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  // base64url, to match the node side byte for byte. A trailing "=" or a "+"
  // here would produce a signature that never verifies and a sign in loop
  // nobody could explain.
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/*
 * Broad matcher, because the host rewrite has to see "/". Static assets and the
 * well known text routes are excluded: assetlinks.json is fetched by a crawler
 * that is unforgiving about redirects, and there is no reason for it to pass
 * through here at all.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.well-known|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|json)$).*)",
  ],
};
