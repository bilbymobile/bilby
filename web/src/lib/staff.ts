import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

import { all, one, run } from "./db";
import { url } from "./hosts";

/**
 * Staff authentication for the console.
 *
 * ## No passwords, and why that is the safer choice here
 *
 * A password on a console that can issue refunds is a thing to phish, reuse and
 * leak. There is no password: you type your email, you get a single use link,
 * clicking it exchanges the link for a session. The mailbox becomes the
 * credential, which for a business already running on Google Workspace means
 * the second factor is somebody else's problem and is almost certainly better
 * than one we would build.
 *
 * The obvious weakness is that anyone who reads that mailbox can sign in, so
 * `OWNER_EMAIL` must be a mailbox only the owner controls, and it must have two
 * factor authentication on it. That is written in `.env.example` too.
 *
 * ## Nothing reversible is stored
 *
 * The sign in token and the session token are both stored as SHA-256 digests.
 * The browser holds the only copy of the real value. A dump of this database
 * hands an attacker nothing they can present as a session, which is the same
 * reasoning as never storing a password applied to the things that are as good
 * as one.
 *
 * ## Fail closed, everywhere
 *
 * Every function here returns null rather than throwing on an unknown session,
 * and every caller treats null as "not signed in". The middleware refuses the
 * whole host when there is no session at all, so a route that forgets to check
 * is protected by the layer above it rather than by the developer remembering.
 */

const SESSION_COOKIE = "bilby_staff";
const SESSION_DAYS = 0.5; // twelve hours
const LOGIN_MINUTES = 15;

export type Role = "owner" | "operations" | "finance" | "support" | "readonly";

export const ROLES: Role[] = ["owner", "operations", "finance", "support", "readonly"];

export interface Staff {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
  last_seen: string | null;
}

function sha(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

function token(): string {
  return randomBytes(32).toString("base64url");
}

function normaliseEmail(e: string): string {
  return e.trim().toLowerCase();
}

/* ── Bootstrapping ───────────────────────────────────────────────────────── */

/**
 * The first account.
 *
 * There is no sign up, on purpose: a console with a registration form is a
 * console anyone can join. The owner comes from `OWNER_EMAIL` and is created on
 * demand the first time that address asks for a link. Everyone else is invited
 * from inside.
 */
async function ensureOwner(email: string): Promise<Staff | undefined> {
  const owner = normaliseEmail(process.env.OWNER_EMAIL ?? "");
  if (!owner || owner !== email) return undefined;

  const existing = await one<Staff>(`SELECT * FROM staff WHERE email = ?`, [email]);
  if (existing) return existing;

  return one<Staff>(
    `INSERT INTO staff (id, email, role) VALUES (?, ?, 'owner') RETURNING *`,
    [randomBytes(9).toString("base64url"), email],
  );
}

/* ── Signing in ──────────────────────────────────────────────────────────── */

export interface LoginRequest {
  /** Always true from the caller's point of view. See the comment. */
  sent: true;
  /**
   * Present only when no mail provider is configured. The route logs it and the
   * console shows it in development, so the very first sign in is possible
   * before an email key exists.
   */
  devLink?: string;
}

/**
 * Ask for a sign in link.
 *
 * Always reports success, even for an address that is not staff. Telling a
 * stranger "that email is not registered" turns this form into a way to
 * enumerate who works here, and the information is worth nothing to a
 * legitimate user who already knows their own address.
 */
export async function requestLogin(emailInput: string, ip?: string): Promise<LoginRequest> {
  const email = normaliseEmail(emailInput);

  let person = await one<Staff>(`SELECT * FROM staff WHERE email = ? AND active`, [email]);
  if (!person) person = await ensureOwner(email);
  if (!person) return { sent: true };

  const raw = token();
  const expires = new Date(Date.now() + LOGIN_MINUTES * 60_000).toISOString();

  await run(
    `INSERT INTO staff_login_tokens (token_hash, email, expires_at, requested_ip)
     VALUES (?,?,?,?)`,
    [sha(raw), email, expires, ip ?? null],
  );

  const link = await loginLink(raw);
  const delivered = await sendLoginEmail(email, link);
  if (delivered) return { sent: true };

  /*
   * The bootstrap window, and why it closes.
   *
   * With no mail provider the link cannot be sent, so it is shown on screen
   * instead. That exists for one situation: the day the console first goes up
   * and the email provider is not signed up for yet. Without it there is no way
   * into your own console at all.
   *
   * The original version showed it whenever no key was set, and gated that on
   * the absence of the key rather than on NODE_ENV, with the reasoning that a
   * NODE_ENV check would lock you out of production on exactly the day you
   * needed in. That reasoning was right and the conclusion was wrong: it left a
   * public hostname where anybody who typed the owner address, which is not a
   * secret, was handed a working sign in link on the page.
   *
   * So it stays, and it closes by itself. The window is open only while nobody
   * has ever successfully signed in. The moment one session exists, bootstrap
   * is over and this returns nothing, whatever the mail configuration says.
   *
   * If you are ever locked out with no mail provider, deleting every row from
   * staff_sessions reopens it. That is a deliberate escape hatch and it needs
   * database access, which is the point.
   */
  const everSignedIn = await one<{ token_hash: string }>(
    `SELECT token_hash FROM staff_sessions LIMIT 1`,
  );
  if (everSignedIn) return { sent: true };

  console.warn(
    `[staff] bootstrap: no mail provider and nobody has signed in yet, so the ` +
      `sign in link for ${email} is being shown on screen. Set RESEND_API_KEY.`,
  );
  return { sent: true, devLink: link };
}

/**
 * Is the console still in its bootstrap window?
 *
 * True when no mail provider is configured AND nobody has ever signed in, which
 * is the only state in which a sign in link is shown on screen. Read by the
 * console to shout about it, because a door that is open for a good reason is
 * still a door that is open.
 */
export async function inBootstrapWindow(): Promise<boolean> {
  if (process.env.RESEND_API_KEY) return false;
  const ever = await one<{ token_hash: string }>(
    `SELECT token_hash FROM staff_sessions LIMIT 1`,
  );
  return !ever;
}

/**
 * Where the sign in link points.
 *
 * Built from the host the person actually used rather than from the configured
 * hostname, for two reasons. It works on a preview deployment and on a local
 * machine with a port, neither of which the configured name knows about. And it
 * cannot send somebody to production from a staging console by accident, which
 * is the kind of thing that only reveals itself once real data exists.
 *
 * The path is `/console/auth` and not `/auth`. Middleware redirects anything
 * outside `/console` on this host back to the console, and a redirect drops the
 * query string, so the shorter path would have quietly eaten every token.
 */
async function loginLink(raw: string): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".local") ? "http" : "https");
      return `${proto}://${host}/console/auth?t=${raw}`;
    }
  } catch {
    // No request context. Fall through to the configured hostname.
  }
  return url("admin", `/console/auth?t=${raw}`);
}

