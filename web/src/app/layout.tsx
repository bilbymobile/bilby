import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { HOSTS } from "@/lib/hosts";
import { LEGAL_ENTITY } from "@/lib/legal";
import "./globals.css";

/**
 * Metadata is derived from `brand`, never typed as a literal.
 *
 * The previous version hardcoded the old working name in the title tag, so the
 * live site shipped under a name that appears nowhere else in the product. A
 * title is the one string that is simultaneously the browser tab, the Google
 * result and the link preview in every message anyone sends about you, which
 * makes it the worst possible place for a stale name to survive.
 */
export const metadata: Metadata = {
  title: {
    default: `${brand.name} · free mobile data, anywhere you land`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Install one eSIM. Watch a short ad, get data. Upgrade to full speed only when you actually need it.",
  applicationName: brand.name,
  // The product host, not the apex. Relative canonicals in the app resolve
  // here; the legal pages override with an absolute apex URL of their own,
  // because those are the ones the Play listing and the AdMob crawl point at
  // and all three have to name the same hostname.
  metadataBase: new URL(`https://${HOSTS.app}`),
  openGraph: {
    siteName: brand.name,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: brand.colors.bg,
  width: "device-width",
  initialScale: 1,
  // The install flow hands off to the system eSIM UI; letting the page zoom
  // avoids trapping users who need to read a 20 character activation code.
  maximumScale: 5,
};

/**
 * Is the bundled mock supplier still in use?
 *
 * When it is, no real eSIM profile is issued, and saying so is not optional:
 * a user who pays and receives a simulated profile has been misled. But the
 * notice belongs on the surfaces where someone might actually try to buy
 * something, not stapled to the bottom of the privacy policy where the only
 * effect is to tell a Play reviewer that the app does not work.
 */
function usingMockSupplier(): boolean {
  return (process.env.PAID_SUPPLIER ?? "mock").toLowerCase() === "mock";
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mock = usingMockSupplier();

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="nav">
            <Link href="/" className="brand" style={{ color: "var(--text)" }}>
              <span className="dot" />
              {brand.name} <small>free data</small>
            </Link>
            <nav className="links">
              <Link href="/">Earn</Link>
              <Link href="/plans">Plans</Link>
              <Link href="/esims">My eSIMs</Link>
            </nav>
          </header>

          {mock ? (
            <div
              className="card"
              style={{
                borderColor: "var(--warn)",
                background: "color-mix(in srgb, var(--warn) 8%, transparent)",
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 13.5,
              }}
            >
              <strong style={{ color: "var(--warn)" }}>Preview.</strong>{" "}
              Supplier onboarding is still in progress, so eSIM profiles issued
              here are simulated and no payment is taken.
            </div>
          ) : null}

          {children}

          <footer className="foot">
            {/* Play requires a reachable privacy policy link, and reviewers do
                check that it resolves. Putting it in the shared footer means it
                is present on every page, including the one a reviewer lands on. */}
            <div className="row" style={{ gap: 18, marginBottom: 14 }}>
              <Link href="/privacy" style={{ color: "var(--muted)" }}>Privacy</Link>
              <Link href="/terms" style={{ color: "var(--muted)" }}>Terms</Link>
              <Link href="/refunds" style={{ color: "var(--muted)" }}>Refunds</Link>
              <a href={`mailto:${brand.support.email}`} style={{ color: "var(--muted)" }}>
                Contact
              </a>
            </div>
            {LEGAL_ENTITY.descriptor}
          </footer>
        </div>
      </body>
    </html>
  );
}
