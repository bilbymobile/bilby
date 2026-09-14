"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./home.module.css";

export interface Counter {
  /** The number this cell counts to. Already final and already true. */
  value: number;
  /** What it counts. */
  label: string;
  /** Where the number comes from, or what it excludes. One short line. */
  note: string;
}

/**
 * The numbers strip, counting up once when it arrives.
 *
 * ## The value is rendered, then animated, never the other way round
 *
 * The obvious build starts every cell at zero and lets an effect raise it. On
 * this page that is a bug with a nice easing curve: the server would send a row
 * of zeroes, a crawler and a reader without JavaScript would see a shop with no
 * destinations and no coverage, and the truth would arrive only for people
 * whose bundle loaded. So the first render is the final number. The effect then
 * drops it to zero and counts back up, and only if it is certain it can finish:
 * the same rule the rest of the page follows, which is that motion may never be
 * the thing that makes content visible.
 *
 * ## Counting up is not decoration here
 *
 * A number that arrives by counting is read as measured rather than typed. That
 * is exactly the impression these four should give, because all four are
 * measured: two come from a dated coverage file, two from the live catalogue.
 * None of them is a marketing round number, and the one thing this component
 * must never do is make one look like the other. Hence no "+" and no "190+".
 * If the count is 199 the strip says 199.
 *
 * ## One frame loop for the row, not one per cell
 *
 * Four requestAnimationFrame loops racing each other on a mid range phone is
 * four times the work for a visibly worse result: the cells drift apart and the
 * row stops landing together. One loop drives all four off the same clock.
 */
export function Counters({ items }: { items: Counter[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<number[] | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const motion =
      document.documentElement.dataset.motion === "on" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!motion) return;

    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        const targets = items.map((i) => i.value);
        const started = performance.now();
        const DURATION = 1100;

        const step = (now: number) => {
          const t = Math.min(1, (now - started) / DURATION);
          // Ease out cubic. The last third of a count up is the part a reader
          // actually watches, so the curve spends its time there.
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(targets.map((v) => Math.round(v * eased)));
          if (t < 1) frame = requestAnimationFrame(step);
          else setShown(null);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <div className={styles.counters} ref={ref}>
      <div className={styles.countersInner}>
        {items.map((item, i) => (
          <div className={styles.count} key={item.label}>
            <span className={styles.countN}>
              {(shown ? shown[i] : item.value).toLocaleString("en-AU")}
            </span>
            <span className={styles.countK}>{item.label}</span>
            <span className={styles.countNote}>{item.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
