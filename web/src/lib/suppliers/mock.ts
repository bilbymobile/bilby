import crypto from "node:crypto";
import {
  CatalogPlan,
  InsufficientSupplierBalance,
  OrderResult,
  Supplier,
  UsageSnapshot,
} from "./types";
import { costPerMb, regionForCountry } from "../pricing";

/**
 * Mock supplier.
 *
 * Exists so the entire product — signup, ads, ledger, redemption, install
 * page, QR, usage polling — runs end to end today with zero credentials and
 * zero dollars in anybody's wallet. That matters more than it sounds: it lets
 * you build, demo and even soft-launch a waitlist before you have signed a
 * single supply agreement, which is exactly the order you want to do it in.
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

const MICRO_PLANS: CatalogPlan[] = [];
const REGULAR_PLANS: CatalogPlan[] = [];

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
  const region = regionForCountry(d.iso);
  const perMb = costPerMb(region, "starter");

  // Micro top-ups: the unit the ad-funded free tier actually consumes.
  for (const mb of [50, 100, 250]) {
    MICRO_PLANS.push({
      planId: `mock-micro-${d.iso}-${mb}`,
      name: `${d.label} ${mb} MB · 7 days`,
      countries: [d.iso],
      dataMb: mb,
      validityDays: 7,
      wholesaleUsd: round(mb * perMb * 1.15, 4), // micro units carry a premium
      topUpSupported: true,
    });
  }

  // Retail bundles: what you actually sell for money.
  for (const [gb, days] of [[1, 7], [3, 15], [5, 30], [10, 30]] as const) {
    REGULAR_PLANS.push({
      planId: `mock-${d.iso}-${gb}gb-${days}d`,
      name: `${d.label} ${gb} GB · ${days} days`,
      countries: [d.iso],
      dataMb: gb * 1024,
      validityDays: days,
      wholesaleUsd: round(gb * 1024 * perMb, 2),
      minSellUsd: round(gb * 1024 * perMb * 2.2, 2),
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
    const all = [...MICRO_PLANS, ...REGULAR_PLANS];
    if (!opts?.country) return all;
    const iso = opts.country.toUpperCase();
    return all.filter((p) => p.countries.includes(iso));
  }

  async order(planId: string, _ref: string): Promise<OrderResult> {
    const plan = [...MICRO_PLANS, ...REGULAR_PLANS].find((p) => p.planId === planId);
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
    const plan = [...MICRO_PLANS, ...REGULAR_PLANS].find((p) => p.planId === planId);
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
