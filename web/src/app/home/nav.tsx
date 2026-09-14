"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./home.module.css";
import { Mark } from "./mark";

/**
 * The landing page header.
 *
 * A client island purely so the bottom border can appear once the page has
 * scrolled. Everything else on this page is server rendered, because a
 * marketing page that needs JavaScript to show its own words is a marketing
 * page that shows nothing to a crawler having a bad day.
 */
export function Nav() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.nav} ${stuck ? styles.navStuck : ""}`}>
      {/*
        The top letterbox bar lives here rather than inside the hero.
        
        It belongs to the hero visually, but the shell renders this header
        before its children, so a bar inside the hero can only sit above the
        navigation by pulling the hero up with a negative margin equal to the
        header's height. That height is not one number: the header is shorter on
        a phone, so the same margin that lined up on a desktop pulled the hero
        off the top of a phone screen and put the pills behind the wordmark.
        Rendering it here makes the arithmetic unnecessary.
      */}
      <div className={styles.letterboxTop}>
        <div className={styles.letterboxInner}>
          <span>Bilby · travel eSIM for Australians</span>
          <span className={styles.lbMid}>Install before you fly</span>
          <span className={styles.rec}>
            <i className={styles.recDot} aria-hidden="true" /> Rec
          </span>
        </div>
      </div>
      <div className={`${styles.shell} ${styles.navInner}`}>
        <Link className={styles.brandLink} href="/">
          <Mark size={34} fill="var(--coral)" eye="var(--aurora)" />
          <span>Bilby</span>
        </Link>
        <nav className={styles.links}>
          <a href="#how">How it works</a>
          <a href="#dests">Destinations</a>
          <a href="#pricing">Pricing</a>
          <a href="#help">About us</a>
        </nav>
        <Link className={styles.login} href="/plans">
          Open the app
        </Link>
      </div>
    </header>
  );
}
