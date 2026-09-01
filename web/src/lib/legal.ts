import { brand } from "./brand";

/**
 * Data inventory — the single source of truth for every privacy claim.
 *
 * ## Why this file exists
 *
 * Google Play's most common privacy-related enforcement is not "you collected
 * too much". It is **your Data Safety declaration disagreeing with your privacy
 * policy**. That is a removal, not a warning, and it happens because the two
 * are written months apart by different people from different templates.
 *
 * So both are generated from this one file. If you start collecting something
 * new, you change it here, and the policy page and the Data Safety answers move
 * together. If you forget, they are still consistent — just incomplete, which
 * is a far more recoverable failure.
 *
 * ## How to keep it honest
 *
 * Every entry below was written by reading the code, not by guessing:
 *
 *   - `users` table              → session id, country, home country
 *   - `credit_ledger`            → ad transaction ids, grant history
 *   - `esims`                    → ICCID, activation material
 *   - AdMob SDK                  → advertising ID (Google collects, not us)
 *   - CDN geo header             → country only; we never store the IP
 *
 * Notably absent, and it should stay that way until it isn't: no name, no
 * email, no address, no payment data, no precise location, no contacts, no
 * photos. If you add Stripe, `purchases` becomes collected and this file and
 * both documents must be updated in the same commit.
 */

export interface DataItem {
  /** Google Play Data Safety category. */
  playCategory: string;
  /** Google Play Data Safety type within that category. */
  playType: string;
  /** Plain-English name for the privacy policy. */
  label: string;
  /** What it actually is, in the user's words. */
  description: string;
  /** Why we have it. Must be a real reason, not "to improve our services". */
  purpose: string;
  /** Play requires: is it collected (sent off-device)? */
  collected: boolean;
  /** Play requires: is it shared with third parties? */
  shared: boolean;
  /** Play requires: can the user request deletion? */
  deletable: boolean;
  /** Play requires: is providing it optional? */
  optional: boolean;
  /** Who else sees it, if anyone. */
  sharedWith?: string;
  /** How long we keep it. */
  retention: string;
}

export const DATA_INVENTORY: DataItem[] = [
  {
    playCategory: "Personal info",
    playType: "User IDs",
    label: "A random account ID",
    description:
      "A randomly generated identifier stored in a signed cookie on your device. " +
      "It is not derived from anything about you, not your name, email, phone " +
      "number or device. It exists so your data balance survives closing the app.",
    purpose:
      "To keep track of your data balance and your eSIM without making you " +
      "create an account.",
    collected: true,
    shared: false,
    deletable: true,
    optional: false,
    retention: "Until you ask us to delete it, or 24 months after last use.",
  },
  {
    playCategory: "Location",
    playType: "Approximate location",
    label: "Your country",
    description:
      "The two-letter country code our network provider derives from your IP " +
      "address, for example 'AU' or 'TH'. We store the country code only. " +
      "We do not store your IP address, and we never request GPS or precise " +
      "location permission.",
    purpose:
      "Mobile data costs us different amounts in different countries, and ads " +
      "are worth different amounts too. Your country is what lets us work out " +
      "how much data one ad can actually pay for where you are.",
    collected: true,
    shared: false,
    deletable: true,
    optional: false,
    retention: "Until you ask us to delete it, or 24 months after last use.",
  },
  {
    playCategory: "Financial info",
    playType: "Purchase history",
    label: "What you have bought",
    description:
      "Which plan, for which destination, what you paid, any discount code you " +
      "used, and the outcome. Card details are handled by our payment provider " +
      "and never reach our servers.",
    purpose:
      "To give you what you paid for, to support you when something goes wrong, " +
      "and because it is our accounting record and we have to be able to show " +
      "what was sold and for how much.",
    collected: true,
    shared: false,
    deletable: false,
    optional: false,
    retention:
      "Kept as a financial record for 7 years, as Australian tax law requires. " +
      "Detached from your account ID when you request deletion.",
  },
  {
    playCategory: "Device or other IDs",
    playType: "Device or other IDs",
    label: "Your eSIM identifier (ICCID)",
    description:
      "The serial number of any eSIM profile we issue you, plus its activation " +
      "details. This identifies the SIM, not you.",
    purpose:
      "To load data onto the right eSIM, show you your remaining balance, and " +
      "support you if it stops working.",
    collected: true,
    shared: true,
    sharedWith: "Our connectivity supplier, who operates the mobile network",
    deletable: false,
    optional: false,
    retention:
      "For the life of the eSIM plus 12 months, so we can support you and meet " +
      "our supplier's record-keeping obligations.",
  },
];

