/**
 * A small vocabulary of shapes, so thirteen destination plates are thirteen
 * compositions rather than thirteen drawings.
 *
 * Everything here returns an SVG fragment as a string and takes its geometry in
 * the plate's own coordinate space (1200 by 750). Nothing is traced from a
 * photograph or a map: a ridge is a noise walk between two heights, a dome is
 * an arc, a tower is a rectangle with a hat. That is the whole point. The
 * pictures have to be ours, and the cheapest way to be certain they are ours is
 * for every line in them to come out of a function somebody here wrote.
 */

/** Deterministic pseudo random, so a plate is identical on every build. */
export function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const n = (v) => Math.round(v * 10) / 10;

/** A closed silhouette from a top profile, dropped to the base line. */
export function silhouette(points, baseY, fill, extra = "") {
  const d =
    `M ${n(points[0][0])} ${n(baseY)} ` +
    points.map(([x, y]) => `L ${n(x)} ${n(y)}`).join(" ") +
    ` L ${n(points[points.length - 1][0])} ${n(baseY)} Z`;
  return `<path d="${d}" fill="${fill}" ${extra}/>`;
}

/**
 * A mountain range: a walk between a floor and a ceiling with occasional
 * peaks, shaped by how jagged the country is meant to feel.
 */
export function ridge({ x0, x1, baseY, low, high, steps, jag, seed, fill, snow, spiky }) {
  const r = rng(seed);
  const pts = [];

  if (spiky) {
    /*
     * Alternating saddles and summits, with nothing smoothing between them.
     *
     * The rolling version below averages each point with the last, which is
     * what a worn range looks like and is exactly wrong for the Karakoram and
     * the Southern Alps: both came out as hills with snow on top. Here a
     * summit is a point and a saddle is a point and the line between them is
     * straight, which is what makes a mountain read as rock rather than as
     * landscape.
     */
    /*
     * Uniform spacing is the tell. Evenly spaced summits of similar height read
     * as a row of triangles drawn by hand, which is what the first jagged
     * version looked like. Both the spacing and the height are jittered, and a
     * summit is allowed to be small: a range where every peak is a record is
     * not a range, it is a saw blade.
     */
    let t = 0;
    let i = 0;
    while (t < 1) {
      const wide = 0.4 + r() * 1.5;
      const x = x0 + (x1 - x0) * Math.min(1, t);
      const summit = i % 2 === 1;
      const k = Math.pow(r(), 1 / jag);
      const y = summit
        ? low + (high - low) * (0.25 + k * 0.75)
        : low - (low - high) * (r() * 0.26);
      const tt = Math.min(1, t);
      const edge = Math.min(1, Math.min(tt, 1 - tt) * 3.4);
      pts.push([x, baseY - (baseY - y) * (0.36 + edge * 0.64)]);
      t += wide / steps;
      i++;
    }
    pts.push([x1, baseY - (baseY - low) * 0.36]);
  } else {
    let y = low;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const target = low + (high - low) * Math.pow(r(), 1 / jag);
      y = y * 0.45 + target * 0.55;
      const edge = Math.min(t, 1 - t) * 2;
      pts.push([x, baseY - (baseY - y) * Math.min(1, 0.35 + edge * 1.2)]);
    }
  }

  let out = silhouette(pts, baseY, fill);
  if (snow) {
    const tops = pts
      .map((p, i) => ({ p, i }))
      .sort((a, b) => a.p[1] - b.p[1])
      .slice(0, 4);
    for (const { p } of tops) {
      const w = 30 + r() * 26;
      const h = 22 + r() * 20;
      out += `<path d="M ${n(p[0] - w)} ${n(p[1] + h)} L ${n(p[0])} ${n(p[1])} L ${n(p[0] + w)} ${n(p[1] + h)} L ${n(p[0] + w * 0.3)} ${n(p[1] + h * 0.62)} L ${n(p[0] - w * 0.2)} ${n(p[1] + h * 0.9)} Z" fill="${snow}" opacity=".85"/>`;
    }
  }
  return out;
}

