import crypto from "node:crypto";
import {
  CatalogPlan,
  InsufficientSupplierBalance,
  OrderResult,
  Supplier,
  UsageSnapshot,
} from "./types";

/**
 * eSIM Access adapter.
 *
 * Written against the published reseller collection at docs.esimaccess.com,
 * which is a Postman document whose machine readable form is public. Every
 * field name, error code and unit below came from that document rather than
 * from a guess, and the ones that could not be established are marked as such
 * where they matter.
 *
 * Chosen for one property the big brand resale APIs do not have: top ups
 * against an already installed profile, in packages small enough to be useful.
 * A supplier that only sells whole bundles forces a new profile install every
 * time somebody runs dry, and nobody installs a second profile on holiday.
 *
 * ## Four conventions that will bite if you forget them
 *
 * 1. **Money is integers times 10,000.** `10000` is one US dollar. This is true
 *    of `price`, `retailPrice`, the `amount` you send on an order, and your
 *    account `balance`.
 * 2. **Data is bytes**, everywhere. Not megabytes, not kilobytes.
 * 3. **HTTP is always 200.** Failures arrive as `success: false` in the body.
 *    A transport level check tells you nothing.
 * 4. **The failure message field has two spellings.** Saved success examples
 *    use `errorMsg`; the parameter tables and saved failures use
 *    `errorMessage`. Read both or your error reports will say "undefined".
 *
 * ## There is no sandbox
 *
 * Their own words: "There is no Sandbox environment. Cancel eSIM orders as
 * needed in our live environment. Request funds for testing." So testing is
 * real orders against production, cancelled for a refund before installation.
 * That is why `cancel()` exists here and why it is worth wiring up before the
 * first live order rather than after.
 */

/**
 * The API root.
 *
 * Their collection resolves `{{host}}` to `https://api.esimaccess.com` and
 * every path is under `/api/v1/open`.
 */
const BASE = process.env.ESIMACCESS_BASE_URL ?? "https://api.esimaccess.com/api/v1/open";

/** Their documented ceiling: "8 API request per second are allowed." */
const MAX_RPS = 8;

/**
 * A crude request spacer.
 *
 * Eight per second is generous for a shop this size and ruinous to breach on
 * the one path that provisions a paid order, so requests are spaced rather
 * than counted. One process, one in flight chain: not a distributed limiter,
 * and it does not need to be, because the alternative it is protecting against
 * is a fulfilment retry storm from a single instance.
 */
let gate: Promise<void> = Promise.resolve();
function spaced<T>(fn: () => Promise<T>): Promise<T> {
  const run = gate.then(fn);
  gate = run.then(
    () => new Promise((r) => setTimeout(r, Math.ceil(1000 / MAX_RPS))),
    () => new Promise((r) => setTimeout(r, Math.ceil(1000 / MAX_RPS))),
  );
  return run;
}

/** Error codes worth naming, from their published table. */
const CODE = {
  /** "Insufficient account balance". */
  NO_BALANCE: "200007",
  /** "Profile is being downloaded for the order." Not a failure: wait. */
  ALLOCATING: "200010",
  /** "Request signature mismatch." */
  BAD_SIGNATURE: "101003",
  /** "The timestamp of the request has expired." */
  STALE_TIMESTAMP: "101001",
} as const;

/** Thrown while the SM-DP+ is still building profiles for an order. */
class StillAllocating extends Error {
  constructor(orderNo: string) {
    super(`eSIM Access is still allocating profiles for ${orderNo}`);
    this.name = "StillAllocating";
  }
}

interface Envelope<T> {
  success: boolean;
  errorCode?: string | null;
  /** Success examples use this spelling. */
  errorMsg?: string | null;
  /** Failure examples and the parameter tables use this one. */
  errorMessage?: string | null;
  obj?: T | null;
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const accessCode = requiredEnv("ESIMACCESS_ACCESS_CODE");
  const secret = process.env.ESIMACCESS_SECRET_KEY;

