import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { url } from "@/lib/hosts";
import { LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The agreement between you and ${brand.name}.`,
  // Canonical on the apex. The same page is reachable on the app
  // subdomain, and without this Google splits the ranking between two
  // identical URLs, one of which is the address the Play listing cites.
  alternates: { canonical: url("marketing", "/terms") },
};

/**
 * Terms of service.
 *
 * ## What this deliberately does not do
 *
 *  1. It does not stay quiet about the two things that bite people at an
 *     airport: that validity runs from first use, and that an eSIM profile has
 *     a lifecycle and can be reclaimed by the network. A gap between what the
 *     code does and what the terms say is the kind of thing the ACCC reads as
 *     misleading conduct.
 *  2. It does not attempt to exclude the Australian Consumer Law guarantees.
 *     You cannot, they apply regardless, and a terms document that pretends
 *     otherwise is itself a breach.
 *  3. It does not describe a business larger than this one, and it no longer
 *     describes one smaller either. Both are representations.
 *
 * ## What changed in this revision, and why
 *
 * Three things, all of them narrowing what the document commits us to.
 *
 *  - **The supply chain came out.** Earlier drafts explained that we buy
 *    connectivity wholesale and resell it, and section 6 justified expiry by
 *    saying that is how wholesale data is sold to us. Neither sentence is owed
 *    to a customer, both invite the follow up question of what we pay, and the
 *    second hands a competitor our cost structure in order to excuse a rule we
 *    could simply state. The page now says what the customer gets and who runs
 *    the network, and stops there.
 *
 *  - **The money promises came out.** Three of them, each cheap to write and
 *    open ended to keep:
 *
 *      * a lapsed profile "reissued at no charge", which is a free replacement
 *        promised in advance for a failure whose cause and frequency nobody
 *        here has measured yet;
 *      * a reinstall fee that "is never more than the price of the plan",
 *        which caps a cost we do not set;
 *      * a liability floor of AUD $100, which is a commitment to pay at least
 *        that on any claim, including one worth five dollars.
 *
 *    All three are replaced by the same discipline: say what we will do, say
 *    that the cost is told to you before it is charged, and promise no number.
 *    Section 7 is untouched, so nothing here reduces what the law already
 *    guarantees, and the cap in section 8 still yields to it entirely.
 *
 *  - **Suspension stopped citing the supplier.** The old bullet suspended
 *    people for conduct that would put "our supplier" in breach. Same effect,
 *    but it named a relationship the page has no reason to describe. It now
 *    points at the law where the data is used and the rules of the network
 *    carrying it, which is what a customer can actually check.
 *
 * Two earlier decisions survive this revision unchanged, because both were
 * right for reasons that have not changed. Notice of a material change reaches
 * the email given at checkout and not only the app, since most customers buy on
 * the web and may never install it. And the governing law is read from
 * `LEGAL_ENTITY.governingLaw` rather than typed here, so it says "Australia"
 * until somebody sets the state. See legal.ts.
 *
 * A previous version cross referenced "section 6" for the Australian Consumer
 * Law, which is section 7. A liability clause carved out by reference to the
 * wrong section is a liability clause with no carve out. legal.test.ts counts
 * the sections now so that it cannot happen twice.
 *
 * The terms describe what the code actually does. Where the code changes, these
 * change with it.
 */

export default function TermsPage() {
  return (
    <div className="prose">
      <section className="hero">
        <p className="kicker">Legal</p>
        <h1>
          Terms of
          <span className="fig">service</span>
        </h1>
        <p>
          Effective {LEGAL_ENTITY.effective.terms}. Using {brand.name} means you
          agree to these.
        </p>
      </section>

      <div className="card">
        <h2>1. What {brand.name} is</h2>
        <p>
          {brand.name} provides mobile data through eSIM profiles. We are not a
          mobile network. In every destination we sell, the network your phone
          connects to is owned and run by a third party, and the networks a plan
          uses are shown before you pay for it.
        </p>
        <p>
          {LEGAL_ENTITY.descriptor} These terms are governed by the laws of{" "}
          {LEGAL_ENTITY.governingLaw}.
        </p>
      </div>

      <div className="card">
        <h2>2. What you are buying</h2>
        <p>
          A prepaid data allowance on a roaming eSIM profile, valid for one
          country or region and for a fixed period. It is a single purchase, not
          a subscription. Nothing renews on its own and there is nothing to
          cancel.
        </p>
        <p>Specifically:</p>
        <ul>
          <li>
            The price, the data included, the validity period and the networks
            the plan uses are all shown before you pay. The price you see at
            checkout is the price you are charged, and nothing is added at the
            final screen.
          </li>
          <li>
            Validity runs from <strong>first use</strong>, not from purchase, so
            buying ahead of a trip costs you nothing.
          </li>
          <li>
            When the data is used or the period ends, the plan stops. We do not
            bill you again and we do not move you onto a higher rate.
          </li>
          <li>
            Unused data does not roll over into a new plan and has no cash value.
          </li>
          <li>
            You can top up an existing profile instead of installing a new one,
            where the network allows it.
          </li>
        </ul>
        <div className="note">
          <strong>Your eSIM profile does not last indefinitely.</strong> As is
          standard across the industry, a profile has to be activated within a
          set window after it is issued, and is reclaimed by the network after a
          long period without use. The window that applies to your plan is shown
          when you buy it. If yours lapses before you travel, contact us. We
          will tell you what can be done and what it costs, if anything, before
          we do it.
        </div>
      </div>

      <div className="card">
        <h2>3. Discounts and promotional codes</h2>
        <p>
          We sometimes issue discount codes. Unless the offer says otherwise:
        </p>
        <ul>
          <li>One code per order, and codes do not stack.</li>
          <li>
            A code has no cash value, cannot be exchanged for money, and cannot
            be sold or transferred.
          </li>
          <li>
            Codes have an expiry and may carry a usage limit, a minimum spend, or
            a restriction to particular destinations or plan sizes. Those limits
            are shown with the code.
          </li>
          <li>
            We may withdraw a code at any time. Withdrawing one does not affect
            an order you have already placed with it.
          </li>
          <li>
            If a refund is due on a discounted order, we refund what you actually
            paid, not the undiscounted price.
          </li>
        </ul>
        <p>
          We may void a code and cancel the order where it has plainly been
          obtained or used in a way it was not meant for, such as creating
          accounts to reuse a code issued for one order.
        </p>
      </div>

      <div className="card">
        <h2>4. Fair use, and when we may suspend or refuse service</h2>
        <p>
          We may suspend an account, cancel an order or refuse service where we
          have reasonable grounds to believe someone has:
        </p>
        <ul>
          <li>Resold {brand.name} data or eSIM profiles</li>
          <li>Created several accounts to reuse a code issued for one order</li>
          <li>Misrepresented their location to obtain regional pricing</li>
          <li>Used a payment method they are not entitled to use</li>
          <li>
            Used the connection in a way that breaks the law where the data is
            used, or the rules of the network carrying it
          </li>
        </ul>
        <p>
          If you believe we have this wrong, email us and a person will review
          it. We would rather reinstate an account we flagged in error than
          leave it suspended. Where we suspend or cancel and you have paid for
          data you have not used, section 7 still applies and so does our{" "}
          <Link href="/refunds">refund policy</Link>.
        </p>
      </div>

      <div className="card">
        <h2>5. Your eSIM</h2>
        <ul>
          <li>
            You need a phone that supports eSIM and is not locked to a carrier.
            We cannot confirm that in advance, so check with your carrier first.
          </li>
          <li>
            Your {brand.name} eSIM is a <strong>roaming profile</strong>. Data
            roaming has to be switched on or it will not connect.
          </li>
          <li>
            It is data only. No calls, no SMS, no phone number, and{" "}
            <strong>no emergency calling</strong>. Keep a working SIM or another
            way to reach emergency services.
          </li>
          <li>
            Coverage, speed and availability depend on the local network operator
            and are outside our control.
          </li>
          <li>
            A profile can normally be installed once. Moving to a new phone may
            need a new profile, and a fee may apply. We will tell you the cost
            before we issue it.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>6. Plans and payment</h2>
        <p>
          Plans are prepaid. Prices are shown before you buy, in Australian
          dollars, and include any applicable GST. Data expires at the end of the
          plan&apos;s validity period, whether or not you have used it.
        </p>
        <p>
          Refunds are covered separately in our{" "}
          <Link href="/refunds">refund policy</Link>, which forms part of these
          terms and operates in addition to your rights under section 7, not
          instead of them.
        </p>
      </div>

      <div className="card">
        <h2>7. Australian Consumer Law</h2>
        <p>
          Nothing in these terms excludes, restricts or modifies any guarantee,
          right or remedy you have under the Australian Consumer Law that cannot
          lawfully be excluded.
        </p>
        <p>
          Our services come with guarantees that cannot be excluded. You are
          entitled to a replacement or refund for a major failure, and to
          compensation for any other reasonably foreseeable loss or damage. Where
          a failure is not major, you are entitled to have the problem fixed
          within a reasonable time, and if that does not happen, to a refund.
        </p>
      </div>

      <div className="card">
        <h2>8. Liability</h2>
        <p>
          Subject to section 7, and to the extent permitted by law, our total
          liability to you for any claim is limited to the amount you paid us in
          the twelve months before the claim.
        </p>
        <p>
          To the extent permitted by law, we are not liable for indirect or
          consequential loss, including missed flights, bookings or business,
          arising from a loss of connectivity. Mobile networks fail, and coverage
          depends on infrastructure and conditions nobody controls. Please do not
          rely on {brand.name} as your only means of staying connected for
          anything that matters.
        </p>
      </div>

      <div className="card">
        <h2>9. Changes, and contact</h2>
        <p>
          We may change these terms. If a change is material we will tell you
          before it takes effect, by email to the address you gave at checkout
          and in the app, and the effective date at the top of this page moves
          with it. Continuing to use {brand.name} after that means you accept the
          change. A change never applies retrospectively to a plan you have
          already bought.
        </p>
        <p>
          Questions or complaints:{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`}>
            {LEGAL_ENTITY.contactEmail}
          </a>
          . Tell us what went wrong and what you would like done about it, and a
          person will answer you. If we cannot put it right, we will say so
          plainly rather than leave you waiting.
        </p>
      </div>
    </div>
  );
}
