/**
 * The Bilby mark.
 *
 * The hero character's head, drawn as one ink rather than imported as an
 * image, so it stays crisp at any size, costs no request, and inverts by
 * changing a CSS variable instead of shipping a second file.
 *
 * The visor is a hole, not a dark shape. It is cut out of the helmet with an
 * even odd fill, so whatever the mark sits on shows through it. That is what
 * lets a single colour mark still read as a face on cream, on navy, and on a
 * launcher's themed icon background, which a flat silhouette cannot: flattened,
 * this becomes an anonymous blob with ears.
 *
 * Geometry is identical to brand/mark/bilby-mark.svg and to the character in
 * hero-art.tsx, all on the same 512 grid, so the header, the hero and the app
 * icon are provably one drawing. If one changes, change the others in the same
 * commit.
 *
 * The default ink is `currentColor` rather than a named variable. It used to be
 * `var(--ink)`, which exists on the landing page and on no other surface, so on
 * the console the fill resolved to nothing and the mark inherited whatever fill
 * happened to be in scope. Inheriting the text colour is both defined and what
 * you want in every case, and any caller that wants otherwise says so.
 */
export function Mark({
  size = 34,
  fill = "currentColor",
  eye = "currentColor",
}: {
  size?: number;
  /** The single ink. */
  fill?: string;
  /** Eyes and smile. Defaults to the ink, for a true one colour mark. */
  eye?: string;
}) {
  const ink = fill;
  const face = eye === "currentColor" ? fill : eye;
  return (
    <svg
      width={size}
      height={size}
      viewBox="60 60 392 392"
      aria-hidden="true"
      focusable="false"
    >
      <g fill={ink}>
        {/* antenna */}
        <path
          d="M256 168 L256 100"
          stroke={ink}
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="256" cy="88" r="21" />

        {/* ears. Ellipses rather than points: the character's ears are soft,
            and a pointed ear reads as a fox. Their lower ends sit inside the
            helmet so there is no join to go wrong at 22 pixels. */}
        <ellipse cx="168" cy="168" rx="44" ry="108" transform="rotate(-34 168 168)" />
        <ellipse cx="344" cy="168" rx="44" ry="108" transform="rotate(34 344 168)" />

        {/* helmet with the visor cut out of it */}
        <path
          fillRule="evenodd"
          d="M256 148 C 341 148, 396 209, 396 288 C 396 372, 337 424, 256 424
             C 175 424, 116 372, 116 288 C 116 209, 171 148, 256 148 Z
             M256 200 C 190 200, 146 236, 146 291 C 146 348, 190 382, 256 382
             C 322 382, 366 348, 366 291 C 366 236, 325 200, 256 200 Z"
        />
      </g>

      <g fill={face}>
        <rect x="188" y="256" width="50" height="59" rx="21" />
        <rect x="274" y="256" width="50" height="59" rx="21" />
        <path
          d="M231 340 C 243 355, 269 355, 281 340"
          stroke={face}
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
