import { all, one, run, tx } from "./db";

/**
 * The platform layer: catalogue, fulfilment, entitlements, idempotency.
 *
 * See PLATFORM.md for the reasoning. The one sentence version is that this file
 * must never learn what an eSIM is. Everything here is phrased in terms of a
 * SKU, a category, a fulfiller and an entitlement, and the only place the word
 * ICCID appears is inside the eSIM adapter at the bottom, where it belongs.
 *
 * The test that keeps it honest: adding a second category must touch one new
 * fulfiller, one attributes shape, one detail panel and one console tab. If it
 * touches this file's commerce or idempotency functions, the abstraction has
 * failed and the fix is here rather than there.
 */

/* ------------------------------------------------------------------------ *
 * The fulfiller contract
 * ------------------------------------------------------------------------ */

export interface Quote {
  available: boolean;
  costAmount: number;
  costCurrency: string;
  /** Why not, when unavailable. Written for an operator, never for a customer. */
  note?: string;
}

export interface Fulfilment {
  /** Identifies the delivered thing. An ICCID, for an eSIM. */
  externalRef: string;
  /** The supplier's own order id, for when you have to ring them about it. */
  supplierRef: string;
  costAmount: number;
  costCurrency: string;
  /** What the customer sees in a list of things they own. */
  label: string;
  expiresAt?: string | null;
  /** Category specific detail. The activation material, for an eSIM. */
  payload?: Record<string, unknown>;
}

export type EntitlementStatus =
  | "issued"
  | "active"
  | "depleted"
  | "expired"
  | "revoked";

export interface Fulfiller {
  readonly id: string;
  readonly category: string;
  readonly displayName: string;

  /** Can this be served right now, and at what cost. */
  quote(externalId: string): Promise<Quote>;

  /**
   * Deliver it.
   *
   * MUST be idempotent on `key`. The caller claims the key first, but an
   * adapter that can pass it through to the supplier as their own idempotency
   * reference should do so: our guard protects against our own retries, and
   * theirs protects against a timeout where the work was already done.
   */
  fulfil(input: {
    externalId: string;
    key: string;
    userRef: string;
    /** Whatever the category asked the customer for. Empty for an eSIM. */
    input?: Record<string, unknown>;
  }): Promise<Fulfilment>;

  /** Current state of something already delivered. */
  status(externalRef: string): Promise<{ status: EntitlementStatus; payload?: Record<string, unknown> }>;

  /**
   * Hand it back, if the supplier allows it.
   *
   * Returns null rather than throwing when they do not, because whether an
   * unactivated profile can be cancelled is the single biggest input to net
   * margin and the console has to be able to show an operator whether it is
   * even worth trying.
   */
  cancel?(externalRef: string): Promise<{ refundedAmount: number } | null>;

  /**
   * Declared, not discovered.
   *
   * The old supplier router learned this lesson once already: it hard failed on
   * a supplier that could not do micro top ups rather than silently
   * provisioning a whole bundle. Same principle, made general.
   */
  readonly capabilities: {
    topUp: boolean;
    usage: boolean;
    /** Null when they will not take it back at all. */
    cancelWindowMinutes: number | null;
  };
}

const REGISTRY = new Map<string, Fulfiller>();

export function registerFulfiller(f: Fulfiller): void {
  REGISTRY.set(f.id, f);
}

export function fulfillerFor(id: string): Fulfiller {
  const f = REGISTRY.get(id);
  if (!f) {
    throw new Error(
      `No fulfiller registered as "${id}". Registered: ` +
        (REGISTRY.size ? [...REGISTRY.keys()].join(", ") : "none") +
        ". A catalogue source names a fulfiller that must exist at boot; this " +
        "is a wiring error, not a runtime condition.",
    );
  }
  return f;
}

/** Test seam, and the only supported way to empty the registry. */
export function __resetFulfillers(): void {
  REGISTRY.clear();
}

/* ------------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------------ */

export interface CatalogItem {
  sku: string;
  category: string;
  title: string;
  subtitle: string | null;
  taxCode: string;
  active: boolean;
  sortOrder: number;
  attributes: Record<string, unknown>;
  inputSchema: Record<string, unknown>;
}

export interface PricedItem extends CatalogItem {
  currency: string;
  sellAmount: number;
}

type ItemRow = {
  sku: string; category: string; title: string; subtitle: string | null;
  tax_code: string; active: boolean; sort_order: number;
  attributes: Record<string, unknown>; input_schema: Record<string, unknown>;
};

