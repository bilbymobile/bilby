/**
 * The eSIM Access adapter, against a stubbed transport.
 *
 * Run with:
 *   npx tsx scripts/esimaccess.test.ts
 *
 * ## Why this is not an integration test
 *
 * There is no sandbox. Their own words: "There is no Sandbox environment.
 * Cancel eSIM orders as needed in our live environment. Request funds for
 * testing." So the only way to exercise this against the real thing is to spend
 * money on a real profile and cancel it, which is worth doing once by hand and
 * is not worth doing on every commit.
 *
 * What can be checked without them is everything that was actually wrong: the
 * signature construction, the envelope handling, the units, and the polling
 * behaviour while a profile is being built. Every fixture below is copied from
 * their published collection rather than invented, so the shapes are theirs.
 *
 * ## The signature check is the important one
 *
 * Their documentation publishes a worked example with a known key, body and
 * expected signature. That makes the construction verifiable offline and
 * exactly, which matters because the adapter previously used a plain SHA-256 of
 * the same string with the secret concatenated on the end. That is a different
 * construction, it is not an HMAC, and it would have returned 101003 "Request
 * signature mismatch" on the first live call and every one after it.
 */

import crypto from "node:crypto";

import { InsufficientSupplierBalance } from "../src/lib/suppliers/types";
import { EsimAccessSupplier } from "../src/lib/suppliers/esimaccess";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, detail ?? "");
  }
}

/* ---- The transport stub -------------------------------------------------- */

interface Call {
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  rawBody: string;
}

const calls: Call[] = [];
let queue: Array<unknown> = [];

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const rawBody = String(init?.body ?? "{}");
  calls.push({
    path: String(url).replace(/^.*\/open/, ""),
    body: JSON.parse(rawBody),
    headers: (init?.headers ?? {}) as Record<string, string>,
    rawBody,
  });
  const next = queue.shift() ?? { success: true, errorCode: "0", errorMsg: null, obj: {} };
  return {
    ok: true,
    status: 200,
    json: async () => next,
    text: async () => JSON.stringify(next),
  } as Response;
}) as typeof fetch;

process.env.ESIMACCESS_ACCESS_CODE = "test-access-code";
process.env.ESIMACCESS_SECRET_KEY = "test-secret";

const supplier = new EsimAccessSupplier();

function reset(...responses: unknown[]) {
  calls.length = 0;
  queue = responses;
}

const ok = (obj: unknown) => ({ success: true, errorCode: "0", errorMsg: null, obj });
const fail = (errorCode: string, errorMessage: string) => ({
  success: false,
  errorCode,
  errorMessage,
  obj: null,
});

