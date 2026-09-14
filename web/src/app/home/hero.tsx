import Image from "next/image";

import styles from "./home.module.css";
import { Motes } from "./motion";

/**
 * The hero, rebuilt as a replica of the reference deployment's own.
 *
 * ## What was missing before
 *
 * Three earlier attempts got the type and the motion and still did not look
 * like it, because the hero is not a headline over a colour. It is a film
 * frame: a looping shot behind three gradients, black letterbox bars top and
 * bottom carrying camera notes in mono, and a framed portrait of the mascot on
 * the right with signal rings expanding behind it. Take any one of those away
 * and the rest stops reading as cinema.
 *
 * ## The assets are Nav's, and they are one fiftieth of the weight
 *
 * `bilby-hero.png` shipped at 2.1 MB and `hero.mp4` at 2.4 MB. The complaint
 * that started this entire redesign was a slow page on a phone where the
 * character never arrived, so shipping 4.5 MB of hero would have reproduced the
 * original fault while looking like the reference.
 *
 *   mascot   2,150 KB PNG  ->  25 KB WebP at 560w, 44 at 840w, 78 at 1260w
 *   video    2,391 KB MP4  ->  47 KB at 720p, H.264, faststart, no audio track
 *
 * 720p rather than 1080p because the video sits at half opacity behind three
 * gradients: there is no detail left to resolve, and the difference between 47
 * KB and 162 KB is real on a phone in an airport.
 *
 * ## The poster is the floor, not the fallback
 *
 * The video carries `poster`, `preload="none"` and `playsInline`. If it never
 * loads, never decodes, or is refused autoplay, the frame behind the text is
 * still a picture rather than a hole. That is the same rule the vector hero was
 * built to satisfy: motion may never be the thing that makes content visible.
 */
export function Hero({
  line1,
  line2,
  pill,
  price,
  stats,
}: {
  line1: string;
  line2: string;
  /** The live destination count, or null when there is nothing honest to say. */
  pill: string | null;
  /** The cheapest real price, already formatted, or null. */
  price: string | null;
  /** Four short facts for the strip under the buttons. All derived. */
  stats: string[];
}) {
  return (
    <section className={styles.hero} id="top">
      {/* The shot. Parallax and push in are driven by --shift and --exit, set
          from one rAF in HeroParallax, so scrolling off the hero reads as a
          take ending rather than a picture sliding away. */}
      <div className={styles.frame}>
        <video
          className={styles.plate}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/hero/hero-poster.webp"
          aria-hidden="true"
        >
          <source src="/hero/hero-720.mp4" type="video/mp4" />
        </video>
        {/* Three scrims, in the reference's own order: down, across, then the
            warm radial that drifts. Two gradients rather than one because the
            text sits left and the portrait sits right, and a single vertical
            scrim cannot serve both. */}
        <div className={styles.scrimDown} />
        <div className={styles.scrimAcross} />
        <div className={styles.dawn} />
      </div>

      {/* The top bar is rendered by the navigation. See nav.tsx. */}

      <div className={`${styles.shell} ${styles.heroShell}`}>
        <div className={styles.copy}>
          <div className={`${styles.pills} ${styles.rise} ${styles.rise1}`}>
            <span className={styles.pill}>
              <Image
                src="/hero/bilby-560.webp"
                alt=""
                width={20}
                height={20}
                className={styles.pillFace}
              />
              Bilby is cleared for takeoff
            </span>
            {/* Derived. The reference's second pill reads "4.9 · 86K REVIEWS",
                which would be an invention: nobody has flown with Bilby yet. */}
            {pill ? (
              <span className={`${styles.pill} ${styles.pillLive}`}>
                <span className={styles.dot} aria-hidden="true" />
                {pill} on sale
              </span>
            ) : null}
            <span className={`${styles.pill} ${styles.pillHide}`}>
              Australian support
            </span>
          </div>

          <h1>
            <span className={styles.lineWrap}>
              <span className={`${styles.line} ${styles.line1}`}>{line1}</span>
            </span>
            <span className={styles.lineWrap}>
              <span className={`${styles.line} ${styles.line2} ${styles.dawnText}`}>
                {line2}
              </span>
            </span>
          </h1>

          <p className={`${styles.lede} ${styles.rise} ${styles.rise2}`}>
            Set it up on the couch before you fly, land already connected, and reach a
            person in Australian hours if it goes wrong.{" "}
            {price ? (
              <span className={styles.ledeAccent}>Plans from {price}.</span>
            ) : null}
          </p>

          <div className={`${styles.acts} ${styles.rise} ${styles.rise3}`}>
            <a className={styles.cta} href="#dests">
              <span className={styles.ctaLabel}>
                {price ? `See the plans — from ${price}` : "See where we go"}
              </span>
              <span className={styles.ctaBadge} aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </a>
            <a className={styles.ctaQuiet} href="#how">
              How it works
              <span aria-hidden="true"> ▼</span>
            </a>
          </div>

          {/* Four facts, every one of them read from the catalogue or true by
              construction. The reference's strip carries "190+ countries" and
              "$4.99 entry pack". */}
          <div className={`${styles.stats} ${styles.rise} ${styles.rise4}`}>
            {stats.map((s) => (
              <div className={styles.stat} key={s}>
                <span className={styles.statMark} aria-hidden="true" />
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* The portrait. Rings behind, chips over, floating. */}
        <div className={styles.art}>
          <div className={styles.artInner}>
            <div className={styles.rings} aria-hidden="true">
              <span className={styles.ring} />
              <span className={`${styles.ring} ${styles.ringB}`} />
              <span className={styles.ringDash} />
            </div>
            <div className={styles.artIn}>
              <Motes className={styles.motes} />
              <figure className={styles.poster}>
                <Image
                  src="/hero/bilby-1260.webp"
                  alt="Bilby, the Bilby Mobile mascot, hopping above Australia and beaming a signal"
                  width={1260}
                  height={845}
                  priority
                  sizes="(max-width: 980px) 88vw, 420px"
                  className={styles.posterImg}
                />
                <div className={styles.posterScrim} />
                <span className={styles.chipTL}>
                  <i className={styles.dot} aria-hidden="true" /> Bilby · signal buddy
                </span>
                <span className={styles.chipTR}>eSIM · install at home</span>
                <figcaption className={styles.posterFoot}>
                  <span>
                    <b>Bilby says hi</b>
                    <small>From bilbymobile.com</small>
                  </span>
                  <span className={styles.bars}>≋ 5 bars</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.letterboxBottom}>
        <div className={styles.letterboxInner}>
          <span>Scene 01 · Departure · starring Bilby</span>
          <span className={styles.lbMid}>
            Scroll <span className={styles.arrow} aria-hidden="true">↓</span>
          </span>
          <span className={styles.lbEnd}>35mm · anamorphic</span>
        </div>
      </div>
    </section>
  );
}
