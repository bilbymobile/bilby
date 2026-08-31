import crypto from "node:crypto";
import {
  CatalogPlan,
  InsufficientSupplierBalance,
  OrderResult,
  Supplier,
  UsageSnapshot,
} from "./types";

/**
 * eSIM Access adapter — the free tier's supply side.
 *
 * Chosen for one property the big-brand resale APIs do not have: ICCID-scoped
 * TOP-UPS against an already-installed profile, in packages small enough that a
 * handful of rewarded ad views can pay for one.
 *
 * That property is the entire ballgame for an ad-funded free tier. If every
 * data grant requires provisioning a NEW eSIM profile, then:
 *   - the user has to install a new profile every time they run dry (nobody
 *     will do this twice),
 *   - you burn a profile-issuance fee per grant,
 *   - and you cannot grant less than the smallest sellable bundle, which is
 *     usually 1 GB — roughly 50x more data than one ad view can fund.
 *
 * With ICCID top-up, the user installs ONE profile forever and you push MB onto
 * it. That is precisely the mechanic behind Firsty's "install once, top up
 * free forever" experience, and it is not reproducible on a supplier that only
 * sells whole bundles.
 *
 * Docs: https://docs.esimaccess.com/
 */

const BASE = process.env.ESIMACCESS_BASE_URL ?? "https://api.esimaccess.com/api/v1/open";

async function api<T>(path: string, body: unknown): Promise<T> {
  const accessCode = requiredEnv("ESIMACCESS_ACCESS_CODE");
  const secret = process.env.ESIMACCESS_SECRET_KEY;

  const payload = JSON.stringify(body ?? {});
  const timestamp = Date.now().toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "RT-AccessCode": accessCode,
  };

  // Signed requests are optional on some accounts and mandatory on others.
  // Sign whenever a secret is present — a superfluous signature is ignored,
  // a missing one is a 401 you will spend an afternoon on.
  if (secret) {
    headers["RT-Timestamp"] = timestamp;
    headers["RT-RequestID"] = crypto.randomUUID();
    headers["RT-Signature"] = crypto
      .createHash("sha256")
      .update(timestamp + headers["RT-RequestID"] + accessCode + payload + secret)
      .digest("hex");
  }

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: payload,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`eSIM Access ${path} failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { success: boolean; errorCode?: string; errorMsg?: string; obj?: T };

  if (!json.success) {
    // Balance errors are operational, not exceptional — separate them.
    if (json.errorCode && /BALANCE|INSUFFICIENT/i.test(json.errorCode)) {
      throw new InsufficientSupplierBalance("esimaccess");
    }
    throw new Error(`eSIM Access ${path}: ${json.errorCode} ${json.errorMsg}`);
  }
  return json.obj as T;
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

    return (obj.packageList ?? []).map((p) => ({
      planId: p.packageCode,
      name: p.name,
      countries: (p.locationNetworkList ?? [])
        .map((l) => l.locationName)
        .filter(Boolean) as string[],
      // eSIM Access returns volume in BYTES. Getting this wrong by 1024^2 is
      // the classic way to hand out a gigabyte when you meant a megabyte.
      dataMb: Math.round((p.volume ?? 0) / (1024 * 1024)),
      validityDays: p.duration ?? 0,
      // Prices come back in units of 1/10,000 USD.
      wholesaleUsd: (p.price ?? 0) / 10000,
      topUpSupported: Boolean(p.supportTopUpType),
    }));
  }

  /** Top-up packages available against one already-issued profile. */
  async listTopUpPlans(iccid: string): Promise<CatalogPlan[]> {
    const obj = await api<{ packageList: EaPackage[] }>("/package/list", {
      type: "TOPUP",
      iccid,
    });
    return (obj.packageList ?? []).map((p) => ({
      planId: p.packageCode,
      name: p.name,
      countries: [],
      dataMb: Math.round((p.volume ?? 0) / (1024 * 1024)),
      validityDays: p.duration ?? 0,
      wholesaleUsd: (p.price ?? 0) / 10000,
      topUpSupported: true,
    }));
  }

  async order(planId: string, ref: string): Promise<OrderResult> {
    const ordered = await api<{ orderNo: string }>("/esim/order", {
      transactionId: ref,
      packageInfoList: [{ packageCode: planId, count: 1 }],
    });

    // Provisioning is asynchronous. In production you should take the webhook
    // instead of polling; polling is here so the reference flow works before
    // you own a public HTTPS callback URL.
    const profile = await this.pollProfile(ordered.orderNo);

    return {
      supplierOrderId: ordered.orderNo,
      planId,
      costUsd: 0, // authoritative cost comes from the balance webhook
      profile,
    };
  }

  private async pollProfile(orderNo: string, attempts = 12) {
    for (let i = 0; i < attempts; i++) {
      const obj = await api<{ esimList: EaEsim[] }>("/esim/query", {
        orderNo,
        pager: { pageNum: 1, pageSize: 20 },
      });
      const e = obj.esimList?.[0];
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
    throw new Error(`Profile for order ${orderNo} not ready after ${attempts} polls`);
  }

  async topUp(iccid: string, planId: string, ref: string) {
    await api("/esim/topup", {
      transactionId: ref,
      iccid,
      packageCode: planId,
    });
    return { costUsd: 0 };
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

function mapStatus(
  esimStatus: string | undefined,
  smdpStatus: string | undefined,
  remainingMb: number
): UsageSnapshot["status"] {
  if (smdpStatus === "RELEASED" || smdpStatus === "ENABLE") {
    if (esimStatus === "IN_USE") return remainingMb > 0 ? "active" : "depleted";
    return "installed";
  }
  if (esimStatus === "USED_EXPIRED" || esimStatus === "USED_UP") return "expired";
  return "not_installed";
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

interface EaPackage {
  packageCode: string;
  name: string;
  volume?: number;
  duration?: number;
  price?: number;
  supportTopUpType?: number;
  locationNetworkList?: Array<{ locationName?: string }>;
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
