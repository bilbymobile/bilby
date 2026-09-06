import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { one, run, nowIso } from "./db";
import { brand } from "./brand";

/**
 * Anonymous-first identity.
 *
 * Travel apps that demand an account before showing value lose most of their
 * installs at the signup screen. Someone browsing plans has not decided to buy
 * anything yet, so a user exists from their first request, identified by a
 * signed cookie, and email is collected at checkout when there is finally
 * something worth protecting.
 *
 * The cookie is HMAC signed rather than a bare UUID. A bare UUID cookie is
 * trivially forgeable, and a user id is what scopes an activation code, which
 * is a bearer credential: whoever holds it can install the profile.
 */

// Derived from the brand slug so a rename cannot leave a stale cookie name
// behind. The Flutter client matches on the `_uid=` suffix, not the prefix.
const COOKIE = `${brand.slug}_uid`;

/**
 * How middleware hands a freshly minted identity to the render that follows.
 *
 * Internal only. It is set on the request by our own middleware and is never
 * read from an inbound request: an attacker supplying this header directly
 * would still have to produce a valid signature, which is checked in unsign
 * below, so the worst they can do is present an identity they already hold.
 */
export const FORWARD_HEADER = "x-bilby-uid";
const SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function sign(id: string): string {
  const mac = crypto.createHmac("sha256", SECRET).update(id).digest("base64url");
  return `${id}.${mac}`;
}

function unsign(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const id = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(id).digest("base64url");
  // Constant-time compare — a fast-fail comparison here leaks the signature.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

export interface SessionUser {
  id: string;
  /** Where the handset physically is — drives what an ad actually fetches. */
  country: string;
  /** Signup location — drives expected ad value. Immutable. */
  homeCountry: string;
  /**
   * Where the data will be used. Null until the user picks one.
   *
   * Null is meaningful and must not be defaulted away at this layer: the app
   * uses it to decide whether to show the first-run picker at all. Callers that
   * need a country to price against should use `effectiveDestination()`.
   */
  destination: string | null;
}

/**
 * The country we price data cost against.
 *
 * Falls back to current location, which is what the old code did unconditionally
 * — correct once someone has landed, wrong in the week before they fly.
 */
export function effectiveDestination(u: SessionUser): string {
  return u.destination ?? u.country;
}

/**
 * Resolve the current user.
 *
 * ## Where the cookie is minted, and why not here
 *
 * This used to create the session cookie itself. That worked while the only
 * caller was a route handler, and broke the moment a server component called
 * it, because the framework will not let a component set a cookie: rendering
 * can be replayed, streamed and cached, so a Set-Cookie from inside it has no
 * well defined moment to happen at. The symptom was every product page
 * returning a 500 with a message about cookies, on a build that compiled
 * cleanly and typechecked cleanly.
 *
 * The identity is therefore minted in middleware, which runs once per request
 * and owns the response. By the time anything here runs, a signed cookie
 * exists. What is left for this function is the database side: make sure a row
 * exists for that id, and keep the current country fresh.
 *
 * `allowCreate` is the escape hatch for route handlers, which CAN set a cookie
 * and are reachable without one: the mobile client and anything talking to the
 * API directly do not pass through the browser flow that middleware sees.
 */
export async function currentUser(opts: { allowCreate?: boolean } = {}): Promise<SessionUser> {
  const jar = await cookies();
  const h = await headers();

  const country =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-nesim-country") ??
    "AU";

  // Middleware sets the cookie on the RESPONSE, which the browser will not send
  // back until the next request. So on the very first page view the cookie is
  // not in the jar yet, and middleware forwards the id it just minted on a
  // request header instead. Without this, the first page a visitor ever sees
  // creates one identity and their second request creates another.
  const raw = jar.get(COOKIE)?.value ?? h.get(FORWARD_HEADER) ?? null;
  const existing = raw ? unsign(raw) : null;

  if (existing) {
    const row = await one<SessionUser>(
      `SELECT id, country, home_country AS homeCountry, destination
       FROM users WHERE id = ?`,
      [existing],
    );

    if (row) {
      // Current country tracks the user. Home country never does. Destination
      // is the user's to set, so geo never touches it either: somebody who
      // lands in Bangkok on the way to Hanoi has not changed their mind about
      // where they are going.
      if (row.country !== country) {
        await run("UPDATE users SET country = ? WHERE id = ?", [country, row.id]);
        return { ...row, country };
      }
      return row;
    }

    /*
     * A validly signed id with no row behind it.
     *
     * Normal rather than suspicious: the cookie outlives any database this is
     * pointed at, and it survives a wipe of a development database. The
     * signature is what makes it safe to trust the id, so the row is created
     * with it rather than a new id being issued, which would silently orphan
     * anything already attached to it.
     */
    await run(
      "INSERT INTO users (id, created_at, country, home_country) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
      [existing, nowIso(), country, country],
    );
    return { id: existing, country, homeCountry: country, destination: null };
  }

  const id = crypto.randomUUID();
  await run(
    "INSERT INTO users (id, created_at, country, home_country) VALUES (?, ?, ?, ?)",
    [id, nowIso(), country, country],
  );

  if (opts.allowCreate) {
    jar.set(COOKIE, sign(id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  }

  return { id, country, homeCountry: country, destination: null };
}

/**
 * Set where this user's data will be used.
 *
 * The caller MUST have validated `iso` against the destination allowlist first.
 * It is written straight into the users table and read back into a catalogue
 * query, so an unvalidated one is stored junk at best.
 */
export async function setDestination(userId: string, iso: string): Promise<void> {
  await run("UPDATE users SET destination = ? WHERE id = ?", [iso.toUpperCase(), userId]);
}
