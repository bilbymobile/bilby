import {
  archRow, birds, cone, dome, dunes, fern, gum, karsts, minaret, palm, ridge,
  span, terraces, tiers, torii, tower,
} from "./primitives.mjs";

/**
 * Thirteen destination plates, composed from the shape vocabulary.
 *
 * ## Why these are drawn rather than photographed
 *
 * The cards used to hotlink stock photographs, which put a third party in front
 * of every visitor and left the pictures at the mercy of a URL nobody here
 * controls. Drawing them solves both at once and settles the copyright question
 * completely: there is no source image, no photographer, no licence to honour
 * and nothing to attribute, because every line comes out of a function in this
 * repository.
 *
 * ## What each one is allowed to contain
 *
 * A landform, a plant, and one or two built shapes, all abstracted to the point
 * where they are a type rather than a portrait. A cone with a crater is a
 * volcano, not any particular volcano. A tiered roof is a pagoda. A dome on a
 * drum is half the skylines in Europe. That abstraction is a legal position as
 * much as an aesthetic one: an original stylisation of a building type carries
 * none of the rights that a photograph of a specific building can.
 *
 * ## They belong to the same night as the rest of the page
 *
 * Every plate is the same composition: a graded sky from the page's own ground
 * colour up through one accent, a low sun, three depth layers going darker
 * towards the viewer, and the grain the rest of the site already wears. That
 * shared structure is what makes thirteen different countries read as one set
 * instead of thirteen clip art choices.
 */

export const W = 1200;
export const H = 750;

/** Horizon, and the three depth planes measured from it. */
const HZ = 512;

/**
 * Five skies, assigned so that no two cards sharing an edge in the grid share a
 * palette. Worked out against the three column layout, which is the one where a
 * repeat is visible: a phone shows one card at a time and will forgive it.
 */
const PALETTES = {
  amber: { sky: ["#0A0D1F", "#2A1B36", "#8A4A2E", "#FFB43A"], sun: "#FFD489" },
  coral: { sky: ["#0A0D1F", "#31182E", "#93402F", "#FF9E5A"], sun: "#FFC59B" },
  cyan:  { sky: ["#060B22", "#132A45", "#255F77", "#6EE7FF"], sun: "#BFF3FF" },
  lime:  { sky: ["#070C1B", "#13241F", "#3C5C3A", "#BCE86A"], sun: "#E4FFB8" },
  violet:{ sky: ["#080A20", "#231A44", "#5A3A7A", "#C09BFF"], sun: "#E6D4FF" },
  steel: { sky: ["#060A18", "#121B2F", "#39506E", "#9FC3E8"], sun: "#DCEBFF" },
};

/** Three layers of land, back to front, each closer to the page's ground. */
const L1 = "#2E2438";
const L2 = "#1A1630";
const L3 = "#0B0C1E";

