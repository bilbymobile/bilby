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

  /**
   * Hand an unused profile back for a refund, where the supplier allows it.
   *
   * Optional because not every supplier offers it, and the ones that do all
   * restrict it to a profile that was issued and never installed. It matters
   * for two reasons that are easy to underestimate: it is how you test against
   * a supplier with no sandbox without burning money, and it is what makes a
   * customer refund whole rather than a write off, since the wholesale cost
   * comes back instead of staying spent.
   *
   * Returns false when the supplier declines, which is a normal answer for an
   * installed profile and not a fault.
   */
  cancel?(ref: { iccid?: string; supplierRef?: string }): Promise<boolean>;
}

/** Thrown when a supplier rejects an order for lack of prepaid funds. */
export class InsufficientSupplierBalance extends Error {
  constructor(public readonly supplierId: string) {
    super(`Supplier ${supplierId} rejected the order: prepaid balance exhausted`);
    this.name = "InsufficientSupplierBalance";
  }
}
