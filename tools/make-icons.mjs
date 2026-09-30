#!/usr/bin/env node
/**
 * Generate the extension icons.
 *
 * Written as a PNG encoder rather than shelling out to a converter so the
 * icons are reproducible on any machine with Node and nothing else, and so
 * they can be regenerated from the brand tokens if those change.
 *
 * The mark is the product: vertical warp threads with a weft crossing only
 * part of them. A full crossing would mean a fully translated page, which is
 * exactly what Weft does not do.
 *
 * To see what this produces without installing anything, run
 * `npm run icons:sheet` after it: `tools/make-icon-sheet.mjs` renders
 * `docs/firstrun/icons.png` from these four PNGs, at actual size on the
 * three backgrounds a toolbar has and magnified at a whole-number factor.
 * Changing the geometry below and not re-running it leaves the sheet
 * describing the old mark; `npm run artefacts:check` reports that.
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');

const WOAD = [47, 75, 124];
const WOAD_LIGHT = [122, 150, 192];

/**
 * How far across the warp the weft reaches.
 *
 * Per-count, because "0.62 of the span" means different things depending on
 * how many threads that span holds. With four warps they sit at 0, 1/3, 2/3
 * and 1, so 0.62 stops *just* short of the third — crossing two, leaving
 * two, and stranding the fourth on its own with a visible gap. The mark then
 * reads as an H with a stray stroke beside it rather than as one woven
 * thing, which is exactly how it looked in the toolbar.
 *
 * Crossing all but the last thread keeps the meaning — a partly woven page,
 * never a fully translated one — while holding together as a single shape.
 */
const CROSSING = { 2: 0.58, 3: 0.62, 4: 0.72 };

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
 * Geometry per size, because one set of proportions cannot serve 16px and
 * 128px at once.
 *
 * The original drew four warp threads at 8.5% of the size with 85% opacity
 * at every size. At 128 that is a clean 11px line. At 16 it is 1.36px of
 * pale blue landing on fractional coordinates, so each thread smeared
 * across two columns at roughly half coverage and the mark dissolved into
 * four grey smudges and a bar — in the toolbar, which is where this icon
 * spends its entire life and is the most-seen thing in the product.
 *
 * So the small sizes get fewer, thicker, fully opaque threads, snapped to
 * whole pixels. Same mark, drawn for the space it has.
 */
const GEOMETRY = {
  // Two threads at 16px, not three. Three 2px verticals with 2px gaps is a
  // picket fence: at a glance it is texture, not a mark. Two thick ones
  // crossed by a bar is still unmistakably thread-over-thread, and it is
  // the only version of this shape that survives sixteen pixels.
  16: { warps: 2, warpFrac: 0.19, weftFrac: 0.28, insetFrac: 0.16, alpha: 1, snap: true },
  32: { warps: 3, warpFrac: 0.115, weftFrac: 0.22, insetFrac: 0.08, alpha: 1, snap: true },
  48: { warps: 4, warpFrac: 0.095, weftFrac: 0.18, insetFrac: 0.09, alpha: 0.95, snap: true },
  // Chrome documents the 128px icon as 96px of artwork inside 16px of
  // transparent padding, so that it sits level with every other extension
  // in the store grid rather than bleeding to the edge.
  128: { warps: 4, warpFrac: 0.085, weftFrac: 0.16, insetFrac: 0.125, alpha: 0.85, snap: false },
};

function icon(size) {
  const g = GEOMETRY[size] ?? GEOMETRY[128];
  const buf = Buffer.alloc(size * size * 4, 0);
  const inset = Math.round(size * g.insetFrac);
  const span = size - inset * 2;

  /*
   * Whole-pixel edges at small sizes.
   *
   * An antialiased 1.4px line straddling a pixel boundary is two columns at
   * ~70% each, which reads as blur rather than as a thread. Rounding the
   * edges — not the centre — keeps the drawn width an exact number of
   * pixels.
   */
  const snap = (v) => (g.snap ? Math.round(v) : v);

  const warpWidth = Math.max(g.snap ? 2 : 1, size * g.warpFrac);
  const pitch = span / (g.warps - 1);
  for (let i = 0; i < g.warps; i++) {
    const cx = inset + i * pitch;
    let x0 = snap(cx - warpWidth / 2);
    let x1 = snap(cx + warpWidth / 2);
    // Rounding can collapse a thin thread to nothing; never let it vanish.
    if (x1 - x0 < 1) x1 = x0 + 1;
    // And never let the last thread fall off the right edge.
    if (x1 > size) {
      x1 = size;
      x0 = Math.min(x0, size - Math.round(warpWidth));
    }
    fillRect(buf, size, size, x0, inset, x1, size - inset, WOAD_LIGHT, g.alpha);
  }

  // Weft: one horizontal thread crossing part of the warp, drawn over it.
  // A full crossing would mean a fully translated page, which is exactly
  // what Weft does not do.
  const weftHeight = Math.max(2, size * g.weftFrac);
  const cy = size / 2;
  const y0 = snap(cy - weftHeight / 2);
  const y1 = Math.max(y0 + 2, snap(cy + weftHeight / 2));
  const left = snap(inset - warpWidth / 2);
  const crossing = CROSSING[g.warps] ?? 0.72;
  const right = snap(inset - warpWidth / 2 + span * crossing + warpWidth);
  fillRect(buf, size, size, Math.max(0, left), y0, Math.min(size, right), y1, WOAD, 1);

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

  // A vector version for the landing page and the store listing.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Weft">
  <title>Weft</title>
  <g stroke="rgb(122 150 192)" stroke-width="11" opacity="0.85">
    <line x1="12.8" y1="12.8" x2="12.8" y2="115.2"/>
    <line x1="46.9" y1="12.8" x2="46.9" y2="115.2"/>
    <line x1="81.1" y1="12.8" x2="81.1" y2="115.2"/>
    <line x1="115.2" y1="12.8" x2="115.2" y2="115.2"/>
  </g>
  <line x1="7.3" y1="64" x2="76.3" y2="64" stroke="rgb(47 75 124)" stroke-width="20.5"/>
</svg>
`;
  /*
   * Written to both places it is served from, because it was committed in
   * both and generated into only one.
   *
   * `site/icon.svg` was a hand-made copy of this exact string — byte-
   * identical when found, which is the only reason it had not yet become a
   * quiet lie. Nothing wrote it, so editing the mark here would have
   * updated the extension and the store listing and left the landing page
   * showing the old one, with `git status` clean and every check green.
   * Same class as the four warp threads this SVG carries and the 16px
   * raster's two: a second copy of a fact drifts, and the fix is to stop
   * having a second copy rather than to remember to update it.
   */
  for (const dest of [join(OUT, 'icon.svg'), join(ROOT, 'site/icon.svg')]) {
    await writeFile(dest, svg);
    console.log(`  ${dest.slice(ROOT.length + 1)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
