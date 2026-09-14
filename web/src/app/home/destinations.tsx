"use client";

import { useState } from "react";

import type { Region } from "@/lib/coverage";
import styles from "./home.module.css";

export interface FeaturedCard {
  iso: string;
  /** The country, as the shop names it. */
  country: string;
  /** Badge in the corner of the plate. */
  cut: string;
  region: Region;
  /** Photograph, or null when there is nothing to show but the plate. */
  photo: string | null;
  /** Already formatted, or null when nothing for this country is on sale. */
  price: string | null;
  /** The curated line under the name, when there is one worth printing. */
  blurb: string | null;
}

export interface CoverageRow {
  name: string;
  region: Region;
}

const TABS: Array<{ key: Region | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "apac", label: "Asia Pacific" },
  { key: "europe", label: "Europe" },
  { key: "mea", label: "Middle East and Africa" },
  { key: "americas", label: "Americas" },
];

/**
 * Scene 02, rebuilt as the reference builds it: a filter row, a grid of
 * photographic cards, and then the whole of the supply underneath.
 *
 * ## Two lists, and they are not the same list
 *
 * The cards are what Bilby can sell. The grid under them is where the supply
 * reaches. Those are different facts by two orders of magnitude right now, and
 * a page that shows only the second one is claiming a shop it does not have,
 * while a page that shows only the first is hiding the reason to come back.
 * Both are shown, they are labelled, and the card for a country with nothing
 * activated says so on its face instead of quoting a price nobody can pay.
 *
 * ## The filter is state, not a route
 *
 * Tapping Europe does not navigate. Six cards and a couple of hundred names are
 * already in the document; going to the server to hide four of them would be a
 * round trip to Sydney to change a class. It also means the back button still
 * belongs to the page rather than to the filter, which is what a reader expects
 * from a set of tabs.
 */
export function Destinations({
  cards,
  rows,
  readOn,
}: {
  cards: FeaturedCard[];
  rows: CoverageRow[];
  readOn: string;
}) {
  const [tab, setTab] = useState<Region | "all">("all");
  const [openList, setOpenList] = useState(false);
  /*
   * A photograph that fails is not a card with a hole in it.
   *
   * Half of these are served from a host we do not control, and the plate
   * behind them is already a finished surface: a warm gradient with the name on
   * it. So a failed load drops the image element entirely and the card carries
   * on looking deliberate, rather than showing a browser's broken image icon
   * and the alt text stacked over the name.
   */
  const [broken, setBroken] = useState<Record<string, true>>({});

  const shownCards = tab === "all" ? cards : cards.filter((c) => c.region === tab);
  const shownRows = tab === "all" ? rows : rows.filter((r) => r.region === tab);

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Filter destinations by region">
        {TABS.map((t) => {
          const n = t.key === "all" ? rows.length : rows.filter((r) => r.region === t.key).length;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabOn : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className={styles.tabN}>{n}</span>
            </button>
          );
        })}
      </div>

      {shownCards.length > 0 ? (
        <div className={styles.cards}>
          {shownCards.map((c) => (
            <article className={styles.card} key={c.iso}>
              <div className={styles.plate}>
                {c.photo && !broken[c.iso] ? (
                  // Not next/image. These are 1200px wide already, they are
                  // below the fold, and half of them are served from a host the
                  // optimiser would have to reach at request time. A plain tag
                  // that lazy loads is the version that cannot fail on deploy.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photo}
                    alt={`${c.country}, drawn`}
                    loading="lazy"
                    decoding="async"
                    className={styles.plateImg}
                    onError={() => setBroken((b) => ({ ...b, [c.iso]: true }))}
                  />
                ) : null}
                <span className={styles.plateScrim} aria-hidden="true" />
                <span className={styles.cut}>{c.cut}</span>
                <span className={c.price ? styles.tagLive : styles.tagSoon}>
                  {c.price ? `From ${c.price}` : "Not on sale yet"}
                </span>
                <span className={styles.plateName}>
                  <b>{c.country}</b>
                  <i>{TABS.find((t) => t.key === c.region)?.label}</i>
                </span>
              </div>
              {c.blurb ? <p className={styles.cardNote}>{c.blurb}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.lede}>
          Nothing is featured in this region yet. The full list is below.
        </p>
      )}

      <div className={styles.reach}>
        <p className={styles.reachHead}>
          <span className={styles.reachN}>{shownRows.length}</span>
          {tab === "all"
            ? " countries and territories our supply reaches"
            : ` in ${TABS.find((t) => t.key === tab)?.label}`}
          <span className={styles.reachNote}>
            Read from the partner console on {readOn}. Reaching a country is not the same as
            having a plan for it on sale, and the cards above are the ones on sale.
          </span>
        </p>
        <ul className={`${styles.reachList} ${openList ? styles.reachOpen : ""}`}>
          {shownRows.map((r) => (
            <li key={r.name}>{r.name}</li>
          ))}
        </ul>
        {shownRows.length > 24 ? (
          <button type="button" className={styles.reachMore} onClick={() => setOpenList((v) => !v)}>
            {openList ? "Show fewer" : `Show all ${shownRows.length}`}
          </button>
        ) : null}
      </div>
    </>
  );
}