function toItem(r: ItemRow): CatalogItem {
  return {
    sku: r.sku, category: r.category, title: r.title, subtitle: r.subtitle,
    taxCode: r.tax_code, active: r.active, sortOrder: r.sort_order,
    attributes: r.attributes ?? {}, inputSchema: r.input_schema ?? {},
  };
}

/**
 * What is for sale, priced, in one query.
 *
 * Note what this does NOT do: it never asks a supplier anything. The old
 * catalogue route fetched the supplier's plan list on every request and priced
 * it on the fly from wholesale times a margin constant, which meant the price
 * could change between the plans page and the checkout page and there was no
 * stable identifier to write onto an order. A catalogue is a decision somebody
 * made, not a mirror of a vendor's inventory.
 */
export async function listCatalog(
  category: string,
  currency = "AUD",
  where: { attribute?: [string, string] } = {},
): Promise<PricedItem[]> {
  // The attribute filter is a JSONB text comparison rather than a column,
  // because "which country" is an eSIM fact and the catalogue must not grow a
  // country column that every future category has to leave null. The key is
  // supplied by the caller, never by a request, so there is nothing to inject.
  const attr = where.attribute;
  const rows = await all<ItemRow & { currency: string; sell_amount: string }>(
    `SELECT i.*, p.currency, p.sell_amount
       FROM catalog_items i
       JOIN catalog_prices p ON p.sku = i.sku AND p.currency = ?
      WHERE i.category = ? AND i.active
        ${attr ? "AND i.attributes ->> ? = ?" : ""}
      ORDER BY i.sort_order, p.sell_amount`,
    attr ? [currency, category, attr[0], attr[1]] : [currency, category],
  );
  return rows.map((r) => ({
    ...toItem(r),
    currency: r.currency,
    sellAmount: Number(r.sell_amount),
  }));
}

export async function getItem(sku: string): Promise<CatalogItem | null> {
  const r = await one<ItemRow>(`SELECT * FROM catalog_items WHERE sku = ?`, [sku]);
  return r ? toItem(r) : null;
}

export async function priceOf(
  sku: string,
  currency = "AUD",
): Promise<number | null> {
  const r = await one<{ sell_amount: string }>(
    `SELECT sell_amount FROM catalog_prices WHERE sku = ? AND currency = ?`,
    [sku, currency],
  );
  return r ? Number(r.sell_amount) : null;
}

export interface Source {
  sku: string;
  fulfillerId: string;
  externalId: string;
  costAmount: number;
  costCurrency: string;
  priority: number;
}

/**
 * Which fulfiller serves this SKU.
 *
 * Lowest priority number wins, and disabled sources are invisible. Switching
 * supplier for one destination is an update to one row here rather than a
 * deploy, which is the whole point of "suppliers are a registry, not a choice".
 *
 * There is deliberately no automatic failover to the next source. A supplier
 * that is half up provisions half a catalogue against the wrong rate card, and
 * you find out on the invoice. A human turns one off.
 */
export async function pickSource(sku: string): Promise<Source | null> {
  const r = await one<{
    sku: string; fulfiller_id: string; external_id: string;
    cost_amount: string; cost_currency: string; priority: number;
  }>(
    `SELECT * FROM catalog_sources
      WHERE sku = ? AND enabled
      ORDER BY priority ASC
      LIMIT 1`,
    [sku],
  );
  if (!r) return null;
  return {
    sku: r.sku,
    fulfillerId: r.fulfiller_id,
    externalId: r.external_id,
    costAmount: Number(r.cost_amount),
    costCurrency: r.cost_currency,
    priority: r.priority,
  };
}

/* -- writes, used by the console and by seeding ------------------------- */

export async function upsertItem(i: {
  sku: string; category: string; title: string; subtitle?: string | null;
  taxCode?: string; active?: boolean; sortOrder?: number;
  attributes?: Record<string, unknown>; inputSchema?: Record<string, unknown>;
}): Promise<void> {
  await run(
    `INSERT INTO catalog_items
       (sku, category, title, subtitle, tax_code, active, sort_order, attributes, input_schema)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT (sku) DO UPDATE SET
       category = EXCLUDED.category, title = EXCLUDED.title,
       subtitle = EXCLUDED.subtitle, tax_code = EXCLUDED.tax_code,
       active = EXCLUDED.active, sort_order = EXCLUDED.sort_order,
       attributes = EXCLUDED.attributes, input_schema = EXCLUDED.input_schema,
       updated_at = now()`,
    [
      i.sku, i.category, i.title, i.subtitle ?? null, i.taxCode ?? "GST",
      i.active ?? false, i.sortOrder ?? 0,
      JSON.stringify(i.attributes ?? {}), JSON.stringify(i.inputSchema ?? {}),
    ],
  );
}

