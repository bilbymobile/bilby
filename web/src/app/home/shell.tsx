import { Footer } from "./footer";
import { Nav } from "./nav";
import styles from "./home.module.css";

/**
 * Everything served on the apex wears this.
 *
 * Before it existed, /terms on the apex rendered the product's dark theme text
 * on the marketing cream ground: a white heading on cream, which is invisible,
 * and dark cards floating with no header or footer at all. A visitor arriving
 * from the landing page footer, which is exactly how a Play reviewer arrives,
 * saw a broken document.
 *
 * The fix is one shell rather than per page styling, because the failure was
 * caused by the legal pages having no owner: they were written for one surface
 * and then served on another.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <Nav />
      {children}
      <Footer />
    </div>
  );
}
