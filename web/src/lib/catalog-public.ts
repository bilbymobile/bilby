/**
 * What a catalogue item is allowed to tell the public.
 *
 * ## Why this exists
 *
 * `catalog_items.attributes` is a category's own facts, stored as JSON so that
 * adding a field to an eSIM SKU does not mean editing every route that serves
 * one. That flexibility is worth having and it is also exactly how the
 * following ended up on a public endpoint:
 *
 *     GET /api/catalog?country=JP
 *     {"attributes":{"pricing":{"costUsd":0.7,"actualMargin":0.4997,
 *                               "contributionAud":1.97, ...}}}
 *
 * The seed script writes the economics into attributes on purpose, so the
 * console can show the margin a price was actually set to rather than dividing
 * by today's FX rate and reporting a number the price was never set to. That
 * reasoning is sound. The mistake was serving the same object to anybody with a
 * URL, which published the wholesale cost, the target margin and the
 * contribution per sale of every plan on sale.
 *
 * The route already said in a comment that cost must never be exposed, and it
 * was right about `catalog_sources`, which it does not select. It could not
 * know that the same numbers would later be written somewhere it does select.
 * A comment cannot enforce anything; this can.
 *
 * ## Allowlist, not denylist
 *
 * A denylist would need editing every time somebody adds an internal field, and
 * forgetting means a leak. An allowlist needs editing every time somebody adds
 * a customer facing field, and forgetting means a missing label on a page,
 * which is visible in a second and costs nothing.
 *
 * The two failure modes are not comparable, so the direction is not a
 * preference.
 */

/**
 * Attribute keys a customer may see.
 *
 * Everything here is a fact about the product from the buyer's side: what they
 * get, for how long, and what the limits are. Nothing here is a fact about what
 * it cost us or who we bought it from.
 */
const PUBLIC = new Set([
  /** ISO country the plan covers. */
  "country",
  /** Included data in megabytes. */
  "dataMb",
  /** Validity in days. */
  "days",
  /** True when the allowance is per day rather than for the whole period. */
  "daily",
  /** Speed after the fair use threshold, or null for full speed throughout. */
  "fup",
  /**
   * "home" or "local". A real product difference the buyer is entitled to know:
   * a foreign exit IP breaks Australian banking apps.
   */
  "routing",
  /** Whether more data can be added without a new eSIM. */
  "topUpSupported",
]);

/**
 * Strip an attributes object down to what may be published.
 *
 * Unknown keys are dropped rather than passed through. If a new attribute
 * belongs on the shop, add it above and it appears; until then it stays inside
 * the business.
 */
export function publicAttributes(
  attributes: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!attributes || typeof attributes !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(attributes)) {
    if (PUBLIC.has(key)) out[key] = attributes[key];
  }
  return out;
}

/** Exported for the test, so the allowlist itself can be asserted on. */
export const PUBLIC_ATTRIBUTE_KEYS: readonly string[] = [...PUBLIC];