/**
 * Set a price in one currency.
 *
 * `isDefault` is guarded by a unique partial index, so making a second currency
 * the default has to clear the first in the same transaction rather than
 * failing halfway and leaving a SKU with no default at all.
 */
export async function setPrice(
  sku: string,
  currency: string,
  sellAmount: number,
  isDefault = false,
): Promise<void> {
  await tx(async (t) => {
    if (isDefault) {
      await t.run(
        `UPDATE catalog_prices SET is_default = false WHERE sku = ? AND currency <> ?`,
        [sku, currency],
      );
    }
    await t.run(
      `INSERT INTO catalog_prices (sku, currency, sell_amount, is_default)
       VALUES (?,?,?,?)
       ON CONFLICT (sku, currency) DO UPDATE SET
         sell_amount = EXCLUDED.sell_amount, is_default = EXCLUDED.is_default`,
      [sku, currency, sellAmount, isDefault],
    );
  });
}

export async function upsertSource(s: {
  sku: string; fulfillerId: string; externalId: string;
  costAmount?: number; costCurrency?: string; priority?: number; enabled?: boolean;
}): Promise<void> {
  await run(
    `INSERT INTO catalog_sources
       (sku, fulfiller_id, external_id, cost_amount, cost_currency, priority, enabled, checked_at)
     VALUES (?,?,?,?,?,?,?, now())
     ON CONFLICT (sku, fulfiller_id) DO UPDATE SET
       external_id = EXCLUDED.external_id, cost_amount = EXCLUDED.cost_amount,
       cost_currency = EXCLUDED.cost_currency, priority = EXCLUDED.priority,
       enabled = EXCLUDED.enabled, checked_at = now()`,
    [
      s.sku, s.fulfillerId, s.externalId, s.costAmount ?? 0,
      s.costCurrency ?? "USD", s.priority ?? 100, s.enabled ?? true,
    ],
  );
}

export async function setSourceEnabled(
  sku: string,
  fulfillerId: string,
  enabled: boolean,
): Promise<void> {
  await run(
    `UPDATE catalog_sources SET enabled = ? WHERE sku = ? AND fulfiller_id = ?`,
    [enabled, sku, fulfillerId],
  );
}


/**
 * Everything in a category, active or not, with its price and its source.
 *
 * The console's view, and deliberately a different function from listCatalog.
 * That one is the shop and must never return an inactive item; this one exists
 * precisely to show the things that are not for sale, because deciding what to
 * put on sale is the job it supports. Two callers with opposite requirements
 * sharing one query with a boolean flag is how an inactive SKU eventually
 * reaches a customer.
 */
export interface AdminItem extends CatalogItem {
  currency: string | null;
  sellAmount: number | null;
  fulfillerId: string | null;
  externalId: string | null;
  costAmount: number | null;
  costCurrency: string | null;
  sourceEnabled: boolean | null;
}

export async function listCatalogForAdmin(category: string): Promise<AdminItem[]> {
  const rows = await all<
    ItemRow & {
      currency: string | null;
      sell_amount: string | null;
      fulfiller_id: string | null;
      external_id: string | null;
      cost_amount: string | null;
      cost_currency: string | null;
      source_enabled: boolean | null;
    }
  >(
    `SELECT i.*,
            p.currency, p.sell_amount,
            s.fulfiller_id, s.external_id, s.cost_amount, s.cost_currency,
            s.enabled AS source_enabled
       FROM catalog_items i
       LEFT JOIN catalog_prices  p ON p.sku = i.sku AND p.is_default
       LEFT JOIN catalog_sources s ON s.sku = i.sku
      WHERE i.category = ?
      ORDER BY i.sku`,
    [category],
  );
  return rows.map((r) => ({
    ...toItem(r),
    currency: r.currency,
    sellAmount: r.sell_amount === null ? null : Number(r.sell_amount),
    fulfillerId: r.fulfiller_id,
    externalId: r.external_id,
    costAmount: r.cost_amount === null ? null : Number(r.cost_amount),
    costCurrency: r.cost_currency,
    sourceEnabled: r.source_enabled,
  }));
}

