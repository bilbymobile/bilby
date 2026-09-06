import crypto from "node:crypto";
import { one, all, run } from "./db";

/**
 * Error tracking.
 *
 * Before this file the codebase had none. Not a thin version, not a console
 * only version: nothing. A fulfilment that failed after a customer had paid
 * left a row with status 'failed' in a table nobody was watching, and the way
 * you found out was the customer telling you. For a business whose entire
 * promise is "it works when you land", that is the wrong direction for
 * information to travel.
 *
 * Two sinks, and the order matters.
 *
 *  1. The database, always. This is the one that has to work with no accounts
 *     anywhere, no keys set, and no third party reachable. The staff console
 *     reads it. If Sentry were the only sink and the DSN were unset in
 *     production by mistake, you would be back to no error tracking and you
 *     would not find out, because the thing that would have told you is the
 *     thing that is off.
 *
 *  2. Sentry, if a DSN is set. Best effort, hard timeout, and never able to
 *     throw into the request.
 *
 * ## Why events are grouped rather than appended
 *
 * A row per occurrence sounds better until a supplier goes down and writes four
 * thousand identical rows in an hour, at which point the table is both a cost
 * and unreadable. Events are folded on a fingerprint: same scope, same message
 * shape, one row, a count and a last seen time. What you lose is the ability to
 * see occurrence 1,203 individually. What you gain is a console page that tells
 * you at a glance that one thing is broken rather than that four thousand
 * things are.
 *
 * ## What must never appear in here
 *
 * Card numbers, API keys, activation codes, full email addresses. An error
 * store is the least guarded thing in the system: it is read casually, it is
 * copied into chat messages, and it outlives the incident. redact() below is
 * applied to every detail object on the way in and it is not optional.
 */

export type Level = "error" | "warning";

export interface Captured {
  fingerprint: string;
  count: number;
}

/**
 * Record a failure.
 *
 * Never throws. A capture that fails must not turn a handled error into an
 * unhandled one, and must not be the reason a customer's request returns a 500.
 * If the database is the thing that is broken, this returns null and the
 * platform log is all you get, which is correct: at that point there is nowhere
 * else to write.
 */
export async function capture(
  scope: string,
  err: unknown,
  detail: Record<string, unknown> = {},
  level: Level = "error",
): Promise<Captured | null> {
  const message = messageOf(err);
  const fingerprint = fingerprintOf(scope, message);
  const safe = redact(detail);

  // Always. Even when the database write below fails, this line exists in the
  // platform log and is the last resort.
  console.error(`[${scope}] ${message}`, safe);

  void toSentry(scope, level, message, err, safe);

  try {
    const row = await one<{ count: number }>(
      `INSERT INTO error_events (fingerprint, level, scope, message, detail, stack)
            VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (fingerprint) DO UPDATE
              SET count   = error_events.count + 1,
                  last_at = now(),
                  level   = EXCLUDED.level,
                  detail  = EXCLUDED.detail,
                  message = EXCLUDED.message
         RETURNING count`,
      [fingerprint, level, scope, message, JSON.stringify(safe), stackOf(err)],
    );
    return { fingerprint, count: row?.count ?? 1 };
  } catch (e) {
    console.error("[observe] could not record the error above:", e);
    return null;
  }
}

/**
 * Same as capture, at warning level. Something recovered, but you should know.
 *
 * Note what this does NOT do: reopen a resolved group. A supplier that fails
 * once a fortnight would otherwise be permanently unresolvable, and an operator
 * who cannot clear a list stops reading the list. Recurrences bump the count
 * and the last seen time; reopening is a decision a person makes.
 */
export function warn(
  scope: string,
  err: unknown,
  detail: Record<string, unknown> = {},
): Promise<Captured | null> {
  return capture(scope, err, detail, "warning");
}

/* ------------------------------------------------------------------------ *
 * Reading, for the console
 * ------------------------------------------------------------------------ */

export interface ErrorGroup {
  fingerprint: string;
  level: Level;
  scope: string;
  message: string;
  count: number;
  firstAt: string;
  lastAt: string;
  resolvedAt: string | null;
  detail: Record<string, unknown>;
  stack: string | null;
}

export async function recentErrors(
  opts: { includeResolved?: boolean; limit?: number } = {},
): Promise<ErrorGroup[]> {
  const { includeResolved = false, limit = 100 } = opts;
  const rows = await all<{
    fingerprint: string;
    level: Level;
    scope: string;
    message: string;
    count: number;
    first_at: Date;
    last_at: Date;
    resolved_at: Date | null;
    detail: Record<string, unknown> | null;
    stack: string | null;
  }>(
    `SELECT * FROM error_events
      WHERE (? OR resolved_at IS NULL)
      ORDER BY last_at DESC
      LIMIT ?`,
    [includeResolved, limit],
  );
  return rows.map((r) => ({
    fingerprint: r.fingerprint,
    level: r.level,
    scope: r.scope,
    message: r.message,
    count: r.count,
    firstAt: iso(r.first_at),
    lastAt: iso(r.last_at),
    resolvedAt: r.resolved_at ? iso(r.resolved_at) : null,
    detail: r.detail ?? {},
    stack: r.stack,
  }));
}

export async function resolveError(fingerprint: string): Promise<boolean> {
  const n = await run(
    `UPDATE error_events SET resolved_at = now()
      WHERE fingerprint = ? AND resolved_at IS NULL`,
    [fingerprint],
  );
  return n > 0;
}

/** Unresolved groups, for the badge on the console nav. */
export async function openErrorCount(): Promise<number> {
  const r = await one<{ n: string }>(
    `SELECT COUNT(*) AS n FROM error_events WHERE resolved_at IS NULL`,
  );
  return Number(r?.n ?? 0);
}

