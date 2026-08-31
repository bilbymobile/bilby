/**
 * The Bilby mark.
 *
 * A solid navy bilby, drawn rather than imported, so it stays crisp at any size
 * and costs no request. Colours come from the page's own tokens so the mark
 * inverts correctly if it is ever placed on ink.
 */
export function Mark({ size = 34, fill = "var(--ink)", eye = "var(--cream)" }: {
  size?: number;
  fill?: string;
  eye?: string;
}) {
  return (
    <svg
      width={size}
      height={(size * 330) / 300}
      viewBox="0 0 300 330"
      aria-hidden="true"
      focusable="false"
    >
      <g fill={fill}>
        <path
          d="M96 262 C 58 272, 48 300, 72 308"
          fill="none"
          stroke={fill}
          strokeWidth="17"
          strokeLinecap="round"
        />
        <ellipse cx="150" cy="248" rx="62" ry="56" />
        <ellipse cx="132" cy="108" rx="17" ry="62" transform="rotate(-9 132 152)" />
        <ellipse cx="166" cy="96" rx="17" ry="64" transform="rotate(8 166 148)" />
        <ellipse cx="148" cy="180" rx="48" ry="42" />
        <path d="M182 160 C 210 162, 236 178, 238 190 C 236 200, 214 205, 190 200 C 182 188, 180 172, 182 160 Z" />
      </g>
      <ellipse cx="182" cy="176" rx="7.4" ry="8" fill={eye} />
    </svg>
  );
}