/** A single cone, the shape a volcano and a classic mountain share. */
export function cone({ cx, baseY, w, h, fill, snow, crater }) {
  const half = w / 2;
  const topW = crater ? w * 0.13 : 0;
  const pts = [
    [cx - half, baseY],
    [cx - topW, baseY - h],
    [cx + topW, baseY - h],
    [cx + half, baseY],
  ];
  let out = `<path d="M ${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L ")} Z" fill="${fill}"/>`;
  if (snow) {
    const sy = baseY - h * 0.74;
    const sw = (half * (h - (h - h * 0.74))) / h;
    void sw;
    const spread = half * 0.28;
    out += `<path d="M ${n(cx - spread)} ${n(sy)} L ${n(cx - topW)} ${n(baseY - h)} L ${n(cx + topW)} ${n(baseY - h)} L ${n(cx + spread)} ${n(sy)} L ${n(cx + spread * 0.45)} ${n(sy - h * 0.06)} L ${n(cx - spread * 0.2)} ${n(sy - h * 0.02)} Z" fill="${snow}" opacity=".9"/>`;
  }
  return out;
}

/** Limestone stacks standing out of water. */
export function karsts({ xs, baseY, h, fill, seed }) {
  const r = rng(seed);
  return xs
    .map((x) => {
      const hh = h * (0.42 + r() * 1.0);
      /*
       * Three goes at this were wrong in three directions. A third as wide as
       * tall came out a conifer; two thirds a shrub; straight sided with a
       * domed top, a gravestone. What actually reads is a tower that swells at
       * the base, pinches in as it rises, and closes to something near a point
       * with the cap off centre, with the heights spread wide enough that no
       * two in a row match.
       */
      const w = hh * (0.3 + r() * 0.16);
      const lean = (r() - 0.5) * w * 0.3;
      // The cap is narrower than the base and sits off centre, which is what
      // stops a row of these reading as gravestones. Straight sides with a
      // rounded top is exactly a gravestone, and that is what the last attempt
      // drew.
      const capW = w * (0.16 + r() * 0.16);
      const capY = baseY - hh * (0.66 + r() * 0.14);
      const off = (r() - 0.5) * w * 0.24;
      return `<path d="M ${n(x - w / 2)} ${n(baseY)} C ${n(x - w * 0.46 + lean)} ${n(baseY - hh * 0.4)}, ${n(x - capW + lean + off)} ${n(capY + hh * 0.08)}, ${n(x - capW + lean + off)} ${n(capY)} Q ${n(x - capW * 0.6 + lean + off)} ${n(baseY - hh)}, ${n(x + lean + off)} ${n(baseY - hh)} Q ${n(x + capW * 0.8 + lean + off)} ${n(baseY - hh * 0.97)}, ${n(x + capW + lean + off)} ${n(capY)} C ${n(x + capW + lean + off)} ${n(capY + hh * 0.1)}, ${n(x + w * 0.48)} ${n(baseY - hh * 0.36)}, ${n(x + w / 2)} ${n(baseY)} Z" fill="${fill}"/>`;
    })
    .join("");
}

/** A block with a flat, stepped or spired hat. Cities are made of these. */
export function tower({ x, baseY, w, h, fill, cap = "flat", opacity = 1 }) {
  let out = `<rect x="${n(x)}" y="${n(baseY - h)}" width="${n(w)}" height="${n(h)}" fill="${fill}" opacity="${opacity}"/>`;
  const cx = x + w / 2;
  if (cap === "spire") {
    out += `<path d="M ${n(cx - w * 0.16)} ${n(baseY - h)} L ${n(cx)} ${n(baseY - h - h * 0.34)} L ${n(cx + w * 0.16)} ${n(baseY - h)} Z" fill="${fill}" opacity="${opacity}"/>`;
  } else if (cap === "step") {
    out += `<rect x="${n(x + w * 0.18)}" y="${n(baseY - h - h * 0.1)}" width="${n(w * 0.64)}" height="${n(h * 0.1)}" fill="${fill}" opacity="${opacity}"/>`;
    out += `<rect x="${n(x + w * 0.36)}" y="${n(baseY - h - h * 0.2)}" width="${n(w * 0.28)}" height="${n(h * 0.1)}" fill="${fill}" opacity="${opacity}"/>`;
  } else if (cap === "crown") {
    out += `<path d="M ${n(x - w * 0.42)} ${n(baseY - h)} Q ${n(cx)} ${n(baseY - h - h * 0.16)}, ${n(x + w * 1.42)} ${n(baseY - h)} L ${n(x + w * 1.42)} ${n(baseY - h + h * 0.05)} Q ${n(cx)} ${n(baseY - h - h * 0.1)}, ${n(x - w * 0.42)} ${n(baseY - h + h * 0.05)} Z" fill="${fill}" opacity="${opacity}"/>`;
  } else if (cap === "taper") {
    out += `<path d="M ${n(x)} ${n(baseY - h)} L ${n(cx)} ${n(baseY - h - h * 0.55)} L ${n(x + w)} ${n(baseY - h)} Z" fill="${fill}" opacity="${opacity}"/>`;
  }
  return out;
}

