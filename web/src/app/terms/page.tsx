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
 * Two things this deliberately does NOT do:
 *
 *  1. It does not stay quiet about the two things that bite people at an
 *     airport: that validity runs from first use, and that an eSIM profile has
 *     a lifecycle and can be reclaimed by the network. A gap between what the
 *     code does and what the terms say is the kind of thing the ACCC reads as
 *     misleading conduct.
 *  2. It does not attempt to exclude the Australian Consumer Law guarantees.
 *     You cannot, they apply regardless, and a terms document that pretends
 *     otherwise is itself a breach.
 *
 * The terms describe what the code actually does. Where the code changes, these
 * change with it.
 */
export default function TermsPage() {
  return (
    <div className="prose">
      <section className="hero">
        <h1>Terms of Service</h1>
        <p>
          Effective {LEGAL_ENTITY.effectiveDate}. Using {brand.name} means you
          agree to these.
        </p>
      </section>

      <div className="card">
        <h2>1. What {brand.name} is</h2>
        <p className="sub">
          {brand.name} resells mobile data through eSIM profiles. We are not a
          mobile network. We buy connectivity wholesale and provide it to you.
          The actual network in any country is operated by a third party.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          {LEGAL_ENTITY.descriptor} These terms are governed by the laws of{" "}
          {LEGAL_ENTITY.country}.
        </p>
      </div>

      <div className="card">
        <h2>2. What you are buying</h2>
        <p className="sub">
          A prepaid data allowance on a roaming eSIM profile, for one country or
          region, valid for a fixed period. Not a subscription. Nothing renews on
          its own and there is nothing to cancel.
        </p>
        <p className="sub">Concretely, and without weasel words:</p>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
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
            bill you again and we do not keep charging you at a higher rate.
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
          Your eSIM profile does not last forever. Industry practice is that a
          profile must be activated within a set window after it is issued, and
          is reclaimed by the network after a further period of inactivity. If
          yours lapses before you travel, tell us and we will reissue it at no
          charge.
        </div>
      </div>

      <div className="card">
        <h2>3. Discounts and promotional codes</h2>
        <p className="sub">
          We sometimes issue discount codes. Unless the offer says otherwise:
        </p>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
          <li>One code per order, and codes do not stack.</li>
          <li>
            A code has no cash value, cannot be exchanged for money, and cannot be
            sold or transferred.
          </li>
          <li>
            Codes have an expiry and may have a usage limit, a minimum spend, or
            be restricted to particular destinations or plan sizes. Those limits
            are shown with the code.
          </li>
          <li>
            We may withdraw a code at any time. Withdrawing one does not affect an
            order you have already placed with it.
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
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
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
          If we get this wrong, email us and a human will look at it. We would
          rather reinstate a wrongly flagged account than keep it suspended.
        </p>
      </div>

      <div className="card">
        <h2>5. Your eSIM</h2>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
          <li>
            You need an eSIM-capable, carrier-unlocked phone. We cannot tell in
            advance whether yours qualifies, so check with your carrier first.
          </li>
          <li>
            Your {brand.name} eSIM is a <strong>roaming profile</strong>. You must
            switch data roaming on for it or it will not connect.
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
            phone may need a new profile, and we may charge for that.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>6. Plans and payment</h2>
        <p className="sub">
          Paid plans are prepaid. Prices are shown before you buy and include any
          applicable GST. Data expires at the end of the plan&apos;s validity
          period, whether or not you have used it. That is how wholesale data is
          sold to us and we are not able to change it.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Refunds are covered separately in our{" "}
          <Link href="/refunds">refund policy</Link>, which forms part of these
          terms.
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
        <p className="sub" style={{ margin: 0 }}>
          Subject to section 6, and to the extent permitted by law, our total
          liability to you for any claim is limited to the greater of the amount
          you paid us in the 12 months before the claim, or AUD $100. We are not
          liable for indirect or consequential loss, including missed flights,
          bookings or business, arising from a loss of connectivity. Mobile
          networks fail. Do not make {brand.name} your only plan for anything
          that matters.
        </p>
      </div>

      <div className="card">
        <h2>9. Changes, and contact</h2>
        <p className="sub">
          We may change these terms. If a change is material we will notify you
          in the app before it takes effect. Continuing to use {brand.name} after
          that means you accept the change.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Questions or complaints:{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`}>
            {LEGAL_ENTITY.contactEmail}
          </a>
        </p>
      </div>
    </div>
  );
}