  // Signed byte for byte over the string that is actually sent. Serialising
  // twice would let a key order difference produce a signature over a
  // different document than the one on the wire, and the symptom would be an
  // intermittent 101003 that looks like a clock problem.
  const payload = JSON.stringify(body ?? {});

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "RT-AccessCode": accessCode,
  };

  /*
   * The signature.
   *
   *   signStr = RT-Timestamp + RT-RequestID + RT-AccessCode + requestBody
   *   sign    = HMACSHA256(signStr, secretKey)
   *
   * This was a plain SHA-256 of the same string with the secret concatenated
   * on the end, which is a different construction entirely and would have
   * produced 101003 "Request signature mismatch" on the very first call.
   *
   * Two details their documentation contradicts itself on, so both are
   * resolved conservatively:
   *
   *   - The header table calls the timestamp milliseconds; the worked example
   *     is ten digits, which is seconds. Seconds is used, because it is the
   *     value in the example that their own server accepted.
   *   - The prose says lowercase the hex; the example signature is uppercase.
   *     Lowercase is used, because it is the instruction rather than an
   *     artefact of how somebody pasted an example.
   *
   * If a live call returns 101003, those two are the first things to flip, and
   * flipping them is a two line change rather than an investigation.
   */
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // Their example RequestID is a v4 UUID with the dashes stripped.
    const requestId = crypto.randomUUID().replace(/-/g, "");
    headers["RT-Timestamp"] = timestamp;
    headers["RT-RequestID"] = requestId;
    headers["RT-Signature"] = crypto
      .createHmac("sha256", secret)
      .update(timestamp + requestId + accessCode + payload)
      .digest("hex")
      .toLowerCase();
  }

  const res = await spaced(() =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers,
      body: payload,
      cache: "no-store",
      // Provisioning is the slowest call and it still answers in seconds. A
      // request with no timeout is a fulfilment worker that never finishes.
      signal: AbortSignal.timeout(20_000),
    }),
  );

  // Their errors come back inside a 200, so a non 200 is a proxy, an outage or
  // a wrong host rather than a rejected request. Worth saying differently.
  if (!res.ok) {
    throw new Error(
      `eSIM Access ${path}: HTTP ${res.status}. Their API answers 200 even when ` +
        `it refuses a request, so this is the network or the host, not the call.`,
    );
  }

  const json = (await res.json()) as Envelope<T>;
  const message = json.errorMsg ?? json.errorMessage ?? null;

  // "null or 0 when successful", per their envelope table.
  const ok = json.success === true && (!json.errorCode || json.errorCode === "0");
  if (!ok) {
    const code = json.errorCode ?? "";
    if (code === CODE.NO_BALANCE) throw new InsufficientSupplierBalance("esimaccess");
    if (code === CODE.ALLOCATING) throw new StillAllocating(String((body as { orderNo?: string })?.orderNo ?? ""));
    if (code === CODE.BAD_SIGNATURE || code === CODE.STALE_TIMESTAMP) {
      throw new Error(
        `eSIM Access ${path}: ${code} ${message}. This is the signature, not the ` +
          `credentials: check ESIMACCESS_SECRET_KEY, and see the note in api() ` +
          `about the timestamp unit and hex case.`,
      );
    }
    throw new Error(`eSIM Access ${path}: ${code} ${message}`);
  }
  return (json.obj ?? {}) as T;
}

/** Their transactionId is capped at 50 characters. */
function txn(ref: string): string {
  return ref.slice(0, 50);
}

export class EsimAccessSupplier implements Supplier {
  readonly id = "esimaccess";
  readonly displayName = "eSIM Access";
  readonly minimumWalletUsd = 0;
  /** The reason this adapter exists. */
  readonly supportsMicroTopUp = true;

  async listPlans(opts?: { country?: string }): Promise<CatalogPlan[]> {
    const obj = await api<{ packageList: EaPackage[] }>("/package/list", {
      locationCode: opts?.country?.toUpperCase() ?? "",
      type: "",
    });

    return (obj.packageList ?? []).map(toPlan);
  }

  /** Top-up packages available against one already-issued profile. */
  async listTopUpPlans(iccid: string): Promise<CatalogPlan[]> {
    const obj = await api<{ packageList: EaPackage[] }>("/package/list", {
      type: "TOPUP",
      iccid,
    });
    return (obj.packageList ?? []).map(toPlan);
  }

  /**
   * Buy one profile.
   *
   * Two steps, because their ordering is asynchronous by design: the order
   * returns an `orderNo` immediately and the SM-DP+ builds the profile behind
   * it, which their documentation says can take up to thirty seconds.
   *
   * The price is looked up and sent as `amount`, which is optional and worth
   * sending. Their API verifies it and refuses with 200005 or 200006 if it
   * disagrees. That turns a silent rate card change into a refused order
   * instead of a sale at a cost you did not agree to, which is the failure
   * this business would notice last and mind most.
   */
  async order(planId: string, ref: string): Promise<OrderResult> {
    const priceUnits = await this.priceUnitsFor(planId);

    const ordered = await api<{ orderNo: string }>("/esim/order", {
      transactionId: txn(ref),
      ...(priceUnits === null ? {} : { amount: priceUnits }),
      packageInfoList: [
        { packageCode: planId, count: 1, ...(priceUnits === null ? {} : { price: priceUnits }) },
      ],
    });

    // In production the ORDER_STATUS webhook is the right trigger. Polling is
    // here so the flow works before a public callback URL is registered, and
    // because a webhook you have not yet proven is not a thing to depend on
    // during the first live order.
    const profile = await this.pollProfile(ordered.orderNo);

    return {
      supplierOrderId: ordered.orderNo,
      planId,
      costUsd: priceUnits === null ? 0 : priceUnits / 10000,
      profile,
    };
  }

