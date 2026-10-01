#!/usr/bin/env node
/**
 * Generate the extension icons.
 *
 * Written as a PNG encoder rather than shelling out to a converter so the
 * icons are reproducible on any machine with Node and nothing else, and so
 * they can be regenerated from the brand tokens if those change.
 *
 * Reproducible in their pixels, that is. The bytes depend on the zlib the
 * Node binary was built against: measured on 2026-10-01, the 128px icon is
 * 431 bytes under a Node linked to zlib 1.2.12 and 432 under the official
 * Node 22 build, with every decoded pixel equal. So a different machine may
 * rewrite `icon-128.png` without changing it, and anything that checks
 * these files should decode them rather than diff them.
 *
 * The mark is the product: vertical warp threads with a weft crossing only
 * part of them. A full crossing would mean a fully translated page, which is
 * exactly what Weft does not do. What it looks like at each size is
 * `tools/brand.ts`; this file turns that into four PNGs and one SVG.
 *
 * To see what this produces without installing anything, run
 * `npm run icons:sheet` after it: `tools/make-icon-sheet.mjs` renders
 * `docs/firstrun/icons.png` from these four PNGs, at actual size on the
 * three backgrounds a toolbar has and magnified at a whole-number factor.
 *
 * Changing the geometry and re-running only this leaves three other things
 * describing the old mark — that sheet, the store tiles (`npm run tiles`)
 * and the social card (`npm run og`). `npm run artefacts:check` names each
 * as stale. For the tiles and the card `tests/tools/brand.test.ts` goes
 * further and reads the mark back out of the committed pixels, so a weft
 * that crosses the wrong number of threads there fails the build.
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WOAD, WOAD_LIGHT, markGeometry, iconSvg } from './brand.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encode RGBA pixel data as a PNG. */
function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each scanline is prefixed with a filter byte; filter 0 is "none".
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Antialiased axis-aligned rectangle fill with alpha coverage. */
function fillRect(buf, width, height, x0, y0, x1, y1, colour, alpha = 1) {
  const lo = (v, max) => Math.max(0, Math.min(max, v));
  for (let py = Math.floor(lo(y0, height)); py < Math.ceil(lo(y1, height)); py++) {
    const covY = Math.min(py + 1, y1) - Math.max(py, y0);
    if (covY <= 0) continue;
    for (let px = Math.floor(lo(x0, width)); px < Math.ceil(lo(x1, width)); px++) {
      const covX = Math.min(px + 1, x1) - Math.max(px, x0);
      if (covX <= 0) continue;
      const a = covX * covY * alpha;
      const i = (py * width + px) * 4;
      const srcA = a;
      const dstA = buf[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) continue;
      for (let c = 0; c < 3; c++) {
        const src = colour[c] / 255;
        const dst = buf[i + c] / 255;
        buf[i + c] = Math.round(((src * srcA + dst * dstA * (1 - srcA)) / outA) * 255);
      }
      buf[i + 3] = Math.round(outA * 255);
    }
  }
}

/**
 * One icon: the mark's boxes, filled.
 *
 * What the boxes are — how many threads, how thick, how far the weft
 * reaches at each size — is `markGeometry` in `tools/brand.ts`, which is
 * also what the vector below and every other drawing of the mark is written
 * from. This file only knows how to turn boxes into a PNG.
 */
function icon(size) {
  const { warps, weft, warpAlpha } = markGeometry(size);
  const buf = Buffer.alloc(size * size * 4, 0);
  for (const w of warps) fillRect(buf, size, size, w.x0, w.y0, w.x1, w.y1, WOAD_LIGHT, warpAlpha);
  // Drawn after the warp, so it lies over the threads it crosses.
  fillRect(buf, size, size, weft.x0, weft.y0, weft.x1, weft.y1, WOAD, 1);
  return png(size, size, buf);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const data = icon(size);
    await writeFile(join(OUT, `icon-${size}.png`), data);
    console.log(`  assets/icon-${size}.png  ${data.length} bytes`);
  }

  /*
   * The same mark as a vector, written to both places it is served from.
   *
   * It is `iconSvg()` and not a string in this file, because it used to be
   * a string in this file: when `0d9910e` redrew the mark it changed the
   * geometry, which then lived here too, and left the vector a screen
   * further down describing the old one. `site/icon.svg` was a further
   * hand-made copy of that string — byte-identical when found, which is the
   * only reason it had not become a second quiet lie on top of the first.
   * A second copy of a fact drifts, and the fix is to stop having a second
   * copy rather than to remember to update it.
   */
  const svg = iconSvg();
  for (const dest of [join(OUT, 'icon.svg'), join(ROOT, 'site/icon.svg')]) {
    await writeFile(dest, svg);
    console.log(`  ${dest.slice(ROOT.length + 1)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