/** A dome on a drum, which is half the skylines in the world. */
export function dome({ cx, baseY, r: rad, fill, lantern = true }) {
  let out = `<path d="M ${n(cx - rad)} ${n(baseY)} L ${n(cx - rad)} ${n(baseY - rad * 0.25)} A ${n(rad)} ${n(rad * 1.12)} 0 0 1 ${n(cx + rad)} ${n(baseY - rad * 0.25)} L ${n(cx + rad)} ${n(baseY)} Z" fill="${fill}"/>`;
  if (lantern) {
    out += `<rect x="${n(cx - rad * 0.12)}" y="${n(baseY - rad * 1.55)}" width="${n(rad * 0.24)}" height="${n(rad * 0.24)}" fill="${fill}"/>`;
    out += `<path d="M ${n(cx)} ${n(baseY - rad * 1.55)} L ${n(cx)} ${n(baseY - rad * 1.78)}" stroke="${fill}" stroke-width="${n(rad * 0.07)}"/>`;
  }
  return out;
}

/** A pointed arch, for a gate or a colonnade. */
export function archRow({ x0, count, w, baseY, h, fill, pointed = false }) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = x0 + i * w * 1.18;
    const cx = x + w / 2;
    out += pointed
      ? `<path d="M ${n(x)} ${n(baseY)} L ${n(x)} ${n(baseY - h * 0.55)} Q ${n(cx)} ${n(baseY - h * 1.18)}, ${n(x + w)} ${n(baseY - h * 0.55)} L ${n(x + w)} ${n(baseY)} Z" fill="${fill}"/>`
      : `<path d="M ${n(x)} ${n(baseY)} L ${n(x)} ${n(baseY - h * 0.6)} A ${n(w / 2)} ${n(w / 2)} 0 0 1 ${n(x + w)} ${n(baseY - h * 0.6)} L ${n(x + w)} ${n(baseY)} Z" fill="${fill}"/>`;
  }
  return out;
}

/** A tiered roof, the pagoda and the temple hall in one function. */
export function tiers({ cx, baseY, w, h, count, fill, finial = true }) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const tw = w * (1 - t * 0.55);
    const y = baseY - (h / count) * i;
    const th = h / count;
    out += `<rect x="${n(cx - tw * 0.32)}" y="${n(y - th)}" width="${n(tw * 0.64)}" height="${n(th)}" fill="${fill}"/>`;
    out += `<path d="M ${n(cx - tw / 2)} ${n(y - th)} Q ${n(cx - tw * 0.3)} ${n(y - th - th * 0.42)}, ${n(cx)} ${n(y - th - th * 0.34)} Q ${n(cx + tw * 0.3)} ${n(y - th - th * 0.42)}, ${n(cx + tw / 2)} ${n(y - th)} Z" fill="${fill}"/>`;
  }
  if (finial) {
    const topY = baseY - h - h * 0.1;
    out += `<path d="M ${n(cx)} ${n(topY)} L ${n(cx)} ${n(topY - h * 0.14)}" stroke="${fill}" stroke-width="${n(w * 0.035)}"/>`;
  }
  return out;
}

/** A gate of two posts and two beams. */
export function torii({ cx, baseY, w, h, fill }) {
  const t = w * 0.075;
  return (
    `<rect x="${n(cx - w / 2)}" y="${n(baseY - h)}" width="${n(t)}" height="${n(h)}" fill="${fill}"/>` +
    `<rect x="${n(cx + w / 2 - t)}" y="${n(baseY - h)}" width="${n(t)}" height="${n(h)}" fill="${fill}"/>` +
    `<path d="M ${n(cx - w * 0.6)} ${n(baseY - h)} Q ${n(cx)} ${n(baseY - h - h * 0.12)}, ${n(cx + w * 0.6)} ${n(baseY - h)} L ${n(cx + w * 0.6)} ${n(baseY - h + t * 0.9)} Q ${n(cx)} ${n(baseY - h - h * 0.04)}, ${n(cx - w * 0.6)} ${n(baseY - h + t * 0.9)} Z" fill="${fill}"/>` +
    `<rect x="${n(cx - w * 0.44)}" y="${n(baseY - h * 0.78)}" width="${n(w * 0.88)}" height="${n(t * 0.8)}" fill="${fill}"/>`
  );
}