export const SCENES = {
  JP: {
    hue: "amber",
    build: () =>
      ridge({ x0: -60, x1: 560, baseY: HZ, low: HZ - 40, high: HZ - 150, steps: 16, jag: 2, seed: "jp-far", fill: L1 }) +
      cone({ cx: 760, baseY: HZ, w: 620, h: 250, fill: L1, snow: "#EDE6FF" }) +
      ridge({ x0: 700, x1: 1260, baseY: HZ + 60, low: HZ + 20, high: HZ - 70, steps: 12, jag: 2.4, seed: "jp-mid", fill: L2 }) +
      tiers({ cx: 236, baseY: HZ + 96, w: 250, h: 290, count: 5, fill: L2 }) +
      torii({ cx: 890, baseY: HZ + 236, w: 236, h: 290, fill: L3 }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 190, high: HZ + 140, steps: 10, jag: 1.4, seed: "jp-near", fill: L3 }) +
      birds({ cx: 470, cy: 210, n: 6, s: 12, fill: "#FFD489", seed: "jp-b" }),
  },

  ID: {
    hue: "cyan",
    build: () =>
      cone({ cx: 330, baseY: HZ, w: 560, h: 230, fill: L1, crater: true }) +
      cone({ cx: 760, baseY: HZ, w: 420, h: 170, fill: L1, crater: true }) +
      ridge({ x0: -60, x1: 1260, baseY: HZ + 70, low: HZ + 40, high: HZ - 30, steps: 12, jag: 1.6, seed: "id-mid", fill: L2 }) +
      terraces({ x0: 120, x1: 1080, baseY: HZ + 216, rows: 6, fill: L2 }) +
      palm({ x: 130, baseY: H + 10, h: 330, fill: L3, seed: "id-p1" }) +
      palm({ x: 232, baseY: H + 10, h: 262, fill: L3, seed: "id-p2" }) +
      palm({ x: 1076, baseY: H + 10, h: 300, fill: L3, seed: "id-p3" }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 224, high: HZ + 200, steps: 8, jag: 1.2, seed: "id-near", fill: L3 }),
  },

  TH: {
    hue: "coral",
    build: () =>
      karsts({ xs: [110, 268, 980, 1124], baseY: HZ + 16, h: 230, fill: L1, seed: "th-k" }) +
      tiers({ cx: 600, baseY: HZ + 30, w: 300, h: 250, count: 6, fill: L1 }) +
      archRow({ x0: 400, count: 5, w: 78, baseY: HZ + 118, h: 90, fill: L2, pointed: true }) +
      ridge({ x0: -60, x1: 1260, baseY: HZ + 170, low: HZ + 150, high: HZ + 118, steps: 10, jag: 1.3, seed: "th-mid", fill: L2 }) +
      /*
       * A longtail boat went here and came out as a stick. Its hull sat on the
       * same dark plane as the ridge behind it, so at card size all that
       * survived was the mast, leaning across the temple like a scratch on the
       * film. Three shapes fought for the same two hundred pixels; the temple
       * won, and the boat is gone.
       */
      palm({ x: 106, baseY: H + 10, h: 300, fill: L3, seed: "th-p1" }) +
      palm({ x: 1100, baseY: H + 10, h: 268, fill: L3, seed: "th-p2" }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 232, high: HZ + 206, steps: 8, jag: 1.2, seed: "th-near", fill: L3 }),
  },

  VN: {
    hue: "steel",
    build: () =>
      karsts({ xs: [70, 240, 430, 640, 860, 1050, 1180], baseY: HZ + 10, h: 250, fill: L1, seed: "vn-k1" }) +
      karsts({ xs: [160, 520, 900], baseY: HZ + 92, h: 200, fill: L2, seed: "vn-k2" }) +
      // A junk: a hull and two battened sails.
      `<path d="M 470 664 Q 600 700, 740 664 L 716 636 L 494 636 Z" fill="${L3}"/>` +
      `<path d="M 560 636 L 560 452 Q 640 490, 636 636 Z" fill="${L3}"/>` +
      `<path d="M 660 636 L 660 500 Q 722 528, 718 636 Z" fill="${L3}"/>` +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 236, high: HZ + 214, steps: 8, jag: 1.1, seed: "vn-near", fill: L3 }),
  },

  SG: {
    hue: "violet",
    build: () =>
      ridge({ x0: -60, x1: 1260, baseY: HZ + 24, low: HZ + 8, high: HZ - 26, steps: 14, jag: 1.3, seed: "sg-far", fill: L1 }) +
      tower({ x: 430, baseY: HZ + 24, w: 66, h: 250, fill: L1 }) +
      tower({ x: 540, baseY: HZ + 24, w: 66, h: 250, fill: L1 }) +
      tower({ x: 650, baseY: HZ + 24, w: 66, h: 250, fill: L1, cap: "crown" }) +
      tower({ x: 210, baseY: HZ + 110, w: 60, h: 180, fill: L2, cap: "spire" }) +
      tower({ x: 300, baseY: HZ + 110, w: 48, h: 128, fill: L2 }) +
      tower({ x: 850, baseY: HZ + 110, w: 54, h: 208, fill: L2, cap: "step" }) +
      tower({ x: 930, baseY: HZ + 110, w: 44, h: 150, fill: L2 }) +
      // Supertrees, as a trunk and an inverted fan.
      [1040, 1130].map((x, i) =>
        `<rect x="${x - 7}" y="${HZ + 40}" width="14" height="${150 + i * 30}" fill="${L3}"/>` +
        `<path d="M ${x - 74} ${HZ + 26} Q ${x} ${HZ + 84}, ${x + 74} ${HZ + 26} Q ${x} ${HZ + 52}, ${x - 74} ${HZ + 26} Z" fill="${L3}"/>`
      ).join("") +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 226, high: HZ + 208, steps: 8, jag: 1.1, seed: "sg-near", fill: L3 }),
  },

  CN: {
    hue: "coral",
    build: () =>
      karsts({ xs: [96, 250, 980, 1128], baseY: HZ + 14, h: 250, fill: L1, seed: "cn-k" }) +
      ridge({ x0: 240, x1: 1000, baseY: HZ + 40, low: HZ - 10, high: HZ - 120, steps: 13, jag: 1.9, seed: "cn-far", fill: L1, spiky: true }) +
      // A wall running the ridge, with towers on it.
      // The wall: a thick ramp with a parapet on it, rather than a stroke.
      `<path d="M 170 ${HZ + 150} Q 420 ${HZ + 34}, 620 ${HZ + 88} Q 840 ${HZ + 150}, 1070 ${HZ + 62} L 1070 ${HZ + 128} Q 840 ${HZ + 214}, 620 ${HZ + 152} Q 420 ${HZ + 98}, 170 ${HZ + 214} Z" fill="${L2}"/>` +
      Array.from({ length: 15 }, (_, i) => {
        const t = i / 14;
        const x = 180 + t * 880;
        // Follow the ramp's own curve so the merlons sit on it.
        const y = HZ + 150 + (34 - 150) * (1 - Math.pow(2 * t - 1, 2)) * 0.9 + t * 40;
        return `<rect x="${Math.round(x)}" y="${Math.round(y - 26)}" width="16" height="26" fill="${L2}"/>`;
      }).join("") +
      tower({ x: 386, baseY: HZ + 84, w: 52, h: 74, fill: L2, cap: "step" }) +
      tower({ x: 792, baseY: HZ + 134, w: 52, h: 74, fill: L2, cap: "step" }) +
      tiers({ cx: 610, baseY: HZ + 226, w: 200, h: 150, count: 3, fill: L3 }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 232, high: HZ + 210, steps: 8, jag: 1.1, seed: "cn-near", fill: L3 }),
  },

  PK: {
    hue: "violet",
    build: () =>
      ridge({ x0: -80, x1: 1280, baseY: HZ + 30, low: HZ - 40, high: HZ - 380, steps: 17, jag: 2.2, seed: "pk-far", fill: L1, snow: "#F2ECFF", spiky: true }) +
      ridge({ x0: -80, x1: 1280, baseY: HZ + 130, low: HZ + 60, high: HZ - 190, steps: 13, jag: 1.8, seed: "pk-mid", fill: L2, spiky: true }) +
      dome({ cx: 600, baseY: HZ + 252, r: 104, fill: L3 }) +
      minaret({ x: 432, baseY: HZ + 252, h: 270, w: 30, fill: L3 }) +
      minaret({ x: 742, baseY: HZ + 252, h: 270, w: 30, fill: L3 }) +
      archRow({ x0: 512, count: 3, w: 58, baseY: HZ + 250, h: 84, fill: L1, pointed: true }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 250, high: HZ + 236, steps: 8, jag: 1.1, seed: "pk-near", fill: L3 }),
  },

  AE: {
    hue: "amber",
    build: () =>
      dunes({ baseY: HZ + 30, w: W, count: 3, fill: L1, seed: "ae-d", amp: 70 }) +
      tower({ x: 576, baseY: HZ + 40, w: 48, h: 340, fill: L1, cap: "taper" }) +
      tower({ x: 470, baseY: HZ + 40, w: 40, h: 196, fill: L2, cap: "spire" }) +
      tower({ x: 660, baseY: HZ + 40, w: 44, h: 224, fill: L2, cap: "step" }) +
      tower({ x: 356, baseY: HZ + 40, w: 36, h: 140, fill: L2 }) +
      tower({ x: 748, baseY: HZ + 40, w: 34, h: 158, fill: L2 }) +
      dunes({ baseY: HZ + 170, w: W, count: 3, fill: L2, seed: "ae-d2", amp: 96 }) +
      dunes({ baseY: H + 30, w: W, count: 2, fill: L3, seed: "ae-d3", amp: 130 }),
  },

  US: {
    hue: "amber",
    build: () =>
      // Mesa country behind, a span in front: the two American horizons.
      `<path d="M -60 ${HZ + 10} L -60 ${HZ - 96} L 150 ${HZ - 96} L 178 ${HZ - 66} L 320 ${HZ - 66} L 348 ${HZ + 10} Z" fill="${L1}"/>` +
      `<path d="M 880 ${HZ + 10} L 908 ${HZ - 130} L 1090 ${HZ - 130} L 1116 ${HZ - 88} L 1260 ${HZ - 88} L 1260 ${HZ + 10} Z" fill="${L1}"/>` +
      ridge({ x0: -60, x1: 1260, baseY: HZ + 70, low: HZ + 40, high: HZ - 24, steps: 12, jag: 1.4, seed: "us-mid", fill: L2 }) +
      span({ x0: 120, x1: 1080, baseY: H, deckY: HZ + 150, towerH: 200, fill: L3 }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 244, high: HZ + 222, steps: 8, jag: 1.1, seed: "us-near", fill: L3 }),
  },

  GB: {
    hue: "steel",
    build: () =>
      ridge({ x0: -60, x1: 1260, baseY: HZ + 26, low: HZ + 12, high: HZ - 30, steps: 16, jag: 1.2, seed: "gb-far", fill: L1 }) +
      // A clock tower and a dome facing each other across the river.
      tower({ x: 300, baseY: HZ + 26, w: 56, h: 300, fill: L1, cap: "taper" }) +
      `<rect x="298" y="${HZ - 258}" width="60" height="60" fill="${L2}"/>` +
      dome({ cx: 880, baseY: HZ + 26, r: 96, fill: L1 }) +
      tower({ x: 520, baseY: HZ + 26, w: 44, h: 150, fill: L2, cap: "step" }) +
      tower({ x: 600, baseY: HZ + 26, w: 60, h: 196, fill: L2 }) +
      tower({ x: 1040, baseY: HZ + 26, w: 50, h: 168, fill: L2, cap: "spire" }) +
      archRow({ x0: 120, count: 9, w: 108, baseY: HZ + 200, h: 118, fill: L2 }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 230, high: HZ + 212, steps: 8, jag: 1.1, seed: "gb-near", fill: L3 }),
  },

  IT: {
    hue: "amber",
    build: () =>
      ridge({ x0: -60, x1: 1260, baseY: HZ + 20, low: HZ, high: HZ - 74, steps: 14, jag: 1.5, seed: "it-far", fill: L1 }) +
      dome({ cx: 560, baseY: HZ + 20, r: 118, fill: L1 }) +
      tower({ x: 740, baseY: HZ + 20, w: 44, h: 236, fill: L1, cap: "step" }) +
      archRow({ x0: 210, count: 7, w: 86, baseY: HZ + 150, h: 104, fill: L2 }) +
      // Cypresses, which are the Italian landscape in one shape.
      [96, 150, 1010, 1070, 1128].map((x, i) =>
        `<path d="M ${x} ${HZ + 250} Q ${x - 18} ${HZ + 120 - i * 6}, ${x} ${HZ + 40 - i * 10} Q ${x + 18} ${HZ + 120 - i * 6}, ${x} ${HZ + 250} Z" fill="${L3}"/>`
      ).join("") +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 234, high: HZ + 214, steps: 8, jag: 1.1, seed: "it-near", fill: L3 }),
  },

  AU: {
    hue: "coral",
    build: () =>
      // The monolith: long, low, and rounded at one end.
      `<path d="M 300 ${HZ + 10} Q 316 ${HZ - 150}, 520 ${HZ - 176} L 860 ${HZ - 168} Q 930 ${HZ - 130}, 940 ${HZ + 10} Z" fill="${L1}"/>` +
      ridge({ x0: -80, x1: 1280, baseY: HZ + 92, low: HZ + 74, high: HZ + 34, steps: 12, jag: 1.2, seed: "au-mid", fill: L2 }) +
      gum({ x: 180, baseY: H + 10, h: 360, fill: L3, seed: "au-g1" }) +
      gum({ x: 1030, baseY: H + 10, h: 300, fill: L3, seed: "au-g2" }) +
      gum({ x: 940, baseY: H + 10, h: 240, fill: L3, seed: "au-g3" }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 228, high: HZ + 206, steps: 8, jag: 1.1, seed: "au-near", fill: L3 }) +
      birds({ cx: 700, cy: 200, n: 5, s: 11, fill: "#FFC59B", seed: "au-b" }),
  },

  NZ: {
    hue: "cyan",
    build: () =>
      ridge({ x0: -80, x1: 1280, baseY: HZ + 20, low: HZ - 40, high: HZ - 330, steps: 15, jag: 2.0, seed: "nz-far", fill: L1, snow: "#E8F7FF", spiky: true }) +
      ridge({ x0: -80, x1: 1280, baseY: HZ + 110, low: HZ + 30, high: HZ - 120, steps: 11, jag: 1.7, seed: "nz-mid", fill: L2, spiky: true }) +
      // Still water: the near range again, upside down and faint.
      `<g transform="translate(0 ${2 * (HZ + 150)}) scale(1 -1)" opacity=".22">` +
      ridge({ x0: -80, x1: 1280, baseY: HZ + 110, low: HZ + 40, high: HZ - 80, steps: 13, jag: 2.4, seed: "nz-mid", fill: "#6EE7FF" }) +
      `</g>` +
      fern({ x: 140, baseY: H + 20, h: 340, fill: L3, seed: "nz-f1" }) +
      fern({ x: 1070, baseY: H + 20, h: 300, fill: L3, seed: "nz-f2" }) +
      ridge({ x0: -60, x1: 1260, baseY: H + 10, low: HZ + 240, high: HZ + 224, steps: 8, jag: 1.1, seed: "nz-near", fill: L3 }),
  },
};

/** The finished SVG for one country. */
export function plate(iso) {
  const scene = SCENES[iso];
  if (!scene) return null;
  const pal = PALETTES[scene.hue];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.sky[0]}"/>
      <stop offset="42%" stop-color="${pal.sky[1]}"/>
      <stop offset="74%" stop-color="${pal.sky[2]}"/>
      <stop offset="100%" stop-color="${pal.sky[3]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="${((HZ - 30) / H) * 100}%" r="46%">
      <stop offset="0%" stop-color="${pal.sun}" stop-opacity=".55"/>
      <stop offset="100%" stop-color="${pal.sun}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#04060F" stop-opacity="0"/>
      <stop offset="100%" stop-color="#04060F" stop-opacity=".62"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="${W / 2}" cy="${HZ - 34}" r="86" fill="${pal.sun}" opacity=".5"/>

  ${scene.build()}

  <rect y="${H * 0.64}" width="${W}" height="${H * 0.36}" fill="url(#foot)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity=".07"/>
</svg>`;
}
