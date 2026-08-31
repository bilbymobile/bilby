import { AiraloSupplier } from "./airalo";
import { EsimAccessSupplier } from "./esimaccess";
import { MockSupplier } from "./mock";
import type { Supplier } from "./types";

export * from "./types";

/**
 * Supplier router.
 *
 * Two lanes, deliberately, because the free tier and the paid catalogue have
 * incompatible requirements and forcing one supplier to serve both is how this
 * business model breaks:
 *
 *   PAID lane  — needs breadth of catalogue and brand trust. Minimum-selling-
 *                price clauses are acceptable here because you are selling at
 *                retail anyway.
 *   FREE lane  — needs ICCID-scoped micro top-ups and no price floor. Catalogue
 *                breadth barely matters; you only ever push small MB packets.
 *
 * Both default to the mock so a fresh clone runs with an empty .env.
 */

let paid: Supplier | null = null;
let free: Supplier | null = null;

function build(id: string | undefined): Supplier {
  switch ((id ?? "mock").toLowerCase()) {
    case "airalo":
      return new AiraloSupplier();
    case "esimaccess":
      return new EsimAccessSupplier();
    case "mock":
      return new MockSupplier();
    default:
      throw new Error(`Unknown supplier "${id}"`);
  }
}

/** Supplier backing the paid, retail catalogue. */
export function paidSupplier(): Supplier {
  if (!paid) paid = build(process.env.PAID_SUPPLIER);
  return paid;
}

/**
 * Supplier backing ad-funded free grants.
 *
 * Hard-fails on a supplier that cannot do micro top-ups rather than silently
 * falling back to whole-bundle provisioning, which would turn a 20 MB reward
 * into a 1 GB purchase — a ~50x cost overrun per grant that would not show up
 * until the invoice.
 */
export function freeSupplier(): Supplier {
  if (!free) {
    const s = build(process.env.FREE_SUPPLIER);
    if (!s.supportsMicroTopUp) {
      throw new Error(
        `FREE_SUPPLIER="${s.id}" cannot do ICCID micro top-ups. ` +
          `Ad-funded grants against it would provision a whole bundle per reward. ` +
          `Use "esimaccess" or "mock".`
      );
    }
    free = s;
  }
  return free;
}

/** Test seam — clears memoised instances between suites. */
export function __resetSuppliers() {
  paid = null;
  free = null;
}
