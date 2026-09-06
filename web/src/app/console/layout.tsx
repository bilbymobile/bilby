import type { Metadata } from "next";
import Link from "next/link";

import { currentStaff } from "@/lib/staff";
import { openErrorCount } from "@/lib/observe";
import { Mark } from "../home/mark";
import styles from "./console.module.css";

export const metadata: Metadata = {
  title: "Bilby console",
  // A staff console has no business in a search index, and the console host
  // should never have been crawlable in the first place.
  robots: { index: false, follow: false },
};

/**
 * The authoritative access check.
 *
 * Middleware turns away requests with no cookie, cheaply and at the edge, but
 * it cannot reach the database from there so it cannot tell a real session from
 * a forged one. This is where that is decided, in a server component with a
 * connection, and everything below it can assume a real person.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const me = await currentStaff();

  // The sign in pages render inside this layout too, so an unauthenticated
  // visitor has to reach them without being bounced in a loop. Returning the
  // children bare is how: no chrome, no session, nothing to leak.
  if (!me) return <>{children}</>;

  // Counted on every console page load, deliberately. A health page nobody
  // navigates to is a health page nobody reads, so the number has to be in
  // front of you whichever screen you opened.
  const problems = await openErrorCount();

  return (
    <div className={styles.wrap}>
      <header className={styles.bar}>
        <Link className={styles.brand} href="/console">
          <Mark size={22} />
          Bilby
        </Link>
        <span className={styles.tag}>Console</span>
        <nav className={styles.tabs}>
          <Link href="/console">Dashboard</Link>
          <Link href="/console/orders">Orders</Link>
          <Link href="/console/catalog">Catalogue</Link>
          <Link href="/console/coupons">Discounts</Link>
          <Link href="/console/health">
            Health{problems > 0 ? ` (${problems})` : ""}
          </Link>
        </nav>
        <div className={styles.who}>
          <span>{me.email}</span>
          <span className={styles.role}>{me.role}</span>
          <form method="post" action="/console/signout">
            <button className={styles.out} type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