/** A minaret: a thin shaft, a balcony, a small cap. */
export function minaret({ x, baseY, h, w, fill }) {
  return (
    `<rect x="${n(x)}" y="${n(baseY - h)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>` +
    `<rect x="${n(x - w * 0.4)}" y="${n(baseY - h * 0.72)}" width="${n(w * 1.8)}" height="${n(w * 0.5)}" fill="${fill}"/>` +
    `<path d="M ${n(x - w * 0.25)} ${n(baseY - h)} Q ${n(x + w / 2)} ${n(baseY - h - w * 1.5)}, ${n(x + w * 1.25)} ${n(baseY - h)} Z" fill="${fill}"/>`
  );
}

/** Palms, as a trunk and a fan of fronds. */
export function palm({ x, baseY, h, fill, seed }) {
  const r = rng(seed);
  const lean = (r() - 0.5) * h * 0.22;
  const topX = x + lean;
  const topY = baseY - h;
  let out = `<path d="M ${n(x - h * 0.018)} ${n(baseY)} Q ${n(x + lean * 0.4)} ${n(baseY - h * 0.6)}, ${n(topX)} ${n(topY)} L ${n(topX + h * 0.02)} ${n(topY)} Q ${n(x + lean * 0.4 + h * 0.02)} ${n(baseY - h * 0.6)}, ${n(x + h * 0.018)} ${n(baseY)} Z" fill="${fill}"/>`;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.92 + (i / 6) * Math.PI * 0.84;
    const len = h * (0.3 + r() * 0.16);
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.62 + len * 0.2;
    out += `<path d="M ${n(topX)} ${n(topY)} Q ${n((topX + ex) / 2)} ${n((topY + ey) / 2 - len * 0.28)}, ${n(ex)} ${n(ey)} Q ${n((topX + ex) / 2)} ${n((topY + ey) / 2 - len * 0.12)}, ${n(topX)} ${n(topY)} Z" fill="${fill}"/>`;
  }
  return out;
}

/** Tree ferns, which read as nowhere else on earth. */
export function fern({ x, baseY, h, fill, seed }) {
  const r = rng(seed);
  let out = `<rect x="${n(x - h * 0.022)}" y="${n(baseY - h * 0.72)}" width="${n(h * 0.044)}" height="${n(h * 0.72)}" fill="${fill}"/>`;
  const topY = baseY - h * 0.72;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI;
    const len = h * (0.46 + r() * 0.16);
    const ex = x + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.5 + len * 0.34;
    out += `<path d="M ${n(x)} ${n(topY)} Q ${n((x + ex) / 2)} ${n((topY + ey) / 2 - len * 0.34)}, ${n(ex)} ${n(ey)} Q ${n((x + ex) / 2)} ${n((topY + ey) / 2 - len * 0.16)}, ${n(x)} ${n(topY)} Z" fill="${fill}"/>`;
  }
  return out;
}

/** Gum trees: a bare trunk, a high open crown. */
export function gum({ x, baseY, h, fill, seed }) {
  const r = rng(seed);
  /*
   * A eucalypt is a pale bare trunk that goes up a long way and then opens
   * into a thin, uneven canopy you can see sky through. The first version gave
   * it a short trunk and a ring of equal ellipses, which is a lollipop, and
   * thirteen plates can survive one weak shape but not a cartoon one.
   */
  const forkY = baseY - h * 0.62;
  let out = `<path d="M ${n(x - h * 0.016)} ${n(baseY)} Q ${n(x + h * 0.026)} ${n(baseY - h * 0.34)}, ${n(x + h * 0.004)} ${n(forkY)} L ${n(x + h * 0.026)} ${n(forkY)} Q ${n(x + h * 0.05)} ${n(baseY - h * 0.34)}, ${n(x + h * 0.022)} ${n(baseY)} Z" fill="${fill}"/>`;

  const limbs = 4 + Math.floor(r() * 2);
  for (let i = 0; i < limbs; i++) {
    const a = -Math.PI * 0.86 + (i / (limbs - 1)) * Math.PI * 0.72 + (r() - 0.5) * 0.3;
    const len = h * (0.2 + r() * 0.2);
    const ex = x + Math.cos(a) * len;
    const ey = forkY + Math.sin(a) * len * 0.9;
    out += `<path d="M ${n(x + h * 0.012)} ${n(forkY)} Q ${n(x + Math.cos(a) * len * 0.45)} ${n(forkY + Math.sin(a) * len * 0.2)}, ${n(ex)} ${n(ey)}" stroke="${fill}" stroke-width="${n(h * 0.011)}" fill="none" stroke-linecap="round"/>`;
    // Two or three loose clumps along the limb rather than one neat ball.
    const clumps = 2 + Math.floor(r() * 2);
    for (let c = 0; c < clumps; c++) {
      const t = 0.55 + (c / clumps) * 0.5;
      const cx = x + Math.cos(a) * len * t + (r() - 0.5) * len * 0.24;
      const cy = forkY + Math.sin(a) * len * 0.9 * t + (r() - 0.5) * len * 0.2;
      const rx = len * (0.16 + r() * 0.14);
      out += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(rx * (0.5 + r() * 0.3))}" transform="rotate(${Math.round((r() - 0.5) * 70)} ${n(cx)} ${n(cy)})" fill="${fill}" opacity="${(0.72 + r() * 0.28).toFixed(2)}"/>`;
    }
  }
  return out;
}

