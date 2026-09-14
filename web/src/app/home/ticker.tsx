import styles from "./home.module.css";

/**
 * The ticker strip.
 *
 * ## Why it says what it says
 *
 * The reference deployment runs two of these and they carry "GLOBAL TRAVEL ESIM
 * · 190+ COUNTRIES" and "BILBYMOBILE PRESENTS · MEET BILBY". The first is a
 * number nobody can support and the second is a film trailer. A ticker is a
 * strong device precisely because it reads as a live readout, which is exactly
 * why putting a slogan in one is a waste of it and putting an invented number
 * in one is worse.
 *
 * So every item here is a fact, and every fact is passed in from the catalogue
 * by the page that renders it. When a destination is activated the strip grows.
 * When the last one is switched off the strip stops claiming anything. Nobody
 * edits this file to keep it true.
 *
 * ## The loop
 *
 * The track holds two identical runs and translates to exactly minus fifty
 * percent, which lands the second run precisely where the first began. Any
 * other distance leaves a visible jump, and the jump is the only part of a
 * ticker anybody consciously notices.
 *
 * The duplicate is aria-hidden so a screen reader reads the list once.
 */
export function Ticker({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  const run = (hidden: boolean) => (
    <div className={styles.tickerRun} aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span className={styles.tickerItem} key={`${t}-${i}`}>
          {/* The separator is drawn rather than typed so it never gets read
              aloud as punctuation between two unrelated facts. */}
          <span className={styles.tickerSep} aria-hidden="true">
            /
          </span>
          {t}
        </span>
      ))}
    </div>
  );

  return (
    <div className={styles.ticker}>
      <div className={styles.tickerTrack}>
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
