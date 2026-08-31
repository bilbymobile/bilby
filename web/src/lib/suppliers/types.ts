/**
 * Supplier abstraction.
 *
 * You will change eSIM suppliers. Everybody does — you start on whoever will
 * take a $0 or $250 wallet, and you move the moment volume earns you a real
 * rate card. The entire commercial risk of this business is being unable to
 * move, so the supplier contract is defined here once and every adapter bends
 * to it, rather than the app bending to whichever vendor you signed first.
 *
 * Concretely this means the app never sees `smdpAddress` from one vendor and
 * `smDpPlus` from another, never sees data in MB from one and GB from another,
 * and never learns that vendor X has no top-up endpoint. Adapters absorb all
 * of it.
 */

export interface CatalogPlan {
  /** Supplier's opaque plan id. Never shown to users. */
  planId: string;
  /** Human name, e.g. "Japan 3 GB · 15 days". */
  name: string;
  /** ISO-3166 alpha-2 codes this plan covers. */
  countries: string[];
  dataMb: number;
  validityDays: number;
  /** What YOU pay, in USD. Never render this to a customer. */
  wholesaleUsd: number;
  /** Supplier's floor price, if they impose one (Airalo does). */
  minSellUsd?: number;
  /** True if the plan can be topped up in place rather than re-provisioned. */
  topUpSupported: boolean;
}

export interface EsimProfile {
  iccid: string;
  /** Full LPA string: LPA:1$<smdp>$<matchingId> */
  activationCode: string;
  smdpAddress: string;
  matchingId: string;
  /** Some suppliers return a hosted QR; we can also render our own. */
  qrCodeUrl?: string;
  /** Optional supplier-side confirmation code (rare). */
  confirmationCode?: string;
}

export interface UsageSnapshot {
  iccid: string;
  totalMb: number;
  usedMb: number;
  remainingMb: number;
  expiresAt: string | null;
  status: "not_installed" | "installed" | "active" | "depleted" | "expired";
}

export interface OrderResult {
  supplierOrderId: string;
  profile: EsimProfile;
  planId: string;
  costUsd: number;
}

export interface Supplier {
  readonly id: string;
  readonly displayName: string;
  /** Minimum prepaid wallet this supplier demands to switch the API on. */
  readonly minimumWalletUsd: number;
  /** True if the vendor supports arbitrary small top-ups (needed for ad-funded MB). */
  readonly supportsMicroTopUp: boolean;

  listPlans(opts?: { country?: string }): Promise<CatalogPlan[]>;
  order(planId: string, ref: string): Promise<OrderResult>;
  topUp(iccid: string, planId: string, ref: string): Promise<{ costUsd: number }>;
  usage(iccid: string): Promise<UsageSnapshot>;
  balanceUsd(): Promise<number>;
}

/** Thrown when a supplier rejects an order for lack of prepaid funds. */
export class InsufficientSupplierBalance extends Error {
  constructor(public readonly supplierId: string) {
    super(`Supplier ${supplierId} rejected the order: prepaid balance exhausted`);
    this.name = "InsufficientSupplierBalance";
  }
}