/** Dunes, as stacked soft crests. */
export function dunes({ baseY, w, count, fill, seed, amp }) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const y = baseY - i * amp * 0.34;
    const cx = w * (0.1 + r() * 0.8);
    const span = w * (0.5 + r() * 0.6);
    out += `<path d="M ${n(cx - span)} ${n(y + amp)} Q ${n(cx - span * 0.3)} ${n(y - amp * 0.9)}, ${n(cx + span * 0.2)} ${n(y - amp * 0.1)} Q ${n(cx + span * 0.7)} ${n(y + amp * 0.5)}, ${n(cx + span)} ${n(y + amp)} Z" fill="${fill}" opacity="${0.9 - i * 0.1}"/>`;
  }
  return out;
}

/** Terraced steps cut into a slope. */
export function terraces({ x0, x1, baseY, rows, fill }) {
  let out = "";
  for (let i = 0; i < rows; i++) {
    const t = i / rows;
    const y = baseY - i * 14;
    const inset = (x1 - x0) * 0.07 * i;
    out += `<path d="M ${n(x0 + inset)} ${n(y)} Q ${n((x0 + x1) / 2)} ${n(y - 16 - i * 2)}, ${n(x1 - inset)} ${n(y)} L ${n(x1 - inset)} ${n(y + 9)} Q ${n((x0 + x1) / 2)} ${n(y - 7 - i * 2)}, ${n(x0 + inset)} ${n(y + 9)} Z" fill="${fill}" opacity="${(0.95 - i * 0.07).toFixed(2)}"/>`;
  }
  return out;
}

/** A suspension span: two towers and two curves. */
export function span({ x0, x1, baseY, deckY, towerH, fill }) {
  const t = (x1 - x0) * 0.03;
  const a = x0 + (x1 - x0) * 0.24;
  const b = x0 + (x1 - x0) * 0.76;
  let out = `<rect x="${n(x0)}" y="${n(deckY)}" width="${n(x1 - x0)}" height="${n(baseY - deckY > 0 ? 9 : 9)}" fill="${fill}"/>`;
  for (const tx of [a, b]) {
    out += `<rect x="${n(tx - t / 2)}" y="${n(deckY - towerH)}" width="${n(t)}" height="${n(towerH)}" fill="${fill}"/>`;
    out += `<rect x="${n(tx - t * 1.3)}" y="${n(deckY - towerH * 0.62)}" width="${n(t * 2.6)}" height="${n(t * 0.5)}" fill="${fill}"/>`;
  }
  out += `<path d="M ${n(x0)} ${n(deckY - towerH * 0.5)} Q ${n((x0 + a) / 2)} ${n(deckY + 2)}, ${n(a)} ${n(deckY - towerH)} Q ${n((a + b) / 2)} ${n(deckY + 4)}, ${n(b)} ${n(deckY - towerH)} Q ${n((b + x1) / 2)} ${n(deckY + 2)}, ${n(x1)} ${n(deckY - towerH * 0.5)}" stroke="${fill}" stroke-width="${n(t * 0.28)}" fill="none"/>`;
  return out;
}

/** Birds, because an empty sky reads as unfinished. */
export function birds({ cx, cy, n: count, s, fill, seed }) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = cx + (r() - 0.5) * s * 9;
    const y = cy + (r() - 0.5) * s * 5;
    const k = s * (0.6 + r() * 0.6);
    out += `<path d="M ${n(x - k)} ${n(y)} Q ${n(x - k * 0.5)} ${n(y - k * 0.7)}, ${n(x)} ${n(y - k * 0.08)} Q ${n(x + k * 0.5)} ${n(y - k * 0.7)}, ${n(x + k)} ${n(y)}" stroke="${fill}" stroke-width="${n(k * 0.16)}" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}
