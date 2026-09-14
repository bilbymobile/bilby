/**
 * Render the destination plates to WebP.
 *
 * Run with:
 *   node scripts/build-destination-art.mjs
 *
 * Writes public/destinations/<iso>.webp, which is what the cards look for
 * first. Committed rather than generated at build time: they change when
 * somebody edits a scene, which is rarely, and a deployment should not depend
 * on a rasteriser being present.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

import { SCENES, plate, W, H } from "./art/scenes.mjs";

const out = resolve(import.meta.dirname, "..", "public", "destinations");
mkdirSync(out, { recursive: true });

let total = 0;
for (const iso of Object.keys(SCENES)) {
  const svg = plate(iso);
  const buf = await sharp(Buffer.from(svg), { density: 96 })
    .resize(W, H)
    .webp({ quality: 82, effort: 6 })
    .toBuffer();
  const file = resolve(out, `${iso.toLowerCase()}.webp`);
  writeFileSync(file, buf);
  total += buf.length;
  console.log(`${iso.toLowerCase()}.webp  ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log(`\n${Object.keys(SCENES).length} plates, ${(total / 1024).toFixed(0)} KB total`);
