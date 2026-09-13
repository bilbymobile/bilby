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
 *  3. It does not describe a business larger than this one. An earlier draft
 *     opened with partnering to bring you local networks "across the globe".
 *     Eight destinations are on sale. Reach is the one thing in this category
 *     everybody inflates and it is a representation like any other.
 *
 * ## What changed in this revision, and why
 *
 * Two drafts were reconciled into this one. Where they disagreed:
 *
 *  - **Liability cap.** One capped at the price of the plan in question, the
 *    other at twelve months of spend. Twelve months is kept: it is the more
 *    generous of the two and a cap set at the price of one $3.95 plan is the
 *    kind of clause that reads as a company that has thought hard about not
 *    paying you.
 *  - **Suspension for unlawful use.** One draft suspended people for breaching
 *    the law of the destination country, which makes us a judge of foreign law
 *    we have no way to apply. The narrower version is kept: conduct that would
 *    put our supplier in breach, which is a real consequence we can point at.
 *  - **Profile expiry.** One draft buried it in a bullet list. It stays as its
 *    own notice, because it is the clause most likely to cost somebody a
 *    working phone on a holiday and a bullet is where a reader's eye slides.
 *  - **Governing law.** One draft named Victoria. Nobody has confirmed where
 *    the business is registered, so the page reads `LEGAL_ENTITY.governingLaw`
 *    and says "Australia" until somebody sets the state. See legal.ts.
 *
 * And one thing neither draft had. Both said a material change would be
 * notified "in the app". Most customers buy on the web and may never install
 * the app, so notice in the app alone is not notice. Section 9 now commits to
 * the address they gave at checkout as well.
 *
 * A previous version cross referenced "section 6" for the Australian Consumer
 * Law, which is section 7. A liability clause carved out by reference to the
 * wrong section is a liability clause with no carve out.
 *
 * The terms describe what the code actually does. Where the code changes, these
 * change with it.
 */

/** Shared list styling. Inline because a legal page is not worth a module. */
const list = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.7,
  paddingLeft: 20,
} as const;

