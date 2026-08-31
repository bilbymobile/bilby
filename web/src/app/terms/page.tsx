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
 *  1. It does not promise unlimited or guaranteed free data. The free tier is
 *     funded by ad revenue and capped by a daily budget; promising otherwise in
 *     the terms while the code enforces a cap is the kind of gap the ACCC reads
 *     as misleading conduct.
 *  2. It does not attempt to exclude the Australian Consumer Law guarantees.
 *     You cannot, they apply regardless, and a terms document that pretends
 *     otherwise is itself a breach.
 *
 * The terms describe what the code actually does. Where the code changes, these
 * change with it.
 */
export default function TermsPage() {
  return (
    <>
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
        <h2>2. The free tier, stated precisely</h2>
        <p className="sub">
          You can earn mobile data by watching rewarded video ads. How much data
          each ad is worth <strong>varies by country</strong>, because what an ad
          earns and what data costs both vary by country. The app shows you the
          current rate before you watch anything.
        </p>
        <p className="sub">Concretely, and without weasel words:</p>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
          <li>There is a daily limit on how many ads you can be credited for.</li>
          <li>
            There is a daily ceiling on how much free data we hand out across all
            users. When it is reached, earning pauses until the next day. The app
            will tell you when that happens.
          </li>
          <li>
            In some countries we do not offer a free tier at all, because an ad
            there earns less than a usable amount of data costs. The app says so
            plainly rather than offering you a token amount.
          </li>
          <li>
            Credits are not money, have no cash value, cannot be transferred or
            sold, and expire 12 months after they are earned.
          </li>
          <li>
            We may change the earning rate. We will not retroactively reduce
            credits you have already earned.
          </li>
        </ul>
        <div className="note">
          We do not promise unlimited free data and we have not designed the
          product to imply it. The free tier is funded by advertising, and it is
          bounded by what advertising actually pays.
        </div>
      </div>

      <div className="card">
        <h2>3. Fair use, and what gets you banned</h2>
        <p className="sub">
          Credits are granted only when Google&apos;s servers confirm you watched
          an ad. Attempting to manufacture that confirmation is fraud against an
          advertiser, not just against us.
        </p>
        <p className="sub" style={{ marginBottom: 8 }}>
          We may suspend an account and reverse credits where we have reasonable
          grounds to believe someone has:
        </p>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
          <li>Used emulators, automation or modified apps to generate ad views</li>
          <li>Created multiple accounts to get around the daily limit</li>
          <li>Misrepresented their location to obtain a higher earning rate</li>
          <li>Resold {brand.name} data or eSIM profiles</li>
        </ul>
        <p className="sub" style={{ margin: 0 }}>
          If we get this wrong, email us and a human will look at it. We would
          rather reinstate a wrongly-flagged account than keep it banned.
        </p>
      </div>

      <div className="card">
        <h2>4. Your eSIM</h2>
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
        <h2>5. Paid plans</h2>
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
        <h2>6. Australian Consumer Law</h2>
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
        <h2>7. Liability</h2>
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
        <h2>8. Changes, and contact</h2>
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
    </>
  );
}
