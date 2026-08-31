import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { HOSTS, roleForHost } from "@/lib/hosts";
import { LEGAL_ENTITY } from "@/lib/legal";
import "./globals.css";

/**
 * Type.
 *
 * Loaded as a stylesheet rather than through next/font, deliberately.
 *
 * next/font is better on the merits: it self hosts the files, hashes them into
 * the build, removes a third party request from the critical path and stops
 * every visitor's address reaching Google. It also fetches from
 * fonts.googleapis.com **at build time**, which means any build environment
 * without egress to Google fails outright rather than degrading. That is a
 * poor trade for a project where the build has to keep working from more than
 * one place.
 *
 * The preconnect hints below recover most of the latency. Worth revisiting once
 * the build environment is settled: switching is deleting this block and
 * restoring the next/font imports, nothing else, because the rest of the CSS
 * reads the variables rather than the family names.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700" +
  "&family=Plus+Jakarta+Sans:wght@400;500;600" +
  "&family=IBM+Plex+Mono:wght@400;500&display=swap";

function FontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONT_HREF} />
    </>
  );
}

export const metadata: Metadata = {
  title: {
    default: `${brand.name} · travel eSIM for Australians`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Set up your travel data at home before you fly, land already connected, and reach a person " +
    "in Australian hours if it goes wrong.",
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

/**
 * Chrome is chosen by hostname, not by route.
 *
 * The apex is the marketing face and the `app.` host is the product, and they
 * want completely different furniture: the landing page brings its own header
 * and footer and must not be wrapped in the product's navigation. Reading the
 * host here rather than splitting the route tree keeps every existing product
 * route exactly where it is, which matters more than elegance on a codebase
 * that is about to be deployed.
 *
 * A preview deployment or localhost resolves to `app`, so previews always show
 * the product chrome. See `roleForHost`.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const mock = usingMockSupplier();
  const role = roleForHost((await headers()).get("host"));

  if (role === "marketing") {
    return (
      <html lang="en">
        <head>
          <FontLinks />
        </head>
        <body style={{ margin: 0, background: "#F7EFE4" }}>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <FontLinks />
      </head>
      <body>
        <div className="shell">
          <header className="nav">
            <Link href="/" className="brand" style={{ color: "var(--text)" }}>
              <span className="dot" />
              {brand.name}
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
