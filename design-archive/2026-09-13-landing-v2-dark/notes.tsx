"use client";

import { useState } from "react";
import styles from "./home.module.css";

/**
 * The field notes board.
 *
 * It is empty, and it stays empty until a real traveller writes on it. The
 * button reveals clearly labelled examples so a visitor can see the shape of
 * the thing without being shown invented reviews.
 *
 * This is worth defending when somebody suggests seeding it. The entire
 * positioning of this product is that the incumbents are not straight with
 * people about activation. A fabricated review on this page would cost more
 * than it earns, and it is exactly the kind of thing a competitor screenshots.
 */
const EXAMPLES = [
  {
    where: "Denpasar DPS",
    when: "14 Aug",
    note: "Picked up Telkomsel on the walk to baggage claim. Two minutes, no messing about.",
    who: "Sam, flying from Perth",
  },
  {
    where: "Narita NRT",
    when: "9 Aug",
    note:
      "Nothing for the first ten minutes and I did start to panic. Toggled flight mode once and it caught Docomo straight away.",
    who: "Priya, flying from Melbourne",
  },
  {
    where: "Suvarnabhumi BKK",
    when: "2 Aug",
    note: "Was already connected before the plane doors opened. Texted home from the taxi queue.",
    who: "Tom, flying from Brisbane",
  },
];

export function FieldNotes() {
  const [showing, setShowing] = useState(false);

  if (!showing) {
    return (
      <div className={styles.board}>
        <div className={styles.empty}>
          <h3>The board is empty, and we are leaving it that way.</h3>
          <p>
            Bilby has not flown with anyone yet. When the first traveller lands, their note goes
            here. We would rather show you an empty board than invent a single review.
          </p>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnQuiet}`}
            onClick={() => setShowing(true)}
          >
            Show me how it will look
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.noteGrid}>
        {EXAMPLES.map((e) => (
          <div className={styles.fnote} key={e.where}>
            <div className={styles.where}>
              <span>{e.where}</span>
              <span>{e.when}</span>
            </div>
            <span className={styles.tagex}>Example</span>
            <p>{e.note}</p>
            <p className={styles.who}>{e.who}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
