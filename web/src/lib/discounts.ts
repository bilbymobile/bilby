import { all, one, run, tx, type Tx } from "./db";

/**
 * Discount codes.
 *
 * The whole point of this module is that creating a code is a form, not a
 * deploy. Everything a code can do is a column, so the admin console is a thin
 * layer over these functions and nothing here needs an engineer.
 *
 * ## The one hard part
 *
 * Claiming a code is a race. Two people submitting the last use of a single use
 * code will both read `redeemed_count = 0`, both conclude they are allowed, and
 * both redeem. Reading then writing cannot fix that no matter where you put the
 * check, and it is exactly the bug that shows up on the first campaign that
 * gets shared somewhere popular.
 *
 * So the claim is one conditional UPDATE with the limit in the WHERE clause.
 * Postgres serialises the row, and the loser's UPDATE matches nothing and
 * returns no row. See [claimCode].
 */

export type DiscountKind = "percent" | "fixed";

export interface DiscountCode {
  code: string;
  kind: DiscountKind;
  value: string;
  currency: string;
  max_redemptions: number | null;
  redeemed_count: number;
  per_user_limit: number;
  min_spend: string | null;
  destinations: string[] | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Human readable code generator.
 *
 * No O, 0, I, 1 or 5/S. A code gets read aloud down a phone, typed off a
 * screenshot, and copied from a printed card, and every one of those is where
 * an ambiguous glyph turns into a support ticket.
 */
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789";

export function generateCode(prefix = "", length = 8): string {
  let body = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  const p = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return p ? `${p}${body}` : body;
}

/** Codes are stored and compared uppercase, so nobody loses an order to caps lock. */
export function normalise(code: string): string {
  return code.trim().toUpperCase();
}

export interface NewCode {
  code?: string;
  kind: DiscountKind;
  value: number;
  currency?: string;
  maxRedemptions?: number | null;
  perUserLimit?: number;
  minSpend?: number | null;
  destinations?: string[] | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

export async function createCode(input: NewCode): Promise<DiscountCode> {
  const code = normalise(input.code || generateCode());

  if (input.kind === "percent" && (input.value <= 0 || input.value > 100)) {
    throw new Error("A percentage discount has to be between 1 and 100.");
  }
  if (input.value <= 0) {
    throw new Error("A discount has to be worth something.");
  }

  const row = await one<DiscountCode>(
    `INSERT INTO discount_codes
       (code, kind, value, currency, max_redemptions, per_user_limit,
        min_spend, destinations, starts_at, expires_at, note, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     RETURNING *`,
    [
      code,
      input.kind,
      input.value,
      input.currency ?? "AUD",
      input.maxRedemptions ?? null,
      input.perUserLimit ?? 1,
      input.minSpend ?? null,
      input.destinations ?? null,
      input.startsAt ?? null,
      input.expiresAt ?? null,
      input.note ?? null,
      input.createdBy ?? null,
    ],
  );

  if (!row) throw new Error("Could not create the code.");
  return row;
}

export function listCodes(): Promise<DiscountCode[]> {
  return all<DiscountCode>(
    `SELECT * FROM discount_codes ORDER BY created_at DESC LIMIT 500`,
  );
}

export async function setActive(code: string, active: boolean): Promise<boolean> {
  const n = await run(`UPDATE discount_codes SET active = ? WHERE code = ?`, [
    active,
    normalise(code),
  ]);
  return n > 0;
}

export type CheckResult =
  | { ok: true; code: DiscountCode; amountOff: number }
  | { ok: false; reason: string };

/**
 * Would this code apply, and for how much?
 *
 * Read only. Use it to show the customer what they will pay before they commit.
 * It deliberately does NOT reserve anything: a code that passes here can still
 * fail at [claimCode] if somebody else takes the last use in between, and the
 * checkout has to handle that rather than assume.
 *
 * Every rejection returns a sentence you can show a person. "Invalid code" is a
 * message that makes someone retype a code that was never going to work.
 */
export async function checkCode(
  codeInput: string,
  opts: { userId: string; subtotal: number; destination?: string },
): Promise<CheckResult> {
  const code = normalise(codeInput);
  const c = await one<DiscountCode>(`SELECT * FROM discount_codes WHERE code = ?`, [code]);

  if (!c) return { ok: false, reason: "We do not recognise that code." };
  if (!c.active) return { ok: false, reason: "That code is no longer available." };

  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) {
    return { ok: false, reason: "That code is not active yet." };
  }
  if (c.expires_at && new Date(c.expires_at).getTime() < now) {
    return { ok: false, reason: "That code has expired." };
  }
  if (c.max_redemptions !== null && c.redeemed_count >= c.max_redemptions) {
    return { ok: false, reason: "That code has been fully claimed." };
  }
  if (c.min_spend !== null && opts.subtotal < Number(c.min_spend)) {
    return {
      ok: false,
      reason: `That code needs a spend of at least ${Number(c.min_spend).toFixed(2)}.`,
    };
  }
  if (c.destinations && opts.destination && !c.destinations.includes(opts.destination)) {
    return { ok: false, reason: "That code does not apply to this destination." };
  }

  const used = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM discount_redemptions WHERE code = ? AND user_id = ?`,
    [code, opts.userId],
  );
  if (Number(used?.n ?? 0) >= c.per_user_limit) {
    return { ok: false, reason: "You have already used that code." };
  }

  return { ok: true, code: c, amountOff: amountOff(c, opts.subtotal) };
}

/** Never discount below zero, and never more than the order is worth. */
export function amountOff(c: DiscountCode, subtotal: number): number {
  const raw =
    c.kind === "percent" ? (subtotal * Number(c.value)) / 100 : Number(c.value);
  return Math.min(Math.max(raw, 0), subtotal);
}

/**
 * Take one use of a code, atomically, and record it.
 *
 * The UPDATE carries the limit in its WHERE clause, so two concurrent callers
 * cannot both succeed: Postgres serialises the row and the second one matches
 * nothing. Returns null when the code was taken in the meantime, and the caller
 * must treat that as "the discount did not apply" rather than as an error worth
 * failing the whole purchase over.
 */
export async function claimCode(
  codeInput: string,
  opts: { userId: string; orderId: string; amountOff: number },
): Promise<{ amountOff: number } | null> {
  const code = normalise(codeInput);

  return tx(async (t: Tx) => {
    const claimed = await t.one<{ code: string }>(
      `UPDATE discount_codes
          SET redeemed_count = redeemed_count + 1
        WHERE code = ?
          AND active
          AND (starts_at IS NULL OR starts_at <= now())
          AND (expires_at IS NULL OR expires_at > now())
          AND (max_redemptions IS NULL OR redeemed_count < max_redemptions)
        RETURNING code`,
      [code],
    );

    if (!claimed) return null;

    await t.run(
      `INSERT INTO discount_redemptions (code, user_id, order_id, amount_off)
       VALUES (?,?,?,?)
       ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING`,
      [code, opts.userId, opts.orderId, opts.amountOff],
    );

    return { amountOff: opts.amountOff };
  });
}

/** Everything claimed against a code, for the console. */
export function redemptions(code: string) {
  return all<{ user_id: string; order_id: string | null; amount_off: string; created_at: string }>(
    `SELECT user_id, order_id, amount_off, created_at
       FROM discount_redemptions WHERE code = ? ORDER BY created_at DESC LIMIT 200`,
    [normalise(code)],
  );
}
