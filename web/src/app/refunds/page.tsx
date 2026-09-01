import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { url } from "@/lib/hosts";
import { LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: `When ${brand.name} refunds, and how to ask.`,
  // Canonical on the apex. The same page is reachable on the app
  // subdomain, and without this Google splits the ranking between two
  // identical URLs, one of which is the address the Play listing cites.
  alternates: { canonical: url("marketing", "/refunds") },
};

/**
 * Refund policy.
 *
 * The commercially tempting version of this document says "all sales final,
 * digital goods, no refunds". In Australia that sentence is not merely
 * unenforceable — publishing it is itself conduct the ACCC pursues, because it
 * misrepresents consumer rights that cannot be excluded.
 *
 * So this policy grants a real, specific set of refund cases. That is partly
 * compliance and partly product: the entire brand rests on being straight with
 * people about what they are getting, and a refund policy is where that claim
 * gets tested with money on the line.
 */
export default function RefundsPage() {
  return (
    <div className="prose">
      <section className="hero">
        <h1>Refund Policy</h1>
        <p>
          Effective {LEGAL_ENTITY.effectiveDate}. Part of our{" "}
          <a href="/terms">Terms of Service</a>.
        </p>
      </section>

      <div className="card">
        <h2>The principle</h2>
        <p className="sub" style={{ margin: 0 }}>
          If you paid for data and could not use it through no fault of your own,
          you get your money back. We would rather refund someone occasionally
          than build a business on people who feel cheated.
        </p>
      </div>

      <div className="card">
        <h2>We refund in full</h2>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>
            <strong style={{ color: "var(--text)" }}>The eSIM never installed.</strong>{" "}
            You bought a plan and the profile could not be installed on your
            device, and we could not fix it.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>No usable service.</strong>{" "}
            The eSIM installed but never connected in your destination, and you
            used less than 100 MB.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>Bought and unused.</strong>{" "}
            You bought within the last 30 days, the plan was never activated, and
            no data was used.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>We charged you twice.</strong>{" "}
            Obviously, and we will find these ourselves where we can.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>We described it wrong.</strong>{" "}
            The coverage, speed or allowance materially differed from what we
            told you before you bought.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>We refund in part</h2>
        <p className="sub" style={{ marginBottom: 12 }}>
          Where service worked for some of your trip and then failed for reasons
          on our side, we refund pro-rata for the unusable days.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Where you used a meaningful amount of data and then hit a problem, we
          will usually refund the unused portion. Ask.
        </p>
      </div>

      <div className="card">
        <h2>We generally cannot refund</h2>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>
            Data you used. Once it is consumed, our supplier has billed us for it.
          </li>
          <li>
            Plans that expired unused after activation. Validity periods are
            shown before purchase and we are billed on the same basis.
          </li>
          <li>
            Problems caused by a locked or non-eSIM phone, or by data roaming
            being switched off. We flag both of these before you buy and again
            during install.
          </li>
          <li>
            A change of travel plans. We will usually offer a credit instead,
            ask.
          </li>
        </ul>
        <div className="note">
          &ldquo;Generally&rdquo; is doing real work in that heading. These are
          our default positions, not a denial of your legal rights. If you think
          your situation warrants a refund anyway, say so and a human will read
          it.
        </div>
      </div>

            <div className="card">
        <h2>How to ask</h2>
        <p className="sub">
          Email{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`}>
            {LEGAL_ENTITY.contactEmail}
          </a>{" "}
          with the email address you paid from, roughly when you bought, and what
          went wrong. You do not need to quote this policy at us.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          We aim to respond within 2 business days and to process approved
          refunds within 5. Refunds go back to your original payment method.
        </p>
      </div>

      <div className="card">
        <h2>Your rights under Australian Consumer Law</h2>
        <p className="sub" style={{ marginBottom: 12 }}>
          This policy is in addition to your rights under the Australian
          Consumer Law, not instead of them. Nothing here limits them.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Our services come with guarantees that cannot be excluded under the
          Australian Consumer Law. For a major failure you are entitled to a
          replacement or refund, and to compensation for any other reasonably
          foreseeable loss. For a failure that is not major, you are entitled to
          have it fixed in a reasonable time, and if that does not happen, to a
          refund. If you are not satisfied with how we handle a complaint, you
          can contact the ACCC or your state consumer affairs body.
        </p>
      </div>
    </div>
  );
}