  /**
   * What one package costs, in their integer units, or null if unknown.
   *
   * Sending a price we cannot confirm would be worse than sending none: their
   * check would then reject a correct order over our own bad guess.
   */
  private async priceUnitsFor(packageCode: string): Promise<number | null> {
    try {
      const obj = await api<{ packageList: EaPackage[] }>("/package/list", {
        packageCode,
        locationCode: "",
        type: "",
        slug: "",
        iccid: "",
      });
      const hit = (obj.packageList ?? []).find(
        (p) => p.packageCode === packageCode || p.slug === packageCode,
      );
      return typeof hit?.price === "number" ? hit.price : null;
    } catch {
      // A price check that cannot complete must not stop a paid order. The
      // customer has already been charged; provisioning is the priority and
      // the cost is reconciled from the balance either way.
      return null;
    }
  }

  /**
   * Wait for the SM-DP+ to finish building the profile.
   *
   * Their documentation: "Expect wait times of up to 30 seconds", and while it
   * is working the query returns errorCode 200010 rather than an empty list.
   *
   * That code used to come back through the generic error path and abort the
   * order on the first poll, which meant a paid order could never complete: the
   * one response guaranteed to arrive while provisioning was treated as a
   * fatal failure. It is now a signal to wait, and the budget is 45 seconds
   * rather than 24, because a ceiling below their own stated worst case is not
   * a ceiling.
   */
  private async pollProfile(orderNo: string, attempts = 22) {
    let lastAllocating = false;
    for (let i = 0; i < attempts; i++) {
      let e: EaEsim | undefined;
      try {
        const obj = await api<{ esimList: EaEsim[] }>("/esim/query", {
          orderNo,
          iccid: "",
          pager: { pageNum: 1, pageSize: 20 },
        });
        e = obj.esimList?.[0];
        lastAllocating = false;
      } catch (err) {
        if (!(err instanceof StillAllocating)) throw err;
        lastAllocating = true;
      }
      if (e?.ac) {
        const m = e.ac.match(/^LPA:1\$([^$]+)\$([^$]+)/i);
        if (!m) throw new Error(`Malformed activation code: ${e.ac}`);
        return {
          iccid: e.iccid,
          smdpAddress: m[1],
          matchingId: m[2],
          activationCode: e.ac,
          qrCodeUrl: e.qrCodeUrl,
        };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(
      `eSIM Access order ${orderNo} was accepted but no profile appeared after ` +
        `${attempts * 2} seconds${lastAllocating ? " (still allocating)" : ""}. ` +
        `The order exists and the money is spent, so this is a retry, not a ` +
        `re-order: query /esim/query with this orderNo before buying again.`,
    );
  }

  /**
   * Add a package to a profile that is already installed.
   *
   * Their docs mark `iccid` deprecated in favour of `esimTranNo`, and note that
   * ICCIDs are reused between profiles. The platform contract addresses a
   * profile by ICCID, so that is what is sent; the day that produces a wrong
   * profile, the fix is to carry `esimTranNo` on the entitlement rather than to
   * patch around it here.
   */
  async topUp(iccid: string, planId: string, ref: string) {
    const priceUnits = await this.priceUnitsFor(planId);
    await api("/esim/topup", {
      transactionId: txn(ref),
      iccid,
      esimTranNo: "",
      packageCode: planId,
      ...(priceUnits === null ? {} : { amount: priceUnits }),
    });
    return { costUsd: priceUnits === null ? 0 : priceUnits / 10000 };
  }

  /**
   * Give an unused profile back.
   *
   * Only works while the profile was issued and never installed, which their
   * docs define as esimStatus GOT_RESOURCE and smdpStatus RELEASED. Anything
   * else is refused, and refusal is a normal answer rather than a fault, so
   * this returns false instead of throwing.
   *
   * This is also how you test against a supplier with no sandbox: order for
   * real, confirm the profile, cancel it, and the wholesale returns to the
   * balance.
   */
  async cancel(ref: { iccid?: string; supplierRef?: string }): Promise<boolean> {
    if (!ref.iccid && !ref.supplierRef) return false;
    try {
      await api("/esim/cancel", {
        ...(ref.supplierRef ? { esimTranNo: ref.supplierRef } : {}),
        ...(ref.iccid ? { iccid: ref.iccid } : {}),
      });
      return true;
    } catch (e) {
      // Their own refusals for an installed or unknown profile are 200002 and
      // 310403/310404. A refused cancellation is information, not an incident.
      if (e instanceof Error && /\b(200002|310403|310404)\b/.test(e.message)) return false;
      throw e;
    }
  }

  async usage(iccid: string): Promise<UsageSnapshot> {
    const obj = await api<{ esimList: EaEsim[] }>("/esim/query", {
      iccid,
      pager: { pageNum: 1, pageSize: 1 },
    });
    const e = obj.esimList?.[0];
    if (!e) throw new Error(`Unknown ICCID ${iccid}`);

    const totalMb = Math.round((e.totalVolume ?? 0) / (1024 * 1024));
    const usedMb = Math.round((e.orderUsage ?? 0) / (1024 * 1024));

    return {
      iccid,
      totalMb,
      usedMb,
      remainingMb: Math.max(0, totalMb - usedMb),
      expiresAt: e.expiredTime ?? null,
      status: mapStatus(e.esimStatus, e.smdpStatus, totalMb - usedMb),
    };
  }

  async balanceUsd(): Promise<number> {
    const obj = await api<{ balance: number }>("/balance/query", {});
    return (obj.balance ?? 0) / 10000;
  }
}

/**
 * One supplier package, in our shape.
 *
 * `countries` comes from `location`, a comma separated list of ISO alpha-2
 * codes. It used to come from `locationNetworkList[].locationName`, which is
 * the display name of the network's country ("Slovenia"), so the field the
 * platform treats as an ISO code was carrying prose. Nothing failed loudly; a
 * destination filter simply never matched.
 */
function toPlan(p: EaPackage): CatalogPlan {
  return {
    planId: p.packageCode,
    name: p.name,
    countries: (p.location ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c)),
    // Volumes are BYTES. Getting this wrong by 1024^2 is the classic way to
    // hand out a gigabyte when you meant a megabyte.
    dataMb: Math.round((p.volume ?? 0) / (1024 * 1024)),
    validityDays: p.duration ?? 0,
    // Prices are integers times 10,000. 10000 is one dollar.
    wholesaleUsd: (p.price ?? 0) / 10000,
    // Documented as "1 = no, 2 = yes, 3 = yes with periodNum", so a truthy
    // check would call 1 a yes.
    topUpSupported: p.supportTopUpType === 2 || p.supportTopUpType === 3,
  };
}

/**
 * Their two status fields, reduced to ours.
 *
 * Driven by the state table they publish rather than by guesswork, which
 * matters because the pair is not redundant: smdpStatus describes the profile
 * on the SM-DP+ and esimStatus describes the order, and the combination is
 * what distinguishes "issued, never installed" from "installed and idle".
 *
 * The previous version tested for "ENABLE", which is not one of their values;
 * the real one is "ENABLED", so every installed profile fell through to
 * "not_installed" and told the customer to install an eSIM they were already
 * using.
 */
function mapStatus(
  esimStatus: string | undefined,
  smdpStatus: string | undefined,
  remainingMb: number
): UsageSnapshot["status"] {
  // Ordered by their glossary: the order's own terminal states win, because a
  // cancelled or expired order is not "installed" whatever the profile says.
  if (esimStatus === "USED_EXPIRED" || esimStatus === "UNUSED_EXPIRED") return "expired";
  if (esimStatus === "USED_UP") return "depleted";

  // RELEASED means built and ready to download: issued, not yet on a handset.
  if (smdpStatus === "RELEASED") return "not_installed";

  if (smdpStatus === "ENABLED" || smdpStatus === "DISABLED" || smdpStatus === "INSTALLATION" || smdpStatus === "DOWNLOAD") {
    if (esimStatus === "IN_USE") return remainingMb > 0 ? "active" : "depleted";
    return "installed";
  }

  return "not_installed";
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

/** Only the fields this adapter reads. Their package object has many more. */
interface EaPackage {
  packageCode: string;
  /** Human readable alias of packageCode, eg AU_1_7. Their docs prefer it. */
  slug?: string;
  name: string;
  /** Bytes. */
  volume?: number;
  duration?: number;
  /** Integer, times 10,000. */
  price?: number;
  /** 1 no, 2 yes, 3 yes with periodNum. */
  supportTopUpType?: number;
  /** Comma separated ISO alpha-2, eg "CN,HK,ID,JP". */
  location?: string;
}

interface EaEsim {
  iccid: string;
  ac?: string;
  qrCodeUrl?: string;
  totalVolume?: number;
  orderUsage?: number;
  expiredTime?: string | null;
  esimStatus?: string;
  smdpStatus?: string;
}