async function main() {
  /* ---- 1. The signature, against their own worked example ------------------ */

  console.log("\nthe signature\n");

  {
    /*
     * Verbatim from their "Signature Example":
     *
     *   Timestamp=1628670421
     *   RequestID=4ce9d9cdac9e4e17b3a2c66c358c1ce2
     *   AccessCode=11111
     *   SecretKey=1111
     *   RequestBody={"imsi":"326543826"}
     *   Signature=7EB765E27DF5373DEA2DBC8C41A7D9557743E46C8054750F3D851B3FD01D0835
     */
    const ts = "1628670421";
    const id = "4ce9d9cdac9e4e17b3a2c66c358c1ce2";
    const ac = "11111";
    const secret = "1111";
    const body = '{"imsi":"326543826"}';
    const signStr = ts + id + ac + body;

    check(
      "signStr is timestamp + requestId + accessCode + body, no separators",
      signStr === '16286704214ce9d9cdac9e4e17b3a2c66c358c1ce211111{"imsi":"326543826"}',
    );

    const hmac = crypto.createHmac("sha256", secret).update(signStr).digest("hex");
    check(
      "HMAC-SHA256 reproduces their published signature exactly",
      hmac.toUpperCase() === "7EB765E27DF5373DEA2DBC8C41A7D9557743E46C8054750F3D851B3FD01D0835",
      hmac.toUpperCase(),
    );

    // The construction that was here before. Named so nobody reintroduces it.
    const plain = crypto.createHash("sha256").update(signStr + secret).digest("hex");
    check(
      "a plain SHA-256 with the secret appended does NOT, which is what was shipped",
      plain.toUpperCase() !== "7EB765E27DF5373DEA2DBC8C41A7D9557743E46C8054750F3D851B3FD01D0835",
    );
  }

  /* ---- 2. What the adapter actually puts on the wire ----------------------- */

  console.log("\nthe request\n");

  reset(ok({ balance: 940000 }));
  const balance = await supplier.balanceUsd();

  {
    const c = calls[0];
    check("balance is integer units over 10,000", balance === 94, balance);
    check("the access code goes in RT-AccessCode", c.headers["RT-AccessCode"] === "test-access-code");
    check("a signature is sent when a secret exists", !!c.headers["RT-Signature"]);
    check(
      "the request id is a v4 uuid with the dashes stripped, as in their example",
      /^[0-9a-f]{32}$/.test(c.headers["RT-RequestID"] ?? ""),
      c.headers["RT-RequestID"],
    );
    check(
      "the timestamp is seconds, matching their worked example rather than their header table",
      /^\d{10}$/.test(c.headers["RT-Timestamp"] ?? ""),
      c.headers["RT-Timestamp"],
    );

    // The whole point of signing the string that is sent: recomputing from the
    // headers and the exact body must reproduce the header.
    const expected = crypto
      .createHmac("sha256", "test-secret")
      .update(c.headers["RT-Timestamp"] + c.headers["RT-RequestID"] + "test-access-code" + c.rawBody)
      .digest("hex");
    check(
      "the signature is over the exact bytes of the body that was sent",
      c.headers["RT-Signature"] === expected,
    );
    check("the signature is lowercase hex", c.headers["RT-Signature"] === c.headers["RT-Signature"]?.toLowerCase());
  }

  /* ---- 3. The envelope ----------------------------------------------------- */

  console.log("\nthe envelope\n");

  // Their success examples use errorCode "0"; others use null. Both are success.
  reset({ success: true, errorCode: null, errorMsg: null, obj: { balance: 10000 } });
  check("errorCode null counts as success", (await supplier.balanceUsd()) === 1);

  reset(fail("200007", "Insufficient account balance"));
  let thrown: unknown = null;
  try {
    await supplier.balanceUsd();
  } catch (e) {
    thrown = e;
  }
  check(
    "200007 becomes InsufficientSupplierBalance rather than a generic error",
    thrown instanceof InsufficientSupplierBalance,
    thrown instanceof Error ? thrown.message : thrown,
  );

  reset(fail("310241", "The packageCode does not exist."));
  thrown = null;
  try {
    await supplier.balanceUsd();
  } catch (e) {
    thrown = e;
  }
  check(
    "a failure spelled errorMessage still reaches the message, not undefined",
    thrown instanceof Error && thrown.message.includes("The packageCode does not exist"),
    thrown instanceof Error ? thrown.message : thrown,
  );

  reset(fail("101003", "Request signature mismatch."));
  thrown = null;
  try {
    await supplier.balanceUsd();
  } catch (e) {
    thrown = e;
  }
  check(
    "a signature failure says so, and says where to look",
    thrown instanceof Error && /ESIMACCESS_SECRET_KEY/.test(thrown.message),
  );

  /* ---- 4. The catalogue ---------------------------------------------------- */

  console.log("\nthe catalogue\n");

  // Shape copied from their saved example response.
  reset(
    ok({
      packageList: [
        {
          packageCode: "CKH139",
          slug: "SI_5_30",
          name: "Slovenia 5GB 30Days",
          price: 112500,
          currencyCode: "USD",
          volume: 5368709120,
          duration: 30,
          durationUnit: "DAY",
          location: "SI",
          supportTopUpType: 2,
          locationNetworkList: [{ locationName: "Slovenia" }],
        },
        { packageCode: "X2", name: "Asia 11", price: 10000, volume: 1073741824, duration: 7, location: "CN,HK,ID,JP", supportTopUpType: 1 },
      ],
    }),
  );
  const plans = await supplier.listPlans({ country: "SI" });

  check("bytes become megabytes", plans[0].dataMb === 5120, plans[0].dataMb);
  check("price is divided by 10,000", plans[0].wholesaleUsd === 11.25, plans[0].wholesaleUsd);
  check(
    "countries come from location, as ISO codes",
    plans[0].countries.join(",") === "SI" && plans[1].countries.join(",") === "CN,HK,ID,JP",
    plans.map((p) => p.countries.join("|")),
  );
  check(
    "supportTopUpType 1 means no, which a truthy check got wrong",
    plans[0].topUpSupported === true && plans[1].topUpSupported === false,
  );

  /* ---- 5. Ordering, which is asynchronous ---------------------------------- */

  console.log("\nordering\n");

  const AC = "LPA:1$rsp-eu.simlessly.com$MATCHING123";

  reset(
    // price lookup
    ok({ packageList: [{ packageCode: "JC066", name: "Japan 1GB", price: 7000, volume: 1073741824, duration: 7, location: "JP", supportTopUpType: 2 }] }),
    // the order
    ok({ orderNo: "B2508091406000X", transactionId: "ref-1" }),
    // still building, twice: the exact response that used to abort the order
    fail("200010", "Profile is being downloaded for the order."),
    fail("200010", "Profile is being downloaded for the order."),
    // ready
    ok({
      esimList: [
        {
          esimTranNo: "25080914060005",
          orderNo: "B2508091406000X",
          iccid: "8985224528000135401",
          ac: AC,
          qrCodeUrl: "https://p.qrsim.net/abc.png",
          smdpStatus: "RELEASED",
          esimStatus: "GOT_RESOURCE",
          totalVolume: 1073741824,
          orderUsage: 0,
          expiredTime: "2026-10-07T14:21:37+0000",
        },
      ],
      pager: { pageSize: 20, pageNum: 1, total: 1 },
    }),
  );

  const result = await supplier.order("JC066", "ref-1");

  check("errorCode 200010 is waited on, not thrown", result.profile.iccid === "8985224528000135401");
  check("the supplier order id is the orderNo", result.supplierOrderId === "B2508091406000X");
  check(
    "the LPA string is split into SM-DP+ and matching id",
    result.profile.smdpAddress === "rsp-eu.simlessly.com" && result.profile.matchingId === "MATCHING123",
    [result.profile.smdpAddress, result.profile.matchingId],
  );
  check("the activation code is kept whole as well", result.profile.activationCode === AC);
  check("the cost is the package price in dollars", result.costUsd === 0.7, result.costUsd);

  {
    const orderCall = calls.find((c) => c.path === "/esim/order")!;
    check(
      "the price is sent as amount so their API can refuse a rate card change",
      orderCall.body.amount === 7000 &&
        (orderCall.body.packageInfoList as Array<{ price: number }>)[0].price === 7000,
      orderCall.body,
    );
    check("count is one", (orderCall.body.packageInfoList as Array<{ count: number }>)[0].count === 1);
    check("the query is paged, which their API requires", !!calls.find((c) => c.path === "/esim/query")?.body.pager);
  }

  // transactionId is capped at 50 characters by their API.
  reset(
    ok({ packageList: [] }),
    ok({ orderNo: "B1" }),
    ok({ esimList: [{ iccid: "1", ac: AC }] }),
  );
  await supplier.order("JC066", "x".repeat(120));
  check(
    "the transaction id is truncated to their 50 character limit",
    String(calls.find((c) => c.path === "/esim/order")!.body.transactionId).length === 50,
  );

  // A price lookup that fails must not stop a paid order from provisioning.
  reset(
    fail("900001", "The system is busy, please try again later."),
    ok({ orderNo: "B2" }),
    ok({ esimList: [{ iccid: "2", ac: AC }] }),
  );
  const noPrice = await supplier.order("JC066", "ref-2");
  check(
    "a failed price check does not block provisioning an order already paid for",
    noPrice.profile.iccid === "2" && noPrice.costUsd === 0,
  );
  check(
    "and no amount is sent when the price could not be confirmed",
    calls.find((c) => c.path === "/esim/order")!.body.amount === undefined,
  );

  /* ---- 6. Cancelling, which is how you test without a sandbox -------------- */

  console.log("\ncancelling\n");

  reset(ok({}));
  check("a cancel that succeeds reports true", (await supplier.cancel({ supplierRef: "25080914060005" })) === true);
  check("esimTranNo is preferred over iccid", calls[0].body.esimTranNo === "25080914060005");

  reset(fail("200002", "This operation is not allowed due to the order status."));
  check(
    "a refused cancel is false, not an exception: an installed profile is a normal no",
    (await supplier.cancel({ iccid: "999" })) === false,
  );

  reset();
  check("nothing to identify means no call at all", (await supplier.cancel({})) === false && calls.length === 0);

  /* ---- 7. Usage ------------------------------------------------------------ */

  console.log("\nusage\n");

  reset(
    ok({
      esimList: [
        {
          iccid: "89852",
          totalVolume: 5368709120,
          orderUsage: 1453344832,
          expiredTime: "2026-10-07T14:21:37+0000",
          esimStatus: "IN_USE",
          smdpStatus: "ENABLED",
        },
      ],
    }),
  );
  const usage = await supplier.usage("89852");
  check("total and used convert from bytes", usage.totalMb === 5120 && usage.usedMb === 1386, [usage.totalMb, usage.usedMb]);
  check("remaining is the difference", usage.remainingMb === 3734, usage.remainingMb);
  check(
    "ENABLED plus IN_USE with data left is active, which ENABLE never matched",
    usage.status === "active",
    usage.status,
  );

  reset(ok({ esimList: [{ iccid: "1", totalVolume: 100, orderUsage: 100, esimStatus: "IN_USE", smdpStatus: "ENABLED" }] }));
  check("no data left is depleted, not active", (await supplier.usage("1")).status === "depleted");

  reset(ok({ esimList: [{ iccid: "1", totalVolume: 100, orderUsage: 0, esimStatus: "GOT_RESOURCE", smdpStatus: "RELEASED" }] }));
  check("issued but never installed is not_installed", (await supplier.usage("1")).status === "not_installed");

  reset(ok({ esimList: [{ iccid: "1", totalVolume: 100, orderUsage: 0, esimStatus: "UNUSED_EXPIRED", smdpStatus: "RELEASED" }] }));
  check("an expired download window is expired, not not_installed", (await supplier.usage("1")).status === "expired");

    globalThis.fetch = realFetch;
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed === 0 ? 0 : 1);
  }

  main().catch((e) => {
    globalThis.fetch = realFetch;
    console.error(e);
    process.exit(1);
  });
