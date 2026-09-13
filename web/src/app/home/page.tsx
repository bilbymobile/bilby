import type { Metadata } from "next";
import Link from "next/link";

import { liveDestinations, liveShopfront, heroClaim, money } from "@/lib/live-destinations";
import { url } from "@/lib/hosts";
import styles from "./home.module.css";
import { FieldNotes } from "./notes";
import { HeroArt } from "./hero-art";
import { HeroParallax, Motes, Reveal } from "./motion";

/**
 * The marketing landing page, served on the apex.
 *
 * ## Every number on this page is derived, not typed
 *
 * The design this came from carried "190+ countries" and "200+ carriers". Both
 * were invented, and both are representations about a future matter under
 * Australian Consumer Law: until a wholesale contract exists, the burden of
 * showing reasonable grounds for them sits with us.
 *
 * The first fix took the count from `DESTINATIONS`, the curated list of places
 * we can quote, price and provision. That was better than a typed number and
 * still wrong, because it said thirteen on a day when one plan was on sale.
 * "Can provision" and "is on sale" are different facts and the sentence makes a
 * claim about the second.
 *
 * So the count comes from the catalogue itself, and so does the price. A
 * destination appears here when a SKU for it is activated and disappears when
 * the last one is switched off, and the headline changes shape rather than
 * saying "1 destinations". Nobody edits this page again.
 *
 * ## The second design this page has worn
 *
 * It was warm cream around a photographic hero. The hero was 262 KB, marked
 * priority, and on a phone browser it was the thing that kept arriving as a
 * broken image glyph while the words waited behind it. The character is vector
 * now (see hero-art.tsx) and the page is the same night palette the Android app
 * and the web app use, so a customer pressing "Open the app" no longer crosses
 * into what looks like a different company.
 *
 * ## What is still not claimed
 *
 * Checkout is not open. That is said plainly on the buttons rather than left
 * for somebody to discover at the payment step, because the whole argument of
 * this product is that the incumbents are not straight about what happens next.
 */

export const metadata: Metadata = {
  title: "Bilby · travel eSIM for Australians",
  description:
    "Set up your travel data at home before you fly, land already connected, and reach a person in Australian hours if it goes wrong.",
  alternates: { canonical: url("marketing", "/") },
};

const STEPS = [
  {
    n: "01",
    h: "Pick where you are going",
    p: "Choose a country and a size. The full price is on the card before you pay, including what happens if the eSIM never activates.",
  },
  {
    n: "02",
    h: "Install it at home",
    p: "One scan on your own couch, on your own wifi, with time to spare. Nothing switches on yet and nothing starts counting down.",
  },
  {
    n: "03",
    h: "Land already connected",
    p: "Turn the phone on and it finds a local network by itself. No app to open and no code to type while you are carrying a bag and a passport.",
  },
];

const PROMISES = [
  {
    h: "Someone answers",
    p: "A person in Australian hours who can see your profile and fix it. Not a form, and not a bot that asks you to restart your phone.",
    d: "M21 12a8 8 0 0 1-8 8H6l-3 2 1-4a8 8 0 1 1 17-6z",
  },
  {
    h: "Australian consumer law",
    p: "You are covered by Australian Consumer Law, not by terms written in a jurisdiction you have never been to.",
    d: "M4 6h16v12H4z M4 10h16",
  },
  {
    h: "A refund if it never worked",
    p: "If the eSIM never activated on your trip you get your money back, and we do not ask you to prove it with screenshots.",
    d: "M20 7L9 18l-5-5",
  },
  {
    h: "Nothing renews behind you",
    p: "The plan ends when the trip ends. There is no subscription quietly billing you three months after you got home.",
    d: "M12 7v6l4 2",
  },
];

const PRICING = [
  {
    h: "The whole cost, on one card",
    p: "Data, validity, the networks it uses, and the refund position. Before you pay, not after.",
  },
  {
    h: "No activation fee",
    p: "The price on the card is the price. Nothing is added at the last screen.",
  },
  {
    h: "Per trip, not per month",
    p: "It ends when your trip ends. There is no subscription to remember to cancel.",
  },
];

/*
 * The fourth card, which depends on what is actually for sale.
 *
 * It used to be a fixed promise: "Full speed throughout. No throttle after a
 * hidden allowance." Fourteen of the fifty two plans on sale slow to 384 or
 * 512 Kbps once a daily cap is reached, and each of them says so in its own
 * subtitle, two clicks from the sentence denying it.
 *
 * The replacement is not a softer claim, it is a different and better one. A
 * speed cap is not the problem; a speed cap you find out about in Tokyo is.
 * "Nothing is hidden" is true whether or not a plan throttles, and it is the
 * thing worth promising, so the page makes that promise and names the limit
 * rather than denying limits exist.
 */
