import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { MotionGate } from "./home/motion-gate";
import { Mark } from "./home/mark";
import { MarketingShell } from "./home/shell";
import { HOSTS, roleForHost } from "@/lib/hosts";
import { LEGAL_ENTITY } from "@/lib/legal";
import { checkoutOpen } from "@/lib/stripe";
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
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700" +
  "&family=Bebas+Neue" +
  "&family=Instrument+Serif:ital@0;1" +
  "&family=JetBrains+Mono:wght@400;500&display=swap";

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
  // because those are the ones the Play listing points at and both have to
  // name the same hostname.
  metadataBase: new URL(`https://${HOSTS.app}`),
  openGraph: {
    siteName: brand.name,
    type: "website",
  },
  manifest: "/site.webmanifest",
  /*
   * Declared explicitly rather than relying on Next's app/icon file
   * convention, because the same files have to serve four different consumers
   * with four different rules: browsers want a small favicon, iOS ignores
   * transparency and applies its own corner mask, Android launchers crop a
   * maskable icon to whatever shape the launcher feels like, and the Play
   * listing takes a flat 512. One convention file cannot satisfy all four.
   */
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  /*
   * The page ground itself, so the phone's browser chrome and the notch area
   * disappear into the page rather than drawing a bar in a colour that appears
   * nowhere else on the site. Same hex as --bg in globals.css and as `void` in
   * the app's palette, because the three surfaces are one brand.
   */
  themeColor: "#04060F",
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
 * What the banner should actually say.
 *
 * It used to say one thing: that the supplier was simulated and that nothing
 * here could charge a card. The second half stopped being true the moment a
 * Stripe key was set, and a preview notice that contains a false statement is
 * worse than no preview notice, because it is the sentence a customer will
 * quote back at you.
 *
 * So the two facts are read separately and the sentence is assembled from
 * whichever of them is true right now.
 */
function previewNotice(): { head: string; body: string } | null {
  const mock = usingMockSupplier();
  const open = checkoutOpen();

  if (mock && !open) {
    return {
      head: "Preview.",
      body:
        "Plans and prices here are real. Card payments are not switched on yet, " +
        "and the supplier account is not funded, so nothing can be bought and " +
        "no eSIM issued here would be a real one.",
    };
  }
  if (mock && open) {
    return {
      head: "Do not buy.",
      body:
        "Payments are switched on but the supplier account is not funded, so a " +
        "payment would take money and deliver a simulated profile. Switch " +
        "CHECKOUT_OPEN off or point PAID_SUPPLIER at the real supplier.",
    };
  }
  if (!open) {
    return {
      head: "Opening soon.",
      body:
        "Plans and prices here are real and so is the stock. Card payments are " +
        "not switched on yet, so nothing can be bought today.",
    };
  }
  return null;
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
  const notice = previewNotice();
  const role = roleForHost((await headers()).get("host"));

  if (role === "admin") {
    // Bare document. The console layout supplies its own chrome, and it must
    // not inherit the product navigation any more than the landing page does.
    return (
      <html lang="en">
        <head>
          <FontLinks />
          <MotionGate />
        </head>
        <body data-surface="console" style={{ margin: 0 }}>{children}</body>
      </html>
    );
  }

  if (role === "marketing") {
    return (
      <html lang="en">
        <head>
          <FontLinks />
          <MotionGate />
        </head>
        <body data-surface="marketing" style={{ margin: 0 }}>
          <MarketingShell>{children}</MarketingShell>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <FontLinks />
        {/* Decides whether a page is allowed to hide anything behind an
            entrance animation. See motion-gate.tsx: without it, nothing hides.
            On every branch, because the landing page renders under the product
            role on preview deployments and on localhost, which is exactly where
            a blank hero gets reviewed and believed. */}
        <MotionGate />
      </head>
      <body>
        <div className="shell">
          <header className="nav">
            {/* The same drawing as the landing page header and the app icon.
                It was a coloured dot, which is a different brand on the one
                journey a customer actually makes: apex, then "Open the app". */}
            <Link href="/" className="brand" style={{ color: "var(--text)" }}>
              <Mark size={26} fill="var(--accent)" eye="var(--ok)" />
              {brand.name}
            </Link>
            <nav className="links">
              <Link href="/plans">Plans</Link>
              <Link href="/esims">My eSIMs</Link>
            </nav>
          </header>

          {notice ? (
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
              <strong style={{ color: "var(--warn)" }}>{notice.head}</strong>{" "}
              {notice.body}
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
