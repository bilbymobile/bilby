import { redirect } from "next/navigation";

import { currentStaff, can } from "@/lib/staff";
import { recentErrors } from "@/lib/observe";
import styles from "../console.module.css";

export const dynamic = "force-dynamic";

/**
 * What is broken.
 *
 * This page is the answer to a gap that was, until now, total: nothing in this
 * application recorded a failure anywhere a person would ever see it. A
 * fulfilment that failed after a customer had paid produced a console log line
 * on a serverless instance that no longer exists.
 *
 * One row per distinct failure, not per occurrence. A supplier outage shows as
 * one line with a count of four thousand, which is a thing you can act on,
 * rather than four thousand lines, which is a thing you close.
 *
 * Resolving is a judgement, not a state machine. Marking a group resolved means
 * "I have looked at this and it is handled"; a later recurrence bumps the count
 * and the last seen time but deliberately does not reopen it. Auto reopening
 * sounds correct and is not: a fault that recurs on a cycle longer than
 * anybody's attention could then never be cleared, and a list that cannot be
 * cleared stops being read.
 */
export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/console/login");
  if (!can(me, "dashboard.read")) redirect("/console");

  const { all: showAll } = await searchParams;
  const includeResolved = showAll === "1";
  const groups = await recentErrors({ includeResolved, limit: 200 });

  const open = groups.filter((g) => g.resolvedAt === null);
  const errors = open.filter((g) => g.level === "error").length;
  const warnings = open.length - errors;
  const occurrences = open.reduce((n, g) => n + g.count, 0);

  return (
    <>
      <h1 className={styles.h1}>Health</h1>
      <p className={styles.lede}>
        Every failure the application caught, grouped by what went wrong rather
        than by how many times it did.
      </p>

      <div className={styles.grid}>
        <div className={styles.stat}>
          <b>{errors}</b>
          <span>Open problems</span>
        </div>
        <div className={styles.stat}>
          <b>{warnings}</b>
          <span>Open warnings</span>
        </div>
        <div className={styles.stat}>
          <b>{occurrences}</b>
          <span>Occurrences behind them</span>
        </div>
      </div>

      <div className={styles.panel} style={{ marginTop: 24 }}>
        <h2>{includeResolved ? "Everything" : "Unresolved"}</h2>
        <p className={styles.sub}>
          {includeResolved ? (
            <a href="/console/health">Show unresolved only</a>
          ) : (
            <a href="/console/health?all=1">Include resolved</a>
          )}
        </p>

        {groups.length === 0 ? (
          <div className={styles.empty}>
            {includeResolved
              ? "Nothing has ever failed."
              : "Nothing is currently failing."}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Where</th>
                  <th>What</th>
                  <th className={styles.num}>Seen</th>
                  <th>Last</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.fingerprint}>
                    <td>
                      <span
                        className={`${styles.pill} ${g.level === "error" ? styles.off : ""}`}
                      >
                        {g.level}
                      </span>
                    </td>
                    <td className={styles.code}>{g.scope}</td>
                    <td style={{ maxWidth: 460 }}>
                      {g.message}
                      {Object.keys(g.detail).length > 0 ? (
                        <div
                          className={styles.code}
                          style={{ fontSize: ".76rem", opacity: 0.7, marginTop: 4 }}
                        >
                          {JSON.stringify(g.detail).slice(0, 220)}
                        </div>
                      ) : null}
                    </td>
                    <td className={styles.num}>{g.count}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(g.lastAt).toLocaleString("en-AU")}
                    </td>
                    <td className={styles.num}>
                      {g.resolvedAt ? (
                        <span className={styles.pill}>resolved</span>
                      ) : (
                        <form method="post" action="/console/health/resolve">
                          <input type="hidden" name="fingerprint" value={g.fingerprint} />
                          <button className={`${styles.btn} ${styles.small} ${styles.ghost}`} type="submit">
                            Mark handled
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.note} style={{ marginTop: 24 }}>
        Nothing that could be a credential reaches this page. Card details,
        activation codes, API keys and full email addresses are stripped before
        the failure is stored, not before it is displayed, so a secret is never
        written down even briefly. If you are debugging something and the field
        you need says redacted, that is the guard working, and the answer is a
        temporary log line rather than loosening it.
      </div>
    </>
  );
}