function speedCard(anyThrottled: boolean) {
  return anyThrottled
    ? {
        h: "Any speed limit is on the card",
        p: "Some plans run at full speed to a daily amount and slow down after it. Those say so, in the plan title and again before you pay. You will never discover a limit while you are away.",
      }
    : {
        h: "Full speed throughout",
        p: "Nothing on sale today slows down after a hidden allowance. If that ever changes, the plan will say so before you pay.",
      };
}

/*
 * Static, and regenerated when the catalogue actually changes.
 *
 * The first version of this read the database on every render. The second
 * revalidated every five minutes, which sounded careful and was not: it meant
 * that twelve times an hour the unlucky visitor who arrived first paid for a
 * cold function and a Postgres round trip to Sydney before a single byte of the
 * page moved. On the one page a stranger judges the business by.
 *
 * A landing page that hesitates is worse than a landing page that is briefly
 * out of date, and this data changes when somebody presses a button in the
 * console, which is a moment we know about exactly. So the page is static and
 * `/console/catalog/toggle` revalidates it on the way out.
 *
 * The daily number is a safety net, not the mechanism. It catches a SKU flipped
 * straight in SQL, which nobody should do and somebody eventually will.
 */
export const revalidate = 86400;

export default async function HomePage() {
  const live = await liveDestinations();
  const claim = heroClaim(live);
  const shop = await liveShopfront();
  const dests = shop?.destinations ?? [];
  const from = shop?.fromAmount ?? null;

  return (
    <>
      <section className={styles.hero} id="top">
        <div className={`${styles.shell} ${styles.heroShell}`}>
          <div className={styles.copy}>
            {/*
              Split into two lines by hand rather than left to wrap, because
              each line is clipped and rises from behind its own edge. A browser
              chosen break would put the mask in a different place at every
              viewport width, and half the effect is that the breaks are
              composed.
            */}
            <h1>
              <span className={styles.lineWrap}>
                <span className={`${styles.line} ${styles.line1}`}>{claim.line1}</span>
              </span>
              <span className={styles.lineWrap}>
                <span className={`${styles.line} ${styles.line2}`}>{claim.line2}</span>
              </span>
            </h1>
            <p className={`${styles.lede} ${styles.rise} ${styles.rise2}`}>
              Set it up on the couch before you fly. Simple. Calm. Australian.
            </p>

            {/* Only rendered when the catalogue actually answered. A price is
                the one thing on this page nobody should ever see a placeholder
                for. */}
            {from !== null ? (
              <p className={`${styles.priceLine} ${styles.rise} ${styles.rise2}`}>
                <b>{money(from, shop?.currency)}</b>
                <span>the cheapest plan on sale today</span>
              </p>
            ) : null}

            <div className={`${styles.acts} ${styles.rise} ${styles.rise3}`}>
              <a className={`${styles.btn} ${styles.btnGo}`} href="#dests">
                See where we go
              </a>
              <a className={`${styles.btn} ${styles.btnQuiet}`} href="#how">
                How it works
              </a>
            </div>

            <div className={`${styles.pills} ${styles.rise} ${styles.rise4}`}>
              {/* Dropped entirely when there is nothing true to put in it. An
                  empty pill is better than a pill reading "0 destinations". */}
              {claim.pill ? (
                <span className={styles.pill}>
                  <i>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
                    </svg>
                  </i>
                  {claim.pill}
                </span>
              ) : null}
              <span className={styles.pill}>
                <i>eSIM</i> Install before you fly
              </span>
              <span className={`${styles.pill} ${styles.pillOk}`}>
                <i>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </i>
                Australian support
              </span>
            </div>
          </div>

          {/*
            Decorative, and every word above it is in the DOM beside it rather
            than inside it. The three nested boxes are not decoration: `.art`
            clips and fades, `.artInner` carries the scroll, `.artIn` carries
            the entrance, and putting the scroll and the entrance on one element
            meant the entrance's fill mode silently won forever.
          */}
          <HeroParallax>
            <div className={styles.art}>
              <div className={styles.artInner}>
                <div className={styles.artIn}>
                  <Motes className={styles.motes} />
                  <HeroArt />
                </div>
              </div>
            </div>
          </HeroParallax>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandSurface}`} id="how">
        <div className={styles.shell}>
          <Reveal><div className={styles.head}>
            <p className={styles.eyebrow}>How it works</p>
            <h2>Three steps, and none of them happen at the airport.</h2>
            <p>
              The thing that goes wrong in this category is a traveller standing at arrivals at
              eleven at night trying to install something. So Bilby moves all of it earlier.
            </p>
          </div></Reveal>
          <Reveal delay={80}><div className={`${styles.steps} ${styles.cascade}`}>
            {STEPS.map((s) => (
              <div className={styles.step} key={s.n}>
                <div className={styles.num}>{s.n}</div>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
            ))}
          </div></Reveal>
        </div>
      </section>

      <section className={styles.band} id="dests">
        <div className={styles.shell}>
          <Reveal><div className={styles.head}>
            <p className={styles.eyebrow}>Destinations</p>
            <h2>The places Australians actually fly to.</h2>
            <p>
              A short list on purpose. Every destination here is on sale right now, not a
              country we hope to cover, and every price is the one the shop charges, read from
              the same catalogue at the same moment.
            </p>
            {/* Material, and a customer should meet it here rather than at the
                payment step. It is derived, so it disappears by itself the day
                a locally routed plan goes on sale. */}
            {shop?.anyRoutedOverseas ? (
              <p style={{ marginTop: 14 }}>
                One thing to know before you get to the price. These plans reach the internet
                through an exit point outside the country you are visiting. Almost everything
                works normally, but some banking apps and some streaming services check where
                your connection appears to come from and may refuse. Every plan says so on its
                own card, and if your bank has to work while you are away, wait for the local
                plans rather than buying one of these.
              </p>
            ) : null}
          </div></Reveal>
          {/*
            Only what is actually on sale. Listing a destination here that the
            shop cannot fill sends somebody to an empty shelf, which reads as
            broken rather than as "not yet", and is the specific failure this
            whole page was rewritten to stop making.
          */}
          {dests.length > 0 ? (
            <Reveal delay={80}><div className={`${styles.dests} ${styles.cascade}`}>
              {dests.map((d) => (
                <div className={styles.dest} key={d.iso}>
                  <div className={styles.swatch}>{d.iso}</div>
                  <h3>{d.name}</h3>
                  {/* No fallback claiming "local networks". Every plan on sale
                      today leaves the destination country to reach the internet,
                      which is the opposite of local, and the curated blurb is
                      the only text here anybody has actually checked. */}
                  {d.blurb ? <p>{d.blurb}</p> : null}
                  <span className={styles.destPrice}>
                    {money(d.fromAmount, shop?.currency)} <small>and up</small>
                  </span>
                </div>
              ))}
            </div></Reveal>
          ) : (
            <Reveal delay={80}><p className={styles.lede}>
              Nothing is on sale yet. Every plan is tested on a real handset before it goes on
              this page, so this fills up as that happens rather than all at once.
            </p></Reveal>
          )}
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandSurface}`} id="pricing">
        <div className={styles.shell}>
          <Reveal><div className={styles.head}>
            <p className={styles.eyebrow}>Pricing</p>
            <h2>
              {from !== null
                ? `One price, paid once, starting at ${money(from, shop?.currency)}.`
                : "One price, paid once, and no surprises at the last screen."}
            </h2>
            <p>
              Every plan is a single charge in Australian dollars. Below is how the pricing
              behaves, and that part is not going to change as the catalogue grows.
            </p>
          </div></Reveal>
          <Reveal delay={80}><div className={`${styles.why} ${styles.cascade}`}>
            {[...PRICING, speedCard(shop?.anyThrottled ?? false)].map((w) => (
              <div className={styles.wy} key={w.h}>
                <h3>{w.h}</h3>
                <p>{w.p}</p>
              </div>
            ))}
          </div></Reveal>
        </div>
      </section>

      <section className={styles.band} id="help">
        <div className={styles.shell}>
          <Reveal><div className={styles.head}>
            <p className={styles.eyebrow}>Why Bilby</p>
            <h2>A small Australian business, which is the point.</h2>
            <p>
              The large travel eSIM brands are support desks in another time zone reselling the same
              underlying networks. What differs is who picks up when it goes wrong.
            </p>
          </div></Reveal>
          <Reveal delay={80}><div className={`${styles.why} ${styles.cascade}`}>
            {PROMISES.map((w) => (
              <div className={styles.wy} key={w.h}>
                <div className={styles.ic}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d={w.d} />
                  </svg>
                </div>
                <h3>{w.h}</h3>
                <p>{w.p}</p>
              </div>
            ))}
          </div></Reveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandSurface}`} id="notes">
        <div className={styles.shell}>
          <Reveal><div className={styles.head}>
            <p className={styles.eyebrow}>Field notes</p>
            <h2>Travellers write down what actually happened.</h2>
            <p>
              Not a star rating. A note: which airport, which network it picked up, and how long it
              took between the plane door and the first bar of signal. The next person going there
              reads it before they fly.
            </p>
          </div></Reveal>
          <Reveal delay={80}><FieldNotes /></Reveal>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.shell}>
          <Reveal><div className={styles.close}>
            <div>
              <h2>Sort the phone out before you sort the packing.</h2>
              {/* No date, and no "shortly". When the shop opens depends on a
                  supplier wallet and a handset test, neither of which has a
                  date, and a timing claim with nothing behind it is a
                  representation about a future matter like any other. */}
              <p>
                Plans and prices are up, so you can see exactly what a trip will cost. Card
                payments are not switched on yet. Nothing here can charge you today.
              </p>
            </div>
            <Link className={`${styles.btn} ${styles.btnGo}`} href="/plans">
              See the plans
            </Link>
          </div></Reveal>
        </div>
      </section>

    </>
  );
}
