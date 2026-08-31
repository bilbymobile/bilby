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
      <div className={`${styles.shell} ${styles.navInner}`}>
        <Link className={styles.brandLink} href="/">
          <Mark size={34} />
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
