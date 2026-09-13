import styles from "./home.module.css";

/**
 * The hero, drawn rather than photographed.
 *
 * ## Why the render is gone
 *
 * The old hero was a 262 KB JPEG of the mascot lit at golden hour, marked
 * priority, and it was the single most expensive thing on the page. On a phone
 * browser on mobile data it was also the thing Nav kept seeing as a broken
 * image glyph: a large priority fetch on a cold connection either arrives or
 * leaves a hole where the character should be, and the hole is what a first
 * time visitor judges the business by.
 *
 * It was also lit for a cream page. Grading a warm render onto a near black
 * ground does not work; you get a bright rectangle floating in space with a
 * seam around it.
 *
 * So the scene is vector. It cannot 404, it cannot arrive late, it costs no
 * request, it is sharp on every display, and it recolours by changing a
 * variable. The character is the same geometry as the app icon and the header
 * mark, on the same 512 grid, so all three are provably one drawing.
 *
 * ## Nothing here is load bearing
 *
 * Every element is decorative and the section reads correctly with the whole
 * SVG removed. That is deliberate: the headline, the price and the buttons live
 * in the DOM beside this, never inside it.
 */
export function HeroArt() {
  return (
    <svg
      className={styles.scene}
      viewBox="0 0 640 720"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* The character's ink. Coral into mango, top left to bottom right, so
            the light in the gradient agrees with the glow behind the head
            rather than fighting it. */}
        <linearGradient id="bilbyInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFB088" />
          <stop offset="45%" stopColor="#FF8E5C" />
          <stop offset="100%" stopColor="#FF7A3D" />
        </linearGradient>

        {/*
          The planet limb.

          In user space, not in the object's bounding box. The circle is 1120
          units tall and only its top hundred show, so a bounding box gradient
          spent its entire range below the frame and the visible band was one
          flat colour: the planet ended at the bottom of the scene in a hard
          horizontal line across the page. Pinned to the band that is actually
          on screen, it fades into the page ground instead, and the clip edge
          stops existing.
        */}
        <linearGradient id="limb" gradientUnits="userSpaceOnUse" x1="0" y1="606" x2="0" y2="760">
          <stop offset="0%" stopColor="#232A55" />
          <stop offset="46%" stopColor="#141A36" />
          <stop offset="100%" stopColor="#04060F" />
        </linearGradient>

        {/* Atmosphere. Aurora along the top edge of the curve, gone by a third
            of the way down, which is what an atmosphere actually looks like
            from above and what stops the planet reading as a grey hill. */}
        <linearGradient id="air" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#46F1D6" stopOpacity=".85" />
          <stop offset="30%" stopColor="#5EC8FF" stopOpacity=".25" />
          <stop offset="100%" stopColor="#5EC8FF" stopOpacity="0" />
        </linearGradient>

        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF7A3D" stopOpacity=".55" />
          <stop offset="55%" stopColor="#FF7A3D" stopOpacity=".14" />
          <stop offset="100%" stopColor="#FF7A3D" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="rim" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#46F1D6" stopOpacity="0" />
          <stop offset="72%" stopColor="#46F1D6" stopOpacity="0" />
          <stop offset="88%" stopColor="#46F1D6" stopOpacity=".22" />
          <stop offset="100%" stopColor="#46F1D6" stopOpacity="0" />
        </radialGradient>

        {/*
          The frame.

          The scene is allowed to overflow its box so the coral halo can bleed
          into the page rather than ending at an edge. The planet must not take
          that permission: its circle is 1120 units across and it was drawing a
          bright atmosphere arc clean across the right hand side of the section.
          So the glow spills and the geometry does not.
        */}
        <clipPath id="frame">
          <rect x="0" y="0" width="640" height="720" />
        </clipPath>
      </defs>

      {/* Warmth behind the character, painted before anything else so every
          line in the scene sits on top of it. */}
      <circle cx="320" cy="300" r="290" fill="url(#halo)" />
      <circle cx="320" cy="300" r="270" fill="url(#rim)" />

      {/* Two orbits, tilted and not concentric. Concentric ellipses read as a
          target; offset ones read as two bodies on different paths. */}
      {/*
        Two orbits, tilted, not concentric, and turning opposite ways.

        Each sits in its own group because the two rotate independently: one
        ring turning is a ring turning, two turning against each other at
        different speeds is parallax, and parallax is the cheapest depth cue
        there is.
      */}
      <g className={styles.orbits} fill="none">
        <g className={styles.orbitOuter}>
          <ellipse
            className={styles.orbit}
            cx="320" cy="332" rx="288" ry="96"
            transform="rotate(-13 320 332)"
            strokeDasharray="26 20"
          />
        </g>
        <g className={styles.orbitInner}>
          <ellipse
            className={`${styles.orbit} ${styles.orbitB}`}
            cx="320" cy="352" rx="236" ry="132"
            transform="rotate(11 320 352)"
            strokeDasharray="4 26"
          />
        </g>
      </g>

      {/* The planet. Its centre is far below the frame, so what shows is a
          shallow curve rather than a ball, which is the difference between
          being above a world and being next to a marble. */}
      <g className={styles.planet} clipPath="url(#frame)">
        <circle cx="320" cy="1180" r="560" fill="url(#limb)" />
        <circle cx="320" cy="1180" r="560" fill="none" stroke="url(#air)" strokeWidth="5" />
        {/* A coastline, abstracted to two strokes. Any more and somebody asks
            which country it is, and the answer would have to be honest. */}
        <path
          className={styles.coast}
          d="M112 660 C 176 634, 214 646, 262 630 C 300 618, 322 600, 372 604"
        />
        <path
          className={styles.coast}
          d="M392 664 C 438 640, 470 646, 516 626"
        />
      </g>

      {/* The character, on the 512 grid the app icon uses, moved and scaled
          into this frame as one transform so the geometry stays comparable. */}
      <g transform="translate(320 292) scale(0.86) translate(-256 -256)">
        <g className={styles.ink} fill="url(#bilbyInk)">
          <path
            d="M256 168 L256 100"
            stroke="url(#bilbyInk)"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
          />
          <circle className={styles.spark} cx="256" cy="88" r="21" fill="#FFB347" />
          {/* Each ear is an ellipse inside a group. The group carries the
              position and the splay; the ellipse carries the sway. Keeping
              those on separate elements is what lets the CSS rotate the ear
              about its own base instead of about the middle of the frame. */}
          <g transform="rotate(-34 168 168)">
            <ellipse className={styles.earL} cx="168" cy="168" rx="44" ry="108" />
          </g>
          <g transform="rotate(34 344 168)">
            <ellipse className={styles.earR} cx="344" cy="168" rx="44" ry="108" />
          </g>
          <path
            fillRule="evenodd"
            d="M256 148 C 341 148, 396 209, 396 288 C 396 372, 337 424, 256 424
               C 175 424, 116 372, 116 288 C 116 209, 171 148, 256 148 Z
               M256 200 C 190 200, 146 236, 146 291 C 146 348, 190 382, 256 382
               C 322 382, 366 348, 366 291 C 366 236, 325 200, 256 200 Z"
          />
        </g>

        {/* Face. Aurora rather than coral: the eyes are the one place in the
            brand where the signal colour belongs on the character, and it is
            what makes the visor read as glass with something behind it. */}
        <g fill="#46F1D6">
          <rect x="188" y="256" width="50" height="59" rx="21" />
          <rect x="274" y="256" width="50" height="59" rx="21" />
          <path
            d="M231 340 C 243 355, 269 355, 281 340"
            stroke="#46F1D6"
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Signal, leaving the antenna. Three arcs on the same path, staggered,
            so it reads as emission rather than as a wifi icon. */}
        <g className={styles.waves} transform="rotate(6 256 88)" fill="none">
          <path className={styles.wave} d="M143 52 A 142 142 0 0 1 369 52" />
          <path className={styles.wave} d="M143 52 A 142 142 0 0 1 369 52" />
          <path className={styles.wave} d="M143 52 A 142 142 0 0 1 369 52" />
        </g>
      </g>
    </svg>
  );
}
