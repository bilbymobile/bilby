/**
 * What a sale actually earns.
 *
 * This replaces `RETAIL_TARGET_MARGIN`, a single constant that treated the gap
 * between wholesale and retail as if it were profit. It is not. Between the two
 * sit five things, and together they are large enough to turn a plan that looks
 * like fifty percent gross into something close to thirty.
 *
 * Every default below is a figure that was checked rather than assumed, and the
 * ones that are still guesses are marked as such. If you change one, change it
 * here: the whole point is that there is one place to argue with.
 *
 * ## The five
 *
 * 1. **FX.** Suppliers invoice in USD and customers pay in AUD. The rate on the
 *    day is a fact about the order, so it is passed in rather than defaulted,
 *    and a buffer covers the drift between quoting a price and paying the bill.
 *
 * 2. **GST.** One eleventh of a tax inclusive Australian sale. This is larger
 *    than the payment fee and the FX spread combined and it is the single most
 *    commonly forgotten line in a pricing model.
 *
 * 3. **Payment fees.** Stripe Australia is 1.7% plus A$0.30 on domestic cards
 *    from 1 October 2026 and 3.5% plus A$0.30 on international ones. A travel
 *    product sells to people about to leave the country, but they are paying on
 *    Australian cards, so the international share is modest rather than zero.
 *
 * 4. **Disputes.** A$25 each, and you lose the wholesale cost as well because
 *    an activated profile cannot be returned. Instantly delivered digital goods
 *    sold to people who then become uncontactable in another timezone is a
 *    textbook high dispute category.
 *
 * 5. **Refunds.** Australian Consumer Law gives a statutory remedy when the
 *    service did not work, whatever the refund policy page says, and the
 *    supplier will not credit an activated profile. So it is a budget line, not
 *    a surprise.
 */

/** Australian GST on a tax inclusive price is one eleventh of it. */
export const GST_DIVISOR = 11;

export interface Assumptions {
  /** AUD per one unit of the cost currency. A fact about the day, not a default. */
  fxRate: number;
  /** Headroom for drift between quoting and settling. */
  fxBuffer: number;

  /** Stripe Australia, domestic cards, from 1 Oct 2026. */
  stripePct: number;
  stripeIntlPct: number;
  stripeFixed: number;
  /** Fraction of orders paid on a card issued outside Australia. A GUESS. */
  intlCardShare: number;

  /** Disputes as a fraction of orders. A GUESS until there is real data. */
  disputeRate: number;
  /** Stripe charges this per dispute received, won or lost. */
  disputeFee: number;

  /** Refunds as a fraction of orders. A GUESS. */
  refundRate: number;

  /** Whether the sale carries GST. False for a GST free export. */
  gst: boolean;
}

export const DEFAULTS: Omit<Assumptions, "fxRate"> = {
  fxBuffer: 0.03,
  stripePct: 0.017,
  stripeIntlPct: 0.035,
  stripeFixed: 0.30,
  intlCardShare: 0.10,
  disputeRate: 0.004,
  disputeFee: 25,
  refundRate: 0.03,
  gst: true,
};

export interface Breakdown {
  /** What the customer pays, GST inclusive, in AUD. */
  retail: number;
  gst: number;
  /** Retail less GST. The only part that was ever yours. */
  net: number;
  /** Supplier cost converted at the buffered rate. */
  landedCost: number;
  /** Blended Stripe fee across domestic and international cards. */
  payment: number;
  /** Expected dispute cost per order: the fee plus the lost wholesale. */
  disputes: number;
  /** Expected refund cost per order: the revenue back, and the wholesale gone. */
  refunds: number;
  /** What is left. */
  contribution: number;
  /** Contribution over retail. The number that actually matters. */
  margin: number;
}

/** What a given retail price really earns, per order, on average. */
export function breakdown(
  retail: number,
  wholesale: number,
  a: Assumptions,
): Breakdown {
  const gst = a.gst ? retail / GST_DIVISOR : 0;
  const net = retail - gst;

  const landedCost = wholesale * a.fxRate * (1 + a.fxBuffer);

  const blendedPct =
    a.stripePct * (1 - a.intlCardShare) + a.stripeIntlPct * a.intlCardShare;
  const payment = retail * blendedPct + a.stripeFixed;

  // A dispute costs the fee AND the wholesale, because the profile is gone.
  const disputes = a.disputeRate * (a.disputeFee + landedCost);
  // A refund returns the net revenue and does not return the wholesale.
  const refunds = a.refundRate * (net + landedCost);

  const contribution = net - landedCost - payment - disputes - refunds;

  return {
    retail: round(retail), gst: round(gst), net: round(net),
    landedCost: round(landedCost), payment: round(payment),
    disputes: round(disputes), refunds: round(refunds),
    contribution: round(contribution),
    margin: retail > 0 ? round2(contribution / retail) : 0,
  };
}

/**
 * The price that hits a target contribution margin.
 *
 * Solved rather than guessed. Everything except the fixed Stripe charge scales
 * with retail, so the algebra closes; the alternative is a loop that converges
 * on a number nobody can explain.
 *
 *   contribution = retail * K - C
 *   where K collects every proportional term and C every fixed one.
 *   Setting contribution = retail * m and solving gives retail = C / (K - m).
 */
export function priceFor(
  wholesale: number,
  targetMargin: number,
  a: Assumptions,
): { retail: number; breakdown: Breakdown } {
  const g = a.gst ? 1 / GST_DIVISOR : 0;
  const blendedPct =
    a.stripePct * (1 - a.intlCardShare) + a.stripeIntlPct * a.intlCardShare;
  const landedCost = wholesale * a.fxRate * (1 + a.fxBuffer);

  // Proportional: net revenue, less payment percentage, less the refund share
  // of net revenue.
  const K = (1 - g) - blendedPct - a.refundRate * (1 - g);
  // Fixed: the landed cost, the fixed Stripe charge, and the expected dispute
  // and refund losses that do not scale with price.
  const C =
    landedCost +
    a.stripeFixed +
    a.disputeRate * (a.disputeFee + landedCost) +
    a.refundRate * landedCost;

  if (K <= targetMargin) {
    throw new Error(
      `A ${(targetMargin * 100).toFixed(0)}% contribution margin is not reachable: ` +
        `after GST, fees and reserves only ${(K * 100).toFixed(1)}% of each dollar ` +
        `survives. Lower the target or lower the cost.`,
    );
  }

  const retail = C / (K - targetMargin);
  return { retail: round(retail), breakdown: breakdown(round(retail), wholesale, a) };
}

/** Round to the nearest cent. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function round2(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Nudge a computed price to something a person would write on a card.
 *
 * Always upward. Rounding down gives away the margin the calculation just
 * solved for, and it does so invisibly, one plan at a time.
 */
export function pretty(n: number): number {
  const candidate = Math.ceil(n) - 0.05;
  return round(candidate >= n ? candidate : Math.ceil(n) + 0.95);
}
