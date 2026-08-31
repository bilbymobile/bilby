import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { url } from "@/lib/hosts";
import { DATA_INVENTORY, NOT_COLLECTED, LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What ${brand.name} collects, why, and what you can do about it.`,
  // Canonical on the apex. The same page is reachable on the app
  // subdomain, and without this Google splits the ranking between two
  // identical URLs, one of which is the address the Play listing cites.
  alternates: { canonical: url("marketing", "/privacy") },
};

/**
 * Privacy policy.
 *
 * Rendered from `lib/legal.ts` so it can never drift from the Data Safety
 * declaration — that mismatch is the most common cause of privacy-related
 * removals from Google Play.
 *
 * Written to be read, not to be skimmed past. That is a product decision, not
 * an aesthetic one: this whole business asks people to trust that "free" means
 * free, and a policy written in impenetrable legalese undercuts that on the one
 * page where they came looking for reassurance.
 */
export default function PrivacyPage() {
  return (
    <>
      <section className="hero">
        <h1>Privacy Policy</h1>
        <p>
          Effective {LEGAL_ENTITY.effectiveDate}. This covers the {brand.name}{" "}
          app and {brand.domain}.
        </p>
      </section>

      <div className="card">
        <h2>The short version</h2>
        <p className="sub" style={{ marginBottom: 12 }}>
          You do not need an account to use {brand.name}. We do not know your
          name or your email address. We hold a random ID, your country, and a
          record of the ads you have watched and the data you have claimed.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Google collects your advertising ID to serve the ads, because that is
          how the free data gets paid for. Everything else below is detail.
        </p>
      </div>

      <div className="card">
        <h2>What we collect and why</h2>
        <p className="sub">
          This is the complete list. If something is not here, we do not have it.
        </p>

        {DATA_INVENTORY.map((d) => (
          <div
            key={d.label}
            style={{
              paddingBottom: 18,
              marginBottom: 18,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 style={{ fontSize: 15, margin: "0 0 8px", color: "var(--text)" }}>
              {d.label}
            </h3>
            <p className="sub" style={{ marginBottom: 8 }}>{d.description}</p>
            <p className="sub" style={{ marginBottom: 8 }}>
              <strong style={{ color: "var(--text)" }}>Why: </strong>
              {d.purpose}
            </p>
            <p className="sub" style={{ margin: 0, fontSize: 13 }}>
              <strong style={{ color: "var(--text)" }}>Shared with: </strong>
              {d.shared ? d.sharedWith : "Nobody"}
              {" · "}
              <strong style={{ color: "var(--text)" }}>Kept: </strong>
              {d.retention}
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>What we do not collect</h2>
        <p className="sub">
          Worth stating explicitly, because a privacy policy that only lists what
          it takes tells you nothing about what it leaves alone.
        </p>
        <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
          {NOT_COLLECTED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Ads</h2>
        <p className="sub">
          {brand.name}&apos;s free data is paid for by rewarded video ads served
          by Google AdMob. When you watch one, Google collects your advertising
          ID and standard ad-request information, then tells our servers that a
          view completed so we can credit you.
        </p>
        <p className="sub">
          Google&apos;s handling of that data is governed by their policies, not
          ours. See{" "}
          <a href="https://policies.google.com/technologies/partner-sites">
            how Google uses information from partner sites and apps
          </a>
          .
        </p>
        <p className="sub" style={{ margin: 0 }}>
          You can reset or delete your advertising ID at any time in{" "}
          <strong>Android Settings → Privacy → Ads</strong>. Doing so does not
          stop you using {brand.name}, though it may reduce how much each ad is
          worth, and since that is what funds your free data it may reduce how
          much data you earn per ad.
        </p>
      </div>

      <div className="card">
        <h2>Your rights</h2>
        <p className="sub">
          Under the Australian Privacy Act, and if you are in Europe the
          GDPR, you can ask us to show you what we hold, correct it, or delete
          it. Email{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`}>
            {LEGAL_ENTITY.contactEmail}
          </a>{" "}
          and we will respond within 30 days.
        </p>
        <div className="note">
          One honest limitation: because there is no account, we identify you by
          the random ID in your app. If you delete the app without asking us
          first, we have no way to connect a later request to your old data, so
          ask before you uninstall.
        </div>
        <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
          We keep your earning history for seven years even after a deletion
          request, because Australian tax law requires us to retain financial
          records. It is detached from your ID at that point, so it is no longer
          about you. It is a row in an accounting ledger.
        </p>
      </div>

      <div className="card">
        <h2>Where your data lives</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          On servers operated by our hosting provider, and with our connectivity
          supplier for the parts they need to run your eSIM. Some of those
          servers are outside Australia. We do not sell your data to anyone, and
          there is no version of this business where we would. The product is
          funded by ads and data plans, not by you being the product.
        </p>
      </div>

      <div className="card">
        <h2>Changes and contact</h2>
        <p className="sub">
          If we change this materially we will say so in the app before the
          change takes effect, not quietly update the date at the top.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          {LEGAL_ENTITY.descriptor}{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`}>
            {LEGAL_ENTITY.contactEmail}
          </a>
        </p>
      </div>
    </>
  );
}