/**
 * Send the link, or report that we could not.
 *
 * Returns false rather than throwing when there is no mail provider yet, so the
 * caller can fall back to showing the link. That fallback is gated on the
 * absence of a key rather than on NODE_ENV: the situation it exists for is a
 * real production deployment on the day the console goes up and the email
 * provider is not signed up for yet, which is exactly where a NODE_ENV check
 * would leave you locked out of your own console.
 */
async function sendLoginEmail(to: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Deliberately silent. The link used to be printed here, which put a live
    // credential in the platform log on every request, including long after the
    // bootstrap window had closed and the link was no longer being shown to
    // anybody. The caller decides whether this link is safe to surface.
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "Bilby <hello@bilbymobile.com>",
      to,
      subject: "Your Bilby console sign in link",
      text:
        `Someone asked for a sign in link for the Bilby staff console.\n\n${link}\n\n` +
        `It works once and expires in ${LOGIN_MINUTES} minutes. ` +
        `If that was not you, nothing has happened and you can ignore this.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // An email provider refusing a send is invisible from the outside: the
    // person waiting for a sign in link simply never gets one, assumes they
    // mistyped, and tries again. Recorded so the console shows it.
    const { capture } = await import("./observe");
    void capture("mail.send", new Error(`Resend rejected the send: ${res.status}`), {
      status: res.status,
      body: body.slice(0, 500),
    });
    return false;
  }
  return true;
}

/**
 * Exchange a link for a session.
 *
 * The token is consumed with a conditional UPDATE rather than a read followed
 * by a write, so a link that is clicked twice, or raced by a mail scanner
 * prefetching it, can only ever produce one session.
 */
export async function consumeLogin(
  raw: string,
  meta: { ip?: string; ua?: string; secure?: boolean },
) {
  const claimed = await one<{ email: string }>(
    `UPDATE staff_login_tokens
        SET used_at = now()
      WHERE token_hash = ?
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING email`,
    [sha(raw)],
  );
  if (!claimed) return null;

  const person = await one<Staff>(`SELECT * FROM staff WHERE email = ? AND active`, [
    claimed.email,
  ]);
  if (!person) return null;

  const session = token();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await run(
    `INSERT INTO staff_sessions (token_hash, staff_id, expires_at, ip, user_agent)
     VALUES (?,?,?,?,?)`,
    [sha(session), person.id, expires.toISOString(), meta.ip ?? null, meta.ua ?? null],
  );
  await run(`UPDATE staff SET last_seen = now() WHERE id = ?`, [person.id]);

  return { person, cookie: sessionCookie(session, expires, meta.secure ?? true) };
}

/**
 * The cookie to set, returned rather than written.
 *
 * `cookies().set()` only reaches the browser when Next builds the response
 * itself. The sign in route returns its own response so it can control the
 * redirect target, and a cookie set through the request scoped helper is
 * silently dropped in that case: sign in appears to work, the redirect lands,
 * and the person arrives with no session. Handing the caller the cookie makes
 * that impossible to get wrong.
 */
export function sessionCookie(value: string, expires: Date, secure = true) {
  return {
    name: SESSION_COOKIE,
    value,
    options: {
      httpOnly: true,
      /*
       * Secure follows the actual protocol, not NODE_ENV.
       *
       * A browser silently discards a Secure cookie sent over plain http, so a
       * hard true makes a local instance impossible to sign into and the
       * failure looks like the session not being created. Keying it on
       * NODE_ENV would work too, but it lies: `next start` reports production
       * whether or not there is any TLS in front of it.
       *
       * The caller passes what the request came in on. Behind Vercel that is
       * the platform's own `x-forwarded-proto`, which is not something a client
       * can set.
       */
      secure,
      sameSite: "lax" as const,
      path: "/",
      expires,
    },
  };
}

export async function signOut() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) await run(`DELETE FROM staff_sessions WHERE token_hash = ?`, [sha(raw)]);
  jar.delete(SESSION_COOKIE);
}

/* ── Reading the session ─────────────────────────────────────────────────── */

/** The signed in staff member, or null. Never throws. */
export async function currentStaff(): Promise<Staff | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE)?.value;
    if (!raw) return null;

    const row = await one<Staff>(
      `SELECT s.* FROM staff s
         JOIN staff_sessions ss ON ss.staff_id = s.id
        WHERE ss.token_hash = ? AND ss.expires_at > now() AND s.active`,
      [sha(raw)],
    );
    return row ?? null;
  } catch (e) {
    // A database outage must not turn into an unhandled exception on every
    // console page. No session is the safe answer.
    // Silent to the caller by design: a session that will not resolve must look
    // exactly like no session, or the console leaks whether an account exists.
    // Recorded anyway, because "everybody is being signed out" is a real
    // failure mode and nobody would otherwise see it.
    const { warn } = await import("./observe");
    void warn("staff.session", e);
    return null;
  }
}

/** Capability check. The matrix lives here so it is one place, not thirty. */
const CAN: Record<string, Role[]> = {
  "dashboard.read": ["owner", "operations", "finance", "support", "readonly"],
  "orders.read": ["owner", "operations", "finance", "support", "readonly"],
  "orders.retry": ["owner", "operations"],
  "customers.read": ["owner", "operations", "finance", "support"],
  "credit.grant": ["owner", "operations", "support"],
  "refunds.issue": ["owner", "finance", "support"],
  "costing.read": ["owner", "operations", "finance"],
  "costing.edit": ["owner", "finance"],
  "discounts.manage": ["owner", "finance"],
  "suppliers.credentials": ["owner"],
  "audit.read": ["owner", "finance"],
  "staff.manage": ["owner"],
};

export function can(person: Staff | null, capability: keyof typeof CAN | string): boolean {
  if (!person) return false;
  const allowed = CAN[capability];
  return Array.isArray(allowed) && allowed.includes(person.role);
}

/* ── The audit log ───────────────────────────────────────────────────────── */

/**
 * Record a mutation. Called by every write path in the console.
 *
 * Deliberately swallows its own failure. An audit write that throws would roll
 * back the action it was describing, which trades a missing log line for a
 * refund that did not happen. The log line is important; it is not more
 * important than the work.
 */
export async function audit(
  actor: Staff | null,
  action: string,
  target?: string,
  before?: unknown,
  after?: unknown,
) {
  try {
    const h = await headers();
    await run(
      `INSERT INTO audit_log (actor_id, actor_email, actor_role, action, target, before, after, ip)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        actor?.id ?? null,
        actor?.email ?? "system",
        actor?.role ?? "system",
        action,
        target ?? null,
        before === undefined ? null : JSON.stringify(before),
        after === undefined ? null : JSON.stringify(after),
        h.get("x-forwarded-for") ?? null,
      ],
    );
  } catch (e) {
    const { capture } = await import("./observe");
    void capture("audit", e, { action, target: target ?? null });
  }
}

export function recentAudit(limit = 100) {
  return all<{
    id: string;
    actor_email: string;
    actor_role: string;
    action: string;
    target: string | null;
    created_at: string;
  }>(
    `SELECT id::text, actor_email, actor_role, action, target, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
}

/** Constant time compare, for anywhere a secret is checked by hand. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export { SESSION_COOKIE };
