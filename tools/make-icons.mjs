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
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');

const WOAD = [47, 75, 124];
const WOAD_LIGHT = [122, 150, 192];

/** Proportion of the warp the weft crosses. */
const CROSSING = 0.62;

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

function icon(size) {
  const buf = Buffer.alloc(size * size * 4, 0);
  const inset = size * 0.1;
  const span = size - inset * 2;

  // Warp: vertical threads. Four at every size keeps the mark readable at 16px.
  const warps = 4;
  const warpWidth = Math.max(1, size * 0.085);
  const pitch = span / (warps - 1);
  for (let i = 0; i < warps; i++) {
    const cx = inset + i * pitch;
    fillRect(
      buf,
      size,
      size,
      cx - warpWidth / 2,
      inset,
      cx + warpWidth / 2,
      size - inset,
      WOAD_LIGHT,
      0.85,
    );
  }

  // Weft: one horizontal thread crossing part of the warp, drawn over it.
  const weftHeight = Math.max(2, size * 0.16);
  const cy = size / 2;
  fillRect(
    buf,
    size,
    size,
    inset - warpWidth / 2,
    cy - weftHeight / 2,
    inset - warpWidth / 2 + span * CROSSING + warpWidth,
    cy + weftHeight / 2,
    WOAD,
    1,
  );

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
  await writeFile(join(OUT, 'icon.svg'), svg);
  console.log('  assets/icon.svg');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
