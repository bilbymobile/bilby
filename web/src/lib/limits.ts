import { headers } from "next/headers";
import { one } from "./db";
import { warn } from "./observe";

/**
 * Rate limiting.
 *
 * Before this file there was none anywhere. Every public route would answer as
 * fast as the database could, forever, to anyone. That is survivable for a page
 * that reads a catalogue and unforgivable for a route that spends money, sends
 * email, or lets somebody guess at an identifier.
 *
 * ## Why the database and not an edge KV
 *
 * A limiter that does not share state across instances is not a limiter. This
 * runs serverless, so an in memory counter resets on every cold start and is
 * separate per concurrent instance, which means the real limit is your limit
 * times however many instances the platform happened to start. Postgres is
 * already on the request path for every route worth limiting, and one extra
 * round trip against the pooler is cheaper than the alternative being wrong.
 *
 * Redis would be faster. It would also be a second stateful dependency with its
 * own credentials, its own outage mode and its own bill, and the decision about
 * what happens when it is unreachable is exactly the decision below. Add it
 * when the round trip actually shows up in a latency graph.
 *
 * ## Sliding window, not fixed
 *
 * A fixed window lets somebody spend a full allowance at 11:59:59 and another
 * full allowance at 12:00:00, so the real limit is double the stated one at
 * every boundary. This weights the previous window by how much of it is still
 * in view, which costs one more row read and removes the boundary entirely.
 *
 * ## Fail open or fail closed
 *
 * Fail OPEN when the limiter itself errors, and record it. A database blip
 * would otherwise turn into a total outage of the shop, which is a far worse
 * failure than a few unmetered requests during the blip. The exception is
 * anything that spends money: those callers pass `failClosed` and get a refusal
 * instead, because an unmetered request there is a bill.
 */

export interface Limit {
  /** Requests allowed per window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
  /**
   * Refuse rather than allow when the limiter itself cannot answer.
   * Set this on anything that spends money or sends mail.
   */
  failClosed?: boolean;
}

export interface Decision {
  ok: boolean;
  /** Whole requests left in the current window, floored at zero. */
  remaining: number;
  /** Seconds until the caller should try again. Only meaningful when !ok. */
  retryAfter: number;
  limit: Limit;
}

/**
 * The named limits, in one place.
 *
 * Written here rather than at each call site so the whole policy can be read at
 * once, and so that raising one during an incident is a single edit rather than
 * a search.
 */
export const LIMITS = {
  /** Creating a Stripe session. Costs nothing yet, but it writes an order. */
  checkout: { max: 10, windowSec: 600, failClosed: true },

  /** Anything that asks a supplier to provision. This is the money one. */
  fulfil: { max: 30, windowSec: 3600, failClosed: true },

  /** Staff sign in links. Each one is an email we pay to send. */
  staffLogin: { max: 5, windowSec: 900, failClosed: true },

  /** Reading your own account. Cheap, but not free. */
  read: { max: 120, windowSec: 60 },

  /** The catalogue. Cached in practice; this is the abuse ceiling. */
  catalog: { max: 240, windowSec: 60 },

  /**
   * Fetching activation material by ICCID.
   *
   * Scoped to the session already, so this is not the thing stopping
   * enumeration. It is the thing stopping somebody trying twenty thousand
   * ICCIDs to find out which ones exist under a stolen cookie.
   */
  esimRead: { max: 60, windowSec: 60 },
} as const satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

/**
 * Count one request against a bucket.
 *
 * `subject` is whatever you are limiting: a user id, an IP, an email address.
 * Prefer a user id where you have one, because an IP is shared by everyone
 * behind a corporate NAT or a mobile carrier and a per IP limit on a signed in
 * route punishes the wrong people.
 */
export async function consume(
  name: LimitName,
  subject: string,
): Promise<Decision> {
  const limit: Limit = LIMITS[name];
  const bucket = `${name}:${subject}`;
  const w = limit.windowSec;
  const nowSec = Math.floor(Date.now() / 1000);
  const start = Math.floor(nowSec / w) * w;
  const elapsed = nowSec - start;

  try {
    /*
     * One statement, two facts. The CTE increments the current window and the
     * outer select reads the previous one alongside it, so the whole decision
     * costs a single round trip. Splitting them would open a gap in which two
     * concurrent requests each read a stale previous count.
     */
    const row = await one<{ current: number; previous: number }>(
      `WITH bumped AS (
         INSERT INTO rate_limits (bucket, window_start, hits)
              VALUES (?, to_timestamp(?), 1)
         ON CONFLICT (bucket, window_start)
           DO UPDATE SET hits = rate_limits.hits + 1
           RETURNING hits
       )
       SELECT (SELECT hits FROM bumped) AS current,
              COALESCE((SELECT hits FROM rate_limits
                         WHERE bucket = ? AND window_start = to_timestamp(?)), 0) AS previous`,
      [bucket, start, bucket, start - w],
    );

    const current = Number(row?.current ?? 1);
    const previous = Number(row?.previous ?? 0);

    // The previous window still counts, in proportion to how much of it is
    // inside the last `w` seconds.
    const weighted = previous * ((w - elapsed) / w) + current;

    if (weighted > limit.max) {
      return {
        ok: false,
        remaining: 0,
        // Long enough that a retry has a real chance of succeeding, rather
        // than an immediate second refusal that reads as a broken site.
        retryAfter: Math.max(1, w - elapsed),
        limit,
      };
    }

    void sweep();

    return {
      ok: true,
      remaining: Math.max(0, Math.floor(limit.max - weighted)),
      retryAfter: 0,
      limit,
    };
  } catch (e) {
    void warn("limits", e, { bucket, name });
    return limit.failClosed
      ? { ok: false, remaining: 0, retryAfter: 30, limit }
      : { ok: true, remaining: 0, retryAfter: 0, limit };
  }
}

/**
 * The identity a limit is counted against.
 *
 * Vercel and every CDN in front of it append to `x-forwarded-for`, so the
 * client's own address is the FIRST entry, not the last. Reading the last one
 * gives you the proxy's address, which is the same for everybody, which turns a
 * per client limit into a global one and locks out the entire site the first
 * time anybody misbehaves.
 *
 * A forwarded header is spoofable at the origin, and this trusts it, because on
 * a managed platform the header is rewritten at the edge before it reaches us.
 * If this ever runs somewhere that is not true, the fix is at the proxy, not
 * here.
 */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

/** Headers every limited response should carry, refused or not. */
export function limitHeaders(d: Decision): Record<string, string> {
  const out: Record<string, string> = {
    "RateLimit-Limit": String(d.limit.max),
    "RateLimit-Remaining": String(d.remaining),
  };
  if (!d.ok) out["Retry-After"] = String(d.retryAfter);
  return out;
}

/**
 * Delete windows nobody can still be inside.
 *
 * Sampled rather than scheduled, because there is no cron here and a table that
 * only grows is a bill that only grows. One in every fifty allowed requests
 * pays for the cleanup, which at any real traffic level keeps the table at
 * roughly the number of active buckets.
 */
async function sweep(): Promise<void> {
  if (Math.random() > 0.02) return;
  try {
    await one(
      `DELETE FROM rate_limits WHERE window_start < now() - interval '2 hours'`,
    );
  } catch {
    // Housekeeping. Never worth surfacing, never worth retrying.
  }
}