/**
 * Put a SKU on sale, or take it off.
 *
 * Refuses to activate an item that has no default price or no enabled source.
 * Both failures produce the same visible symptom, a customer clicking buy and
 * getting an error, and both are trivially preventable here. An item with no
 * price would render as a blank, and an item with no source would take the
 * money and have nowhere to send the order.
 */
export async function setItemActive(sku: string, active: boolean): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (active) {
    const price = await one<{ sell_amount: string }>(
      `SELECT sell_amount FROM catalog_prices WHERE sku = ? AND is_default`,
      [sku],
    );
    if (!price) return { ok: false, reason: "It has no default price yet." };

    const source = await pickSource(sku);
    if (!source) return { ok: false, reason: "No enabled supplier can fulfil it." };
  }

  const n = await run(
    `UPDATE catalog_items SET active = ?, updated_at = now() WHERE sku = ?`,
    [active, sku],
  );
  return n > 0 ? { ok: true } : { ok: false, reason: "No such SKU." };
}

/* ------------------------------------------------------------------------ *
 * Idempotency
 * ------------------------------------------------------------------------ */

/**
 * Claim a key, or discover somebody already has.
 *
 * A conditional insert, never a read then a write. Two requests arriving in the
 * same millisecond both read "no row" and both proceed; `ON CONFLICT DO
 * NOTHING ... RETURNING` lets exactly one of them see a row and is settled by
 * the database rather than by hope.
 *
 * The failure this prevents costs real money: two eSIM profiles provisioned
 * against one payment, and the second cannot be clawed back because it is
 * activated.
 */
export async function claimKey(key: string, scope: string): Promise<boolean> {
  const r = await one<{ key: string }>(
    `INSERT INTO idempotency_keys (key, scope) VALUES (?, ?)
     ON CONFLICT (key) DO NOTHING
     RETURNING key`,
    [key, scope],
  );
  return !!r;
}

export async function settleKey(
  key: string,
  result: Record<string, unknown>,
): Promise<void> {
  await run(
    `UPDATE idempotency_keys
        SET state = 'settled', result = ?, settled_at = now()
      WHERE key = ?`,
    [JSON.stringify(result), key],
  );
}

export async function readKey(
  key: string,
): Promise<{ state: string; result: Record<string, unknown> | null } | null> {
  const r = await one<{ state: string; result: Record<string, unknown> | null }>(
    `SELECT state, result FROM idempotency_keys WHERE key = ?`,
    [key],
  );
  return r ?? null;
}

/**
 * Release a claim that never completed.
 *
 * Only for the path where fulfilment threw before anything reached the
 * supplier. A key whose work may have succeeded must stay claimed, because the
 * whole point is that we would rather fail a retry than provision twice.
 */
export async function releaseKey(key: string): Promise<void> {
  await run(`DELETE FROM idempotency_keys WHERE key = ? AND state = 'claimed'`, [key]);
}

/* ------------------------------------------------------------------------ *
 * Entitlements
 * ------------------------------------------------------------------------ */

export interface Entitlement {
  id: string;
  category: string;
  status: EntitlementStatus;
  externalRef: string | null;
  label: string;
  expiresAt: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

type EntRow = {
  id: string; category: string; status: EntitlementStatus;
  external_ref: string | null; label: string;
  expires_at: Date | null; payload: Record<string, unknown>; created_at: Date;
};

function toEnt(r: EntRow): Entitlement {
  return {
    id: r.id, category: r.category, status: r.status,
    externalRef: r.external_ref, label: r.label,
    expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
    payload: r.payload ?? {},
    createdAt: r.created_at.toISOString(),
  };
}

/** Everything this customer owns, newest first, whatever kind of thing it is. */
export async function entitlementsFor(userId: string): Promise<Entitlement[]> {
  const rows = await all<EntRow>(
    `SELECT id, category, status, external_ref, label, expires_at, payload, created_at
       FROM entitlements WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(toEnt);
}

export async function grantEntitlement(e: {
  id: string; userId: string; orderItemId: string | null; category: string;
  status?: EntitlementStatus; externalRef?: string | null; label: string;
  expiresAt?: string | null; payload?: Record<string, unknown>;
}): Promise<void> {
  await run(
    `INSERT INTO entitlements
       (id, user_id, order_item_id, category, status, external_ref, label, expires_at, payload)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      e.id, e.userId, e.orderItemId, e.category, e.status ?? "issued",
      e.externalRef ?? null, e.label, e.expiresAt ?? null,
      JSON.stringify(e.payload ?? {}),
    ],
  );
}
