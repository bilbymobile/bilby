import { Mark } from "../../home/mark";
import styles from "../console.module.css";

export const dynamic = "force-dynamic";

/**
 * Sign in.
 *
 * The form always reports the same thing, whether or not the address belongs to
 * anyone. Saying "no such account" would turn this page into a way to find out
 * who works here, and it tells a legitimate person nothing they did not already
 * know about their own address.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; link?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className={styles.signin}>
      <div className={styles.signinCard}>
        <Mark size={30} />
        <h1>Bilby console</h1>

        {sp.sent ? (
          <>
            <p>
              If that address belongs to a staff account, a sign in link is on its way. It works
              once and expires in fifteen minutes.
            </p>
            {sp.link ? (
              <div className={`${styles.note} ${styles.bad}`}>
                <strong>This console is not protected yet.</strong> No mail provider is configured,
                so the link is shown here rather than sent. Anyone who reaches this page and types
                the owner address gets the same thing.
                <br />
                <br />
                This stops the moment you sign in once. Use the link, then set{" "}
                <code>RESEND_API_KEY</code> before your session expires, or you will need database
                access to get back in.
                <br />
                <br />
                <code>{sp.link}</code>
              </div>
            ) : null}
            <a className={`${styles.btn} ${styles.ghost}`} href="/console/login">
              Send another
            </a>
          </>
        ) : (
          <>
            <p>Enter your work address and we will send you a link. There is no password.</p>
            <form className={styles.form} method="post" action="/console/login/request">
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <button className={styles.btn} type="submit">Send me a link</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