/** Things we deliberately do NOT collect. Worth stating — silence reads badly. */
export const NOT_COLLECTED = [
  "Your name",
  "An advertising identifier. There is no advertising software development kit " +
    "in this product",
  "Your email address (unless you contact us)",
  "Your phone number",
  "Your postal address",
  "Precise or GPS location",
  "Your contacts, photos, files, messages or call logs",
  "Payment card details. Our payment provider handles those and we never see " +
    "your card number",
  "Anything about what you actually do with the data you use. We do not and " +
    "cannot see the sites you visit or the apps you use",
];

/**
 * The legal entity behind the product.
 *
 * ## What this says, and what it deliberately does not
 *
 * Bilby is the telecommunications division of Nextwave.au. That is the sentence
 * every customer facing surface uses, and it is written here once because three
 * pages were each assembling their own version of it, which is how one of them
 * ended up reading "a Australia business" on the live site.
 *
 * Two contact routes, and they are not the same thing:
 *
 *  - [contactEmail] is the product support channel. A customer with a broken
 *    eSIM writes here, and it is the address the Play listing carries.
 *  - [parentEmail] and [parentSite] identify the business behind the brand.
 *    They sit in the footer beside the entity name so that a person, a supplier
 *    or a regulator who needs the company rather than the product has somewhere
 *    to go that is not the support queue.
 *
 * The business structure and the ABN are not published. That is a deliberate
 * decision and it has limits worth writing down next to the code rather than
 * discovering later:
 *
 *  - **Tax invoices still need the ABN.** Under GST law an invoice without one
 *    lets the payer withhold 47 percent. Whatever issues receipts must carry it
 *    even though no page prints it.
 *  - **The Play Console still needs it.** Google verifies a developer's legal
 *    name and address and shows them on the listing regardless.
 *  - **A `.au` domain still needs it.** Australian presence for a direct `.au`
 *    registration is established by an ABN, so `nextwave.au` depends on it.
 *  - **Australian Consumer Law expects an identifiable supplier.** Dropping the
 *    ABN from the footer is defensible while a legal name and a live contact
 *    route are both present, which is why neither email below is optional.
 *
 * There is no telephone number anywhere in this product, by decision. Support
 * is written channels only. Worth confirming with the telecommunications lawyer
 * that written only complaint handling satisfies the TCP Code once Bilby is a
 * registered carriage service provider, because the obligation attaches at
 * registration rather than at launch.
 */
export const LEGAL_ENTITY = {
  /** The name customers see. */
  tradingName: "Bilby",

  /** The business Bilby is part of, written the way it is written everywhere. */
  company: "Nextwave.au",

  /** How Bilby relates to it. Data rather than prose, so the wording is one edit. */
  unit: "telecommunications division" as const,

  country: "Australia",

  /** Product support. The address a customer with a broken eSIM writes to. */
  contactEmail: brand.support.email,

  /** The business behind the brand, for anyone who needs the company not the product. */
  parentEmail: "ns@nextwave.au",
  parentSite: "nextwave.au",
  parentSiteUrl: "https://nextwave.au",

  /** Effective date shown on the documents. Update when you materially change them. */
  effectiveDate: "16 August 2026",

  /**
   * One sentence identifying the supplier. Used in the footer and at the foot
   * of every legal page, so all three always agree.
   */
  get descriptor(): string {
    return `${this.tradingName} is the ${this.unit} of ${this.company}, ${this.country}.`;
  },

  /** The contact route printed under [descriptor]. */
  get contactLine(): string {
    return `${this.parentEmail} · ${this.parentSite}`;
  },
};

/** Rows for the Play Console Data Safety form, grouped as the form groups them. */
export function dataSafetyRows() {
  return DATA_INVENTORY.map((d) => ({
    category: d.playCategory,
    type: d.playType,
    collected: d.collected ? "Yes" : "No",
    shared: d.shared ? `Yes, ${d.sharedWith}` : "No",
    processedEphemerally: "No",
    required: d.optional ? "Optional" : "Required",
    purposes: d.purpose,
  }));
}
