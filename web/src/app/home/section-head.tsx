import styles from "./home.module.css";

/**
 * The section header, which is the signature of this design.
 *
 * Three parts, in this order, every time:
 *
 *   1. A scene marker. An outlined pill carrying "SCENE 02" or a word like
 *      "STARRING", then a mono label in wide capitals, then a rule running to
 *      the edge of the column. The reference numbers its sections like shots in
 *      a film, and that single device does more for the cinematic feeling than
 *      any amount of photography.
 *
 *   2. A heading in two faces. A line of condensed capitals in Bebas, then a
 *      line of lowercase italic Instrument Serif in the section's own accent
 *      colour. Not one face or the other: both, always, in that order. Reading
 *      the deployment and the brand guidelines as disagreeing about the display
 *      face was my error, and it cost a whole rebuild. One document describes
 *      the first line and the other describes the second.
 *
 *   3. A lead paragraph, held to a readable measure.
 *
 * ## The accent rotates
 *
 * Amber, cyan, lime, coral. Each section owns one hue and uses it for the
 * italic line, the scene pill and its icon tiles, so a reader who has scrolled
 * for thirty seconds knows they have moved without being told. Sampled from the
 * reference rather than invented.
 */
export type Accent = "amber" | "cyan" | "lime" | "coral";

export function SectionHead({
  scene,
  label,
  caps,
  accent,
  hue = "amber",
  children,
}: {
  /** "SCENE 02", or a word like "STARRING". */
  scene: string;
  /** The mono label beside it. */
  label: string;
  /** The capitals line. Set in Bebas; it will be capitals whatever you type. */
  caps: string;
  /** The italic serif line. Written in sentence case, because it stays that way. */
  accent: string;
  hue?: Accent;
  /** The lead paragraph. */
  children?: React.ReactNode;
}) {
  return (
    <div className={`${styles.head} ${styles[hue]}`}>
      <p className={styles.slate}>
        <span className={styles.slateTag}>{scene}</span>
        <span className={styles.slateLabel}>{label}</span>
        <span className={styles.slateRule} aria-hidden="true" />
      </p>
      <h2>
        {caps}
        <br />
        <span className={styles.accent}>{accent}</span>
      </h2>
      {children ? <p className={styles.lead}>{children}</p> : null}
    </div>
  );
}
