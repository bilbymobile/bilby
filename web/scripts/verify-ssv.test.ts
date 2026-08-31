/**
 * Proves the AdMob SSV verifier actually verifies.
 *
 * The sandbox cannot reach Google's key server, and in any case you should not
 * depend on a third party being up to know whether your own crypto is correct.
 * So we stand up a P-256 key pair, stub the key server with it, sign a
 * realistic callback query string exactly the way Google does, and assert:
 *
 *   1. A correctly signed callback verifies.
 *   2. Tampering with ANY signed parameter breaks it.
 *   3. A stale timestamp is rejected even with a valid signature (replay).
 *   4. An unknown key_id is rejected rather than throwing.
 *
 * Test 2 is the one that matters most: it is what stops someone from taking a
 * real callback for a 5 MB reward and editing it into a 5,000 MB reward.
 *
 * Run: npx tsx scripts/verify-ssv.test.ts
 */
import crypto from "node:crypto";
import assert from "node:assert";
import { verifyAdMobCallback, __clearKeyCache } from "../src/lib/admob-ssv";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const KEY_ID = "1234567890";
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();

// Stub Google's key server.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string) => {
  if (String(url).includes("verifier-keys")) {
    return new Response(
      JSON.stringify({ keys: [{ keyId: Number(KEY_ID), pem, base64: "" }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  return realFetch(url as never);
}) as typeof fetch;

function signedCallback(overrides: Record<string, string> = {}, tamperAfter = false) {
  const params: Record<string, string> = {
    ad_network: "5450213213286189855",
    ad_unit: "1234567890",
    reward_amount: "1",
    reward_item: "data",
    timestamp: String(Date.now()),
    transaction_id: crypto.randomBytes(8).toString("hex"),
    user_id: "user-abc.signature",
    ...overrides,
  };

  // Google signs the raw query string in this exact order, terminating just
  // before "&signature=".
  const message = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const sig = crypto
    .sign("sha256", Buffer.from(message, "utf8"), { key: privateKey, dsaEncoding: "der" })
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Tamper AFTER signing — exactly what an attacker with a captured callback does.
  const shown = tamperAfter ? message.replace("reward_amount=1", "reward_amount=5000") : message;
  return `https://example.com/api/ads/ssv?${shown}&signature=${sig}&key_id=${KEY_ID}`;
}

async function main() {
  let pass = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    __clearKeyCache();
    await fn();
    console.log(`  ok  ${name}`);
    pass++;
  };

  await check("valid signature verifies", async () => {
    const r = await verifyAdMobCallback(signedCallback());
    assert.equal(r.valid, true, r.reason);
    assert.equal(r.rewardAmount, "1");
  });

  await check("post-signing tamper is rejected", async () => {
    const r = await verifyAdMobCallback(signedCallback({}, true));
    assert.equal(r.valid, false);
    assert.equal(r.reason, "signature mismatch");
  });

  await check("stale timestamp is rejected (replay guard)", async () => {
    const old = String(Date.now() - 3 * 60 * 60 * 1000);
    const r = await verifyAdMobCallback(signedCallback({ timestamp: old }));
    assert.equal(r.valid, false);
    assert.equal(r.reason, "callback too old");
  });

  await check("unknown key_id is rejected, not thrown", async () => {
    const url = signedCallback().replace(`key_id=${KEY_ID}`, "key_id=999");
    const r = await verifyAdMobCallback(url);
    assert.equal(r.valid, false);
    assert.match(r.reason ?? "", /unknown key_id/);
  });

  await check("missing signature is rejected", async () => {
    const r = await verifyAdMobCallback("https://example.com/api/ads/ssv?transaction_id=x");
    assert.equal(r.valid, false);
  });

  console.log(`\n${pass}/5 passed`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
