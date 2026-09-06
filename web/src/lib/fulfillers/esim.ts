import { paidSupplier } from "../suppliers";
import type { Fulfiller, Fulfilment, Quote, EntitlementStatus } from "../platform";
import { run, one } from "../db";

/**
 * The eSIM fulfiller.
 *
 * This is the ONLY file in the platform layer allowed to know what an ICCID is.
 * Everything above it, orders, entitlements, idempotency, the console, speaks
 * in SKUs and external references. That boundary is the entire reason a second
 * category will be cheap, and the only way it survives is that somebody notices
 * when a word from this file appears above it.
 *
 * It wraps the vendor adapters in src/lib/suppliers, which are older and speak
 * a different, eSIM shaped vocabulary. The translation happening here is the
 * point of the file: a plan id becomes an external id, an activation code
 * becomes an opaque payload, and a wallet balance error becomes a fulfilment
 * failure with a reason an operator can read.
 */

export const esimFulfiller: Fulfiller = {
  id: "esimaccess",
  category: "esim",
  displayName: "eSIM Access",

  capabilities: {
    topUp: true,
    usage: true,
    /*
     * Null until it is in writing.
     *
     * Whether an unactivated profile can be handed back is the single biggest
     * input to net margin on refunds, and it is a contract term rather than an
     * API feature. Guessing a number here would tell the console it is worth
     * trying a cancellation that the supplier will refuse, and the customer
     * would be told a refund was coming that was never possible. When the
     * supplier agreement says a number, put it here and not before.
     */
    cancelWindowMinutes: null,
  },

  async quote(externalId: string): Promise<Quote> {
    try {
      const plans = await paidSupplier().listPlans();
      const p = plans.find((x) => x.planId === externalId);
      if (!p) {
        return {
          available: false,
          costAmount: 0,
          costCurrency: "USD",
          note: `The supplier no longer lists ${externalId}. The catalogue source is stale.`,
        };
      }
      return { available: true, costAmount: p.wholesaleUsd, costCurrency: "USD" };
    } catch (e) {
      return {
        available: false,
        costAmount: 0,
        costCurrency: "USD",
        note: (e as Error).message,
      };
    }
  },

  async fulfil({ externalId, key, userRef }): Promise<Fulfilment> {
    /*
     * The key is passed through as the supplier's own reference.
     *
     * Our idempotency guard protects against our retries. Theirs protects
     * against the case ours cannot see: a request that timed out on the network
     * after the supplier had already provisioned. Without passing it through,
     * that timeout costs a profile every time it happens.
     */
    const result = await paidSupplier().order(externalId, key);

    /*
     * The esims table is written here rather than by the caller.
     *
     * It is category specific storage: ICCID, activation code, SM DP plus
     * address, matching id. None of that belongs in entitlements.payload as
     * the authoritative copy, because the install page needs to query by ICCID
     * and a JSONB lookup for the single hottest read in the product is a choice
     * nobody would defend.
     */
    await run(
      `INSERT INTO esims
         (iccid, user_id, supplier, supplier_order, activation_code, smdp_address, matching_id)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (iccid) DO NOTHING`,
      [
        result.profile.iccid,
        userRef,
        paidSupplier().id,
        result.supplierOrderId,
        result.profile.activationCode,
        result.profile.smdpAddress,
        result.profile.matchingId,
      ],
    );

    return {
      externalRef: result.profile.iccid,
      supplierRef: result.supplierOrderId,
      costAmount: result.costUsd,
      costCurrency: "USD",
      label: `eSIM ${result.profile.iccid.slice(-6)}`,
      payload: {
        // Enough for a list row and a link. NOT the activation code: an
        // activation code is a bearer credential, whoever holds it can install
        // the profile, and entitlements.payload is read by more code paths than
        // the esims table is.
        iccid: result.profile.iccid,
        installPath: `/esims/${result.profile.iccid}`,
      },
    };
  },

  async status(externalRef: string) {
    const snap = await paidSupplier().usage(externalRef);
    const map: Record<string, EntitlementStatus> = {
      not_installed: "issued",
      installed: "active",
      active: "active",
      depleted: "depleted",
      expired: "expired",
    };
    return {
      status: map[snap.status] ?? "issued",
      payload: {
        totalMb: snap.totalMb,
        usedMb: snap.usedMb,
        remainingMb: snap.remainingMb,
        expiresAt: snap.expiresAt,
      },
    };
  },

  /*
   * No cancel implementation, deliberately.
   *
   * The interface makes it optional, and an optional method absent is an honest
   * "we cannot do this". A stub that threw would be indistinguishable from a
   * supplier outage, and a stub that returned null would claim we asked and
   * they said no. Until the supplier agreement grants a cancellation window in
   * writing, refunds on this category are a money movement in Stripe and a
   * written off profile, and the console should say exactly that.
   */
};

/** Whether an ICCID has been marked installed, for the entitlement status. */
export async function markInstalled(iccid: string): Promise<void> {
  await one(
    `UPDATE esims SET installed_at = COALESCE(installed_at, now()) WHERE iccid = ?`,
    [iccid],
  );
}