export default function TermsPage() {
  return (
    <div className="prose">
      <section className="hero">
        <h1>Terms of Service</h1>
        <p>
          Effective {LEGAL_ENTITY.effective.terms}. Using {brand.name} means you
          agree to these.
        </p>
      </section>

      <div className="card">
        <h2>1. What {brand.name} is</h2>
        <p className="sub">
          {brand.name} resells mobile data through eSIM profiles. We are not a
          mobile network. We buy connectivity wholesale and provide it to you.
          In each destination we sell, the network your phone actually connects
          to is owned and operated by a third party, and which networks those
          are is shown on the plan before you pay for it.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          {LEGAL_ENTITY.descriptor} These terms are governed by the laws of{" "}
          {LEGAL_ENTITY.governingLaw}.
        </p>
      </div>

      <div className="card">
        <h2>2. What you are buying</h2>
        <p className="sub">
          A prepaid data allowance on a roaming eSIM profile, for one country or
          region, valid for a fixed period. It is a single purchase, not a
          subscription. Nothing renews on its own and there is nothing to cancel.
        </p>
        <p className="sub">Concretely, and without weasel words:</p>
        <ul style={list}>
          <li>
            The full price, the data included, the validity period and the
            networks the plan uses are all shown before you pay. There is no
            activation fee and nothing is added at the final screen.
          </li>
          <li>
            Validity runs from <strong>first use</strong>, not from purchase, so
            buying early costs you nothing.
          </li>
          <li>
            When the data is used or the period ends, the plan stops. We do not
            bill you again, we do not keep charging you at a higher rate, and
            there are no excess usage fees.
          </li>
          <li>
            Unused data does not roll over into a new plan and has no cash value.
          </li>
          <li>
            You can top up an existing profile rather than installing a new one,
            subject to what the underlying network allows.
          </li>
        </ul>
        <div className="note">
          <strong>Your eSIM profile does not last forever.</strong> Industry
          practice is that a profile must be activated within a set window after
          it is issued, and is reclaimed by the network after a further period of
          inactivity. The window that applies to your plan is shown when you buy
          it. If yours lapses before you travel, tell us and we will reissue it
          at no charge.
        </div>
      </div>

      <div className="card">
        <h2>3. Discounts and promotional codes</h2>
        <p className="sub">
          We sometimes issue discount codes. Unless the offer says otherwise:
        </p>
        <ul style={list}>
          <li>One code per order, and codes do not stack.</li>
          <li>
            A code has no cash value, cannot be exchanged for money, and cannot
            be sold or transferred.
          </li>
          <li>
            Codes have an expiry and may have a usage limit, a minimum spend, or
            be restricted to particular destinations or plan sizes. Those limits
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
        <p className="sub" style={{ margin: 0 }}>
          We may void a code and cancel the order where it has been obtained or
          used in a way it was plainly not meant for, such as generating accounts
          to reuse a single use code.
        </p>
      </div>

      <div className="card">
        <h2>4. Fair use, and what gets you suspended</h2>
        <p className="sub" style={{ marginBottom: 8 }}>
          We may suspend an account, cancel an order or refuse service where we
          have reasonable grounds to believe someone has:
        </p>
        <ul style={list}>
          <li>Resold {brand.name} data or eSIM profiles</li>
          <li>Created multiple accounts to reuse a single use discount code</li>
          <li>Misrepresented their location to obtain regional pricing</li>
          <li>Used a payment method they are not entitled to use</li>
          <li>
            Used the connection for something that would put our supplier in
            breach of the law of the country the data is used in
          </li>
        </ul>
        <p className="sub" style={{ margin: 0 }}>
          If we get this wrong, email us and a person will look at it. We would
          rather reinstate a wrongly flagged account than keep it suspended.
          Where we suspend or cancel and you have paid for data you have not
          used, section 7 still applies and so does our{" "}
          <Link href="/refunds">refund policy</Link>.
        </p>
      </div>

      <div className="card">
        <h2>5. Your eSIM</h2>
        <ul style={list}>
          <li>
            You need an eSIM-capable, carrier-unlocked phone. We cannot tell in
            advance whether yours qualifies, so check with your carrier first.
          </li>
          <li>
            Your {brand.name} eSIM is a <strong>roaming profile</strong>. You
            must switch data roaming on for it or it will not connect.
          </li>
          <li>
            It is data only. No calls, no SMS, no phone number, and{" "}
            <strong>no emergency calling</strong>. Keep a working SIM or another
            means of contacting emergency services.
          </li>
          <li>
            Coverage, speed and availability depend on the local network operator
            and are outside our control.
          </li>
          <li>
            An eSIM profile can normally be installed once. Reinstalling on a new
            phone may need a new profile. We will tell you what that costs before
            we issue it, and it is never more than the price of the plan.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>6. Plans and payment</h2>
        <p className="sub">
          Paid plans are prepaid. Prices are shown before you buy, in Australian
          dollars, and include any applicable GST. Data expires at the end of the
          plan&apos;s validity period, whether or not you have used it. That is
          how wholesale data is sold to us and we are not able to change it.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Refunds are covered separately in our{" "}
          <Link href="/refunds">refund policy</Link>, which forms part of these
          terms and operates in addition to your rights under section 7, not
          instead of them.
        </p>
      </div>

      <div className="card">
        <h2>7. Australian Consumer Law</h2>
        <p className="sub" style={{ marginBottom: 12 }}>
          Nothing in these terms excludes, restricts or modifies any guarantee,
          right or remedy you have under the Australian Consumer Law that cannot
          lawfully be excluded.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Our services come with guarantees that cannot be excluded. You are
          entitled to a replacement or refund for a major failure, and to
          compensation for any other reasonably foreseeable loss or damage. Where
          a failure is not major, you are entitled to have the problem fixed
          within a reasonable time, and if that does not happen, to a refund.
        </p>
      </div>

      <div className="card">
        <h2>8. Liability</h2>
        <p className="sub">
          Subject to section 7, and to the extent permitted by law, our total
          liability to you for any claim is limited to the greater of the amount
          you paid us in the twelve months before the claim, or AUD $100.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          To the extent permitted by law, we are not liable for indirect or
          consequential loss, including missed flights, bookings or business,
          arising from a loss of connectivity. Mobile networks fail, and coverage
          depends on infrastructure and conditions nobody controls. Do not make{" "}
          {brand.name} your only plan for anything that matters.
        </p>
      </div>

      <div className="card">
        <h2>9. Changes, and contact</h2>
        <p className="sub">
          We may change these terms. If a change is material we will tell you
          before it takes effect, by email to the address you gave at checkout
          and in the app, and the effective date at the top of this page moves
          with it. Continuing to use {brand.name} after that means you accept the
          change. A change never applies retrospectively to a plan you have
          already bought.
        </p>
        <p className="sub" style={{ margin: 0 }}>
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
