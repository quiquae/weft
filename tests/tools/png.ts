/**
 * Decode a committed PNG far enough to look at its pixels.
 *
 * Shared, because "open the file and look" is the only check that has ever
 * found a wrong committed image in this repository — a blank half-sheet, a
 * clipped row, a superseded mark — and each test that automates it needs the
 * same forty lines. Not a `.test.ts`, so the `tests/tools/*.test.ts` glob
 * does not run it as a suite of nothing.
 */
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

export interface Bitmap {
  width: number;
  height: number;
  /** Bytes per pixel: 3 for RGB, 4 for RGBA. */
  bpp: number;
  data: Buffer;
}

/**
 * Written out rather than taken as a dependency for the same reason
 * `tools/make-icons.mjs` encodes PNGs by hand: this has to run on any
 * machine with Node and nothing else, and the subset needed is small.
 * 8-bit RGB or RGBA, no interlacing, which is what every PNG in this
 * repository is — anything else throws rather than being guessed at.
 */
export function decode(path: string): Bitmap {
  const file = readFileSync(path);
  const idat: Buffer[] = [];
  let width = 0;
  let height = 0;
  let colourType = 0;
  let offset = 8; // past the signature

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      colourType = data[9]!;
      assert.equal(depth, 8, `${path}: only 8-bit PNGs are decoded here`);
      assert.ok(colourType === 2 || colourType === 6, `${path}: colour type ${colourType}`);
      assert.equal(data[12], 0, `${path}: interlaced`);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const bpp = colourType === 2 ? 3 : 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);

  // Undo the per-scanline filters. Each row is prefixed with a filter byte
  // and predicted from the pixel to its left and the row above.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? cur[i - bpp]! : 0;
      const up = prev[i]!;
      const upLeft = i >= bpp ? prev[i - bpp]! : 0;
      let value = line[i]!;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }
      cur[i] = value & 0xff;
    }
  }

  return { width, height, bpp, data: out };
}
