import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { DESTINATIONS } from "@/lib/destinations";
import { url } from "@/lib/hosts";
import styles from "./home.module.css";
import { FieldNotes } from "./notes";
import { HeroParallax, Reveal } from "./motion";

/**
 * The marketing landing page, served on the apex.
 *
 * ## Every number on this page is derived, not typed
 *
 * The design this came from carried "190+ countries" and "200+ carriers". Both
 * were invented, and both are representations about a future matter under
 * Australian Consumer Law: until a wholesale contract exists, the burden of
 * showing reasonable grounds for them sits with us. So the destination count
 * comes from `DESTINATIONS`, which is the same list the picker and the plan
 * catalogue read, and it grows on its own as the catalogue does.
 *
 * ## And there are no prices
 *
 * For the same reason. There is no signed rate card, so any price here would be
 * a guess wearing a dollar sign. What replaces it is the pricing *promise*,
 * which is true today and is the thing that actually differentiates us: the
 * whole cost on the card, no activation fee, nothing that renews behind you,
 * and a refund if the eSIM never worked. Put real numbers back the day a
 * supplier is live, not before.
 */

export const metadata: Metadata = {
  title: "Bilby · travel eSIM for Australians",
  description:
    "Set up your travel data at home before you fly, land already connected, and reach a person in Australian hours if it goes wrong.",
  alternates: { canonical: url("marketing", "/") },
};

const STEPS = [
  {
    n: 1,
    h: "Pick where you are going",
    p: "Choose a country and a size. The full price is on the card before you pay, including what happens if the eSIM never activates.",
  },
  {
    n: 2,
    h: "Install it at home",
    p: "One scan on your own couch, on your own wifi, with time to spare. Nothing switches on yet and nothing starts counting down.",
  },
  {
    n: 3,
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

export default function HomePage() {
  const count = DESTINATIONS.length;

  return (
    <>
      <section className={styles.hero} id="top">
        <HeroParallax>
        <div className={`${styles.art} ${styles.artIn}`}>
          <Image
            src="/hero-bilby.jpg"
            alt="The Bilby mascot above the Earth over Australia, broadcasting a signal"
            width={1400}
            height={1484}
            priority
            sizes="(max-width: 980px) 100vw, 64vw"
            className={styles.drift}
          />
          <svg className={styles.sig} viewBox="0 0 1400 1484" aria-hidden="true">
            <g transform="rotate(6 559 308)">
              <path className={styles.wave} d="M446 131 A 142 142 0 0 1 672 131" />
              <path className={styles.wave} d="M446 131 A 142 142 0 0 1 672 131" />
              <path className={styles.wave} d="M446 131 A 142 142 0 0 1 672 131" />
            </g>
            <circle className={styles.spark} cx="559" cy="308" r="11" />
            <ellipse className={styles.orbit} cx="700" cy="1180" rx="560" ry="150" strokeDasharray="26 22" />
            <ellipse
              className={`${styles.orbit} ${styles.orbitB}`}
              cx="700" cy="1244" rx="650" ry="180" strokeDasharray="16 32"
            />
          </svg>
          <div className={styles.vignette} />
          <div className={styles.fade} />
        </div>
        </HeroParallax>

        <div className={`${styles.shell} ${styles.heroShell}`}>
          <div className={styles.copy}>
            <h1 className={`${styles.rise} ${styles.rise1}`}>Land connected in {count} destinations.</h1>
            <p className={`${styles.lede} ${styles.rise} ${styles.rise2}`}>
              Set it up on the couch before you fly. Simple. Calm. Australian.
            </p>
            <div className={`${styles.acts} ${styles.rise} ${styles.rise3}`}>
              <a className={`${styles.btn} ${styles.btnGo}`} href="#dests">
                See where we go
              </a>
              <a className={`${styles.btn} ${styles.btnQuiet}`} href="#how">
                How it works
              </a>
            </div>
            <div className={`${styles.pills} ${styles.rise} ${styles.rise4}`}>
              <span className={styles.pill}>
                <i>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
                  </svg>
                </i>
                {count} destinations
              </span>
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
          <Reveal delay={80}><div className={styles.steps}>
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
              A short list on purpose. Every destination here is one we can quote, price and
              provision, rather than an aspirational map of the world.
            </p>
          </div></Reveal>
          <Reveal delay={80}><div className={styles.dests}>
            {DESTINATIONS.map((d) => (
              <div className={styles.dest} key={d.iso}>
                <div className={styles.swatch}>{d.iso}</div>
                <h3>{d.name}</h3>
                <p>{d.blurb ?? "Local networks, full speed"}</p>
              </div>
            ))}
          </div></Reveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandSurface}`} id="pricing">
        <div className={styles.shell}>
          <Reveal><div className={styles.head}>
            <p className={styles.eyebrow}>Pricing</p>
            <h2>No prices yet, because we will not guess at them.</h2>
            <p>
              Our wholesale agreement is not signed, so any number on this page today would be
              invention. What we can tell you now is exactly how the pricing will behave, and that
              part is not going to change.
            </p>
          </div></Reveal>
          <Reveal delay={80}><div className={styles.why}>
            <div className={styles.wy}>
              <h3>The whole cost, on one card</h3>
              <p>Data, validity, the networks it uses, and the refund position. Before you pay, not after.</p>
            </div>
            <div className={styles.wy}>
              <h3>No activation fee</h3>
              <p>The price on the card is the price. Nothing is added at the last screen.</p>
            </div>
            <div className={styles.wy}>
              <h3>Per trip, not per month</h3>
              <p>It ends when your trip ends. There is no subscription to remember to cancel.</p>
            </div>
            <div className={styles.wy}>
              <h3>Full speed throughout</h3>
              <p>No throttle after a hidden allowance. A slow eSIM you cannot use is the same as no eSIM.</p>
            </div>
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
          <Reveal delay={80}><div className={styles.why}>
            {PROMISES.map((w) => (
              <div className={styles.wy} key={w.h}>
                <div className={styles.ic}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round">
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
              <p>
                We are not open yet. When we are, the part of the trip nobody enjoys thinking about
                takes five minutes on the couch.
              </p>
            </div>
            <Link className={`${styles.btn} ${styles.btnGo}`} href="/plans">
              Open the app
            </Link>
          </div></Reveal>
        </div>
      </section>

    </>
  );
}
