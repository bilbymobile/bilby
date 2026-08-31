import crypto from "node:crypto";

/**
 * AdMob rewarded-ad server-side verification (SSV).
 *
 * This is the single most important security boundary in the product, and the
 * one most commonly skipped. Without it your reward endpoint is:
 *
 *     POST /api/reward  -> "user watched an ad, give them 20 MB"
 *
 * ...which anybody can call in a loop with curl. The free tier becomes an open
 * faucet on your supplier wallet, and you will not notice until the invoice.
 * Client-side "I finished the ad" callbacks are advisory UI events. They are
 * not evidence and must never move the ledger.
 *
 * How SSV actually works:
 *  1. You enable SSV in the AdMob console and set a callback URL.
 *  2. On a genuinely completed view, Google's servers GET your callback with
 *     query params including ad_network, ad_unit, reward_amount, timestamp,
 *     transaction_id, user_id, signature, key_id.
 *  3. The signature is ECDSA-SHA256 over the raw query string UP TO but NOT
 *     INCLUDING "&signature=". Byte-exact. Re-serialising the params from a
 *     parsed object will silently produce a different string and every
 *     verification will fail.
 *  4. Public keys come from Google's key server, keyed by key_id, and rotate.
 *
 * Docs: https://developers.google.com/admob/android/ssv
 */

const KEY_SERVER = "https://gstatic.com/admob/reward/verifier-keys.json";

interface VerifierKey {
  keyId: number;
  pem: string;
  base64: string;
}

let keyCache: { fetchedAt: number; keys: Map<string, string> } | null = null;
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Raised when Google's key server is unreachable — a TRANSIENT infrastructure
 * fault, categorically different from "this callback is forged". The caller
 * must translate it into a retryable 5xx so AdMob re-delivers the reward,
 * rather than a 403 that would silently drop legitimate earnings on the floor
 * for the duration of an outage.
 */
export class VerifierKeysUnavailable extends Error {
  constructor(cause: string) {
    super(`AdMob verifier keys unavailable: ${cause}`);
    this.name = "VerifierKeysUnavailable";
  }
}

async function verifierKeys(): Promise<Map<string, string>> {
  if (keyCache && Date.now() - keyCache.fetchedAt < KEY_TTL_MS) {
    return keyCache.keys;
  }

  let res: Response;
  try {
    res = await fetch(KEY_SERVER, { cache: "no-store" });
  } catch (e) {
    throw new VerifierKeysUnavailable((e as Error).message);
  }
  if (!res.ok) throw new VerifierKeysUnavailable(`key server returned ${res.status}`);

  const json = (await res.json()) as { keys: VerifierKey[] };
  const keys = new Map<string, string>();
  for (const k of json.keys ?? []) {
    // Google ships both a PEM and a raw base64 SPKI depending on key vintage.
    keys.set(String(k.keyId), k.pem ?? toPem(k.base64));
  }
  keyCache = { fetchedAt: Date.now(), keys };
  return keys;
}

function toPem(b64: string): string {
  const body = (b64.match(/.{1,64}/g) ?? []).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`;
}

export interface SsvResult {
  valid: boolean;
  reason?: string;
  transactionId?: string;
  userId?: string;
  rewardAmount?: string;
  timestamp?: number;
}

/**
 * Verify an AdMob SSV callback.
 *
 * @param rawUrl The FULL request URL exactly as received, query string intact
 *               and un-normalised. Do not pass a reconstructed URL.
 */
export async function verifyAdMobCallback(rawUrl: string): Promise<SsvResult> {
  const qIndex = rawUrl.indexOf("?");
  if (qIndex === -1) return { valid: false, reason: "no query string" };
  const query = rawUrl.slice(qIndex + 1);

  // The signed message is everything before "&signature=". Locate it by string
  // search on the raw text — never by rebuilding from URLSearchParams, which
  // re-encodes and reorders.
  const sigMarker = query.indexOf("&signature=");
  if (sigMarker === -1) return { valid: false, reason: "missing signature param" };

  const signedMessage = query.slice(0, sigMarker);
  const params = new URLSearchParams(query);

  const signatureB64Url = params.get("signature");
  const keyId = params.get("key_id");
  if (!signatureB64Url || !keyId) return { valid: false, reason: "missing signature or key_id" };

  const keys = await verifierKeys();
  const pem = keys.get(keyId);
  if (!pem) return { valid: false, reason: `unknown key_id ${keyId}` };

  // AdMob uses web-safe base64 without padding.
  const signature = Buffer.from(
    signatureB64Url.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );

  let ok = false;
  try {
    ok = crypto.verify(
      "sha256",
      Buffer.from(signedMessage, "utf8"),
      { key: pem, dsaEncoding: "der" },
      signature
    );
  } catch (e) {
    return { valid: false, reason: `verify threw: ${(e as Error).message}` };
  }
  if (!ok) return { valid: false, reason: "signature mismatch" };

  // Replay window. A valid signature is valid forever; the timestamp is what
  // stops an attacker who captured one callback from replaying it nightly.
  // (The ledger's unique index on transaction_id is the second line of defence.)
  const tsRaw = params.get("timestamp");
  const ts = tsRaw ? Number(tsRaw) : NaN;
  if (!Number.isFinite(ts)) return { valid: false, reason: "bad timestamp" };

  const ageMs = Math.abs(Date.now() - ts);
  if (ageMs > 60 * 60 * 1000) return { valid: false, reason: "callback too old" };

  return {
    valid: true,
    transactionId: params.get("transaction_id") ?? undefined,
    userId: params.get("user_id") ?? undefined,
    rewardAmount: params.get("reward_amount") ?? undefined,
    timestamp: ts,
  };
}

/** Test seam. */
export function __clearKeyCache() {
  keyCache = null;
}
