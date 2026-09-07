import Link from "next/link";
import { LEGAL_ENTITY } from "@/lib/legal";
import styles from "./home.module.css";
import { Mark } from "./mark";

/** The marketing footer. Shared by the landing page and the legal pages, so the
 *  entity line and the contact route can never disagree between them. */
export function Footer() {
  return (
    <footer className={styles.foot}>
      <div className={`${styles.shell} ${styles.footInner}`}>
        <div className={styles.about}>
          <Link className={styles.brandLink} href="/">
            <Mark size={30} />
            <span>Bilby</span>
          </Link>
          <p>{LEGAL_ENTITY.descriptor}</p>
          <p className={styles.contact}>
            <a href={`mailto:${LEGAL_ENTITY.parentEmail}`}>{LEGAL_ENTITY.parentEmail}</a>
            <span>·</span>
            <a href={LEGAL_ENTITY.parentSiteUrl}>{LEGAL_ENTITY.parentSite}</a>
          </p>
        </div>
        <div className={styles.cols}>
          <div>
            <b>Product</b>
            <Link href="/#dests">Destinations</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#notes">Field notes</Link>
          </div>
          <div>
            <b>Support</b>
            <a href={`mailto:${LEGAL_ENTITY.contactEmail}`}>Contact us</a>
            <Link href="/#help">About us</Link>
          </div>
          <div>
            <b>Legal</b>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/refunds">Refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
