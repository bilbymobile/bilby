import { AiraloSupplier } from "./airalo";
import { EsimAccessSupplier } from "./esimaccess";
import { MockSupplier } from "./mock";
import type { Supplier } from "./types";

export * from "./types";

/**
 * Supplier router.
 *
 * One lane now. There used to be two, because an ad funded free tier needs
 * ICCID scoped micro top ups and no price floor, while a retail catalogue
 * needs breadth and tolerates a minimum selling price. The free tier is gone,
 * so the second lane went with it.
 *
 * Defaults to the mock so a fresh clone runs with an empty .env.
 *
 * This is the low level vendor client, not the thing orders go through.
 * Fulfilment goes through the Fulfiller contract in platform.ts, and the eSIM
 * fulfiller is what calls into here. Nothing outside src/lib/fulfillers should
 * import this module.
 */

let paid: Supplier | null = null;

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

/** Test seam — clears the memoised instance between suites. */
export function __resetSuppliers() {
  paid = null;
}