/* ------------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------------ */

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err.slice(0, 500);
  try {
    return JSON.stringify(err).slice(0, 500);
  } catch {
    return String(err).slice(0, 500);
  }
}

function stackOf(err: unknown): string | null {
  return err instanceof Error && err.stack ? err.stack.slice(0, 8000) : null;
}

/**
 * What makes two failures "the same failure".
 *
 * Scope plus the message with everything that varies per occurrence stripped
 * out. Without the stripping, a message like "order ord_8f21 failed"
 * fingerprints differently every time and the grouping does nothing at all,
 * which is the usual way a table like this quietly becomes an append only log.
 */
function fingerprintOf(scope: string, message: string): string {
  const shape = message
    // A UUID anywhere.
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    // Prefixed opaque identifiers: ord_8f21, cs_test_a1b2, pi_3Nx. The tail is
    // required to contain a digit, which is what keeps a real word like
    // tax_code or user_id from being collapsed into the same shape as a
    // different real word.
    //
    // The replacement is the SAME token the numeric rule below emits, and that
    // is not cosmetic. If this rule wrote <id> and the rule below wrote <n>,
    // then ord_8f21 and ord_24 would fingerprint differently, because only one
    // of them has a tail this rule matches. Two shapes for one kind of thing is
    // the whole failure mode this function exists to avoid.
    .replace(/\b([A-Za-z]{2,12})_(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{2,}\b/g, "$1_<n>")
    // An ICCID is nineteen or twenty digits and is not a quantity.
    .replace(/\d{15,22}/g, "<iccid>")
    // Everything else numeric. Deliberately NOT anchored on a word boundary:
    // an underscore is a word character, so \b\d+\b never matches the digits
    // in ord_24, and the grouping this whole function exists for silently does
    // nothing. That bug is the reason the boundaries are gone.
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return crypto.createHash("sha256").update(`${scope} ${shape}`).digest("hex").slice(0, 32);
}

/**
 * Keys whose values never reach the store.
 *
 * Matched anywhere in the key name, case insensitively. Broad on purpose: a
 * false positive costs you one redacted debugging field, a false negative puts
 * a live credential in a table people paste into chat.
 */
const SECRET_KEYS =
  /(pass|secret|token|key|auth|cookie|card|cvc|pan|iban|activation|lpa|matching|smdp|signature)/i;

export function redact(v: unknown): Record<string, unknown> {
  const out = walk(v, 0);
  return out && typeof out === "object" && !Array.isArray(out)
    ? (out as Record<string, unknown>)
    : { value: out };
}

function walk(v: unknown, depth: number): unknown {
  if (depth > 4) return "<deep>";
  if (v === null || v === undefined) return v ?? null;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => walk(x, depth + 1));
  if (v instanceof Error) return messageOf(v);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "<redacted>" : walk(val, depth + 1);
    }
    return out;
  }
  if (typeof v === "string") {
    // An email address in an error detail is the single most common way
    // personal data ends up somewhere it was never meant to be.
    const masked = v.replace(
      /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)\b/g,
      (_m, first, host) => `${first}***@${host}`,
    );
    return masked.length > 1000 ? masked.slice(0, 1000) : masked;
  }
  return v;
}

/* ---- Sentry, by hand ---------------------------------------------------- *
 *
 * Deliberately not the Sentry SDK. That package wraps the build, patches the
 * runtime, uploads source maps and pulls in a tree of dependencies, all to
 * deliver what is, at this volume, one HTTPS POST. The envelope format below is
 * public and stable, and the worst case if it is wrong is that a secondary sink
 * goes quiet while the primary one keeps working.
 *
 * If this ever needs breadcrumbs, performance traces or release health, throw
 * it away and install the real SDK. Do not grow it.
 */

interface Dsn {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
}

let parsed: Dsn | null | undefined;

function dsn(): Dsn | null {
  if (parsed !== undefined) return parsed;
  const raw = process.env.SENTRY_DSN;
  if (!raw) return (parsed = null);
  try {
    const u = new URL(raw);
    parsed = {
      protocol: u.protocol.replace(":", ""),
      publicKey: u.username,
      host: u.host,
      projectId: u.pathname.replace(/^\//, ""),
    };
  } catch {
    console.error("[observe] SENTRY_DSN is not a valid URL, so Sentry is off");
    parsed = null;
  }
  return parsed;
}

async function toSentry(
  scope: string,
  level: Level,
  message: string,
  err: unknown,
  detail: Record<string, unknown>,
): Promise<void> {
  const d = dsn();
  if (!d) return;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    sent_at: new Date().toISOString(),
  });
  const itemHeader = JSON.stringify({ type: "event" });
  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level,
    logger: scope,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    message: { formatted: message },
    // The same grouping decision as the table, stated explicitly rather than
    // left to Sentry's own heuristics, so the two agree about what one problem
    // is.
    fingerprint: [fingerprintOf(scope, message)],
    tags: { scope },
    extra: detail,
    exception:
      err instanceof Error
        ? { values: [{ type: err.name, value: err.message }] }
        : undefined,
  });

  try {
    await fetch(`${d.protocol}://${d.host}/api/${d.projectId}/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${d.publicKey}, sentry_client=bilby/1`,
      },
      body: [envelopeHeader, itemHeader, payload].join("\n") + "\n",
      // A monitoring sink must never be able to hold a request open.
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Swallowed on purpose. The database sink already has this event, and a
    // failure to reach a monitoring service is not itself worth an error.
  }
}
