import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { one, run, nowIso } from "./db";
import { brand } from "./brand";

/**
 * Anonymous-first identity.
 *
 * Travel apps that demand an account before showing value lose most of their
 * installs at the signup screen. The whole free-tier hook is "install, tap,
 * get data" — so a user exists from their first request, identified by a signed
 * cookie, and email is collected later only when they have something worth
 * protecting (a purchased eSIM).
 *
 * The cookie is HMAC-signed rather than a bare UUID. A bare UUID cookie is
 * trivially forgeable, and since a user id maps directly to ad credits, forging
 * one is forging money.
 */

// Derived from the brand slug so a rename cannot leave a stale cookie name
// behind. The Flutter client matches on the `_uid=` suffix, not the prefix.
const COOKIE = `${brand.slug}_uid`;
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
 * Resolve (or create) the current user.
 *
 * Country is taken from the CDN's geo header where available. It drives the
 * ad-to-data exchange rate, so a user who spoofs it to a cheap-data region gets
 * a LARGER grant than they should — which is why `quoteGrant` is also bounded
 * by MAX_GRANT_MB and by the global daily budget. Never let a client-supplied
 * value be the only thing standing between a user and your wallet.
 */
export async function currentUser(): Promise<SessionUser> {
  const jar = await cookies();
  const h = await headers();

  const country =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-nesim-country") ??
    "AU";

  const raw = jar.get(COOKIE)?.value;
  const existing = raw ? unsign(raw) : null;

  if (existing) {
    const row = await one<SessionUser>(
      `SELECT id, country, home_country AS homeCountry, destination
       FROM users WHERE id = ?`,
      [existing]
    );
    if (row) {
      // Current country tracks the user. Home country never does. Destination
      // is the user's to set, so geo never touches it either — a traveller who
      // lands in Bangkok on the way to Hanoi should not silently start earning
      // against Thailand.
      if (row.country !== country) {
        await run("UPDATE users SET country = ? WHERE id = ?", [country, row.id]);
        return { ...row, country };
      }
      return row;
    }
  }

  const id = crypto.randomUUID();
  await run(
    "INSERT INTO users (id, created_at, country, home_country) VALUES (?, ?, ?, ?)",
    [id, nowIso(), country, country]
  );

  jar.set(COOKIE, sign(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });

  return { id, country, homeCountry: country, destination: null };
}

/**
 * Set where this user's data will be used.
 *
 * The caller MUST have validated `iso` against the destination allowlist first.
 * This value moves the ad-to-data exchange rate, so an unvalidated one is a
 * direct route to minting megabytes at the cheapest rate on the rate card.
 */
export async function setDestination(userId: string, iso: string): Promise<void> {
  await run("UPDATE users SET destination = ? WHERE id = ?", [iso.toUpperCase(), userId]);
}

/**
 * Look up a user id supplied by an ad network callback.
 *
 * The AdMob `user_id` arrives as the signed cookie value we handed to the SDK,
 * so it must be unsigned and verified here. Ad callbacks arrive out-of-band
 * with no cookie of their own.
 */
export async function userIdFromSignedValue(signed: string): Promise<string | null> {
  const id = unsign(signed);
  if (!id) return null;
  const row = await one("SELECT id FROM users WHERE id = ?", [id]);
  return row ? id : null;
}

export function signUserId(id: string): string {
  return sign(id);
}
