import crypto from "node:crypto";
import {
  CatalogPlan,
  InsufficientSupplierBalance,
  OrderResult,
  Supplier,
  UsageSnapshot,
} from "./types";

/**
 * Mock supplier.
 *
 * Exists so the entire product — checkout, fulfilment, delivery, install page,
 * QR, usage polling — runs end to end today with zero credentials and zero
 * dollars in anybody's wallet. That matters more than it sounds: it lets you
 * build, demo and even soft launch before you have signed a single supply
 * agreement, which is exactly the order you want to do it in.
 *
 * It deliberately simulates the two failure modes that will actually hurt you
 * in production and that no vendor sandbox reproduces:
 *   1. Prepaid wallet exhaustion mid-flow.
 *   2. Provisioning latency (real SM-DP+ profile generation is not instant).
 *
 * The activation codes it returns are structurally valid LPA strings pointing
 * at a non-existent SM-DP+, so the install page, QR encoder and universal-link
 * handoff can all be tested for real. They will fail at the final step on a
 * handset, which is correct — nothing here should ever burn a real profile.
 */

const PLANS: CatalogPlan[] = [];

/**
 * Indicative wholesale, US dollars per gigabyte, by destination.
 *
 * These are made up and they are meant to look made up. The real numbers live
 * in the catalogue tables, seeded from the supplier rate card, and nothing in
 * production reads this file. It exists so a fresh clone renders a plausible
 * shop with no credentials anywhere.
 */
const USD_PER_GB: Record<string, number> = {
  JP: 1.6, TH: 1.1, ID: 1.2, US: 2.4, GB: 1.8,
  IT: 1.7, VN: 1.0, SG: 1.3, AE: 3.2, NZ: 2.1,
};

const DESTINATIONS: Array<{ iso: string; label: string }> = [
  { iso: "JP", label: "Japan" },
  { iso: "TH", label: "Thailand" },
  { iso: "ID", label: "Indonesia" },
  { iso: "US", label: "United States" },
  { iso: "GB", label: "United Kingdom" },
  { iso: "IT", label: "Italy" },
  { iso: "VN", label: "Vietnam" },
  { iso: "SG", label: "Singapore" },
  { iso: "AE", label: "UAE" },
  { iso: "NZ", label: "New Zealand" },
];

for (const d of DESTINATIONS) {
  const perGb = USD_PER_GB[d.iso] ?? 2;

  for (const [gb, days] of [[1, 7], [3, 15], [5, 30], [10, 30]] as const) {
    PLANS.push({
      planId: `mock-${d.iso}-${gb}gb-${days}d`,
      name: `${d.label} ${gb} GB · ${days} days`,
      countries: [d.iso],
      dataMb: gb * 1024,
      validityDays: days,
      wholesaleUsd: round(gb * perGb, 2),
      minSellUsd: round(gb * perGb * 2.2, 2),
      topUpSupported: true,
    });
  }
}

export class MockSupplier implements Supplier {
  readonly id = "mock";
  readonly displayName = "Mock (local development)";
  readonly minimumWalletUsd = 0;
  readonly supportsMicroTopUp = true;

  /** Simulated prepaid wallet. Seeded from env so you can test exhaustion. */
  private walletUsd = Number(process.env.MOCK_SUPPLIER_WALLET_USD ?? "500");
  private issued = new Map<string, UsageSnapshot>();

  async listPlans(opts?: { country?: string }): Promise<CatalogPlan[]> {
    const all = PLANS;
    if (!opts?.country) return all;
    const iso = opts.country.toUpperCase();
    return all.filter((p) => p.countries.includes(iso));
  }

  async order(planId: string, _ref: string): Promise<OrderResult> {
    const plan = PLANS.find((p) => p.planId === planId);
    if (!plan) throw new Error(`Unknown plan ${planId}`);

    if (this.walletUsd < plan.wholesaleUsd) {
      throw new InsufficientSupplierBalance(this.id);
    }
    this.walletUsd -= plan.wholesaleUsd;

    // Real SM-DP+ provisioning is not instant. Anything downstream that assumes
    // it is will break in production, so make it not instant here either.
    await sleep(120);

    const iccid = mockIccid();
    const matchingId = crypto.randomBytes(8).toString("hex").toUpperCase();
    const smdpAddress = "rsp.example-smdp.invalid";

    this.issued.set(iccid, {
      iccid,
      totalMb: plan.dataMb,
      usedMb: 0,
      remainingMb: plan.dataMb,
      expiresAt: new Date(Date.now() + plan.validityDays * 864e5).toISOString(),
      status: "not_installed",
    });

    return {
      supplierOrderId: `mock_ord_${crypto.randomBytes(6).toString("hex")}`,
      planId,
      costUsd: plan.wholesaleUsd,
      profile: {
        iccid,
        smdpAddress,
        matchingId,
        activationCode: `LPA:1$${smdpAddress}$${matchingId}`,
      },
    };
  }

  async topUp(iccid: string, planId: string, _ref: string) {
    const plan = PLANS.find((p) => p.planId === planId);
    if (!plan) throw new Error(`Unknown plan ${planId}`);
    const snap = this.issued.get(iccid);
    if (!snap) throw new Error(`Unknown ICCID ${iccid}`);
    if (this.walletUsd < plan.wholesaleUsd) {
      throw new InsufficientSupplierBalance(this.id);
    }
    this.walletUsd -= plan.wholesaleUsd;
    snap.totalMb += plan.dataMb;
    snap.remainingMb += plan.dataMb;
    if (snap.status === "depleted") snap.status = "active";
    return { costUsd: plan.wholesaleUsd };
  }

  async usage(iccid: string): Promise<UsageSnapshot> {
    const snap = this.issued.get(iccid);
    if (!snap) throw new Error(`Unknown ICCID ${iccid}`);
    return { ...snap };
  }

  async balanceUsd(): Promise<number> {
    return round(this.walletUsd, 2);
  }
}

function mockIccid(): string {
  // 89 + 88 (test issuer) + 18 digits, Luhn-checked so validators accept it.
  let base = "8988" + Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join("");
  return base + luhnCheckDigit(base);
}

function luhnCheckDigit(num: string): string {
  let sum = 0;
  let dbl = true;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return String((10 - (sum % 10)) % 10);
}

function round(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
