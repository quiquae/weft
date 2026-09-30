/**
 * The icon comparison sheet, checked by reading its pixels.
 *
 * This file exists because of the one defect in `docs/firstrun/` that every
 * other check in this repository was structurally unable to see. The sheet
 * labelled its lower half "Magnified 8x (nearest neighbour)" and then
 * delivered 134 consecutive blank rows — 19% of the image — with the only
 * ink below them a fragment of one magnified thread running off the bottom
 * edge. `git status` was clean, `artefacts:check` could not speak (the file
 * was written by no generator, so it had no sources to compare against),
 * and the pathspec guard beside it *excluded* the file by name on the
 * grounds that it was hand-made. The only check available was a person
 * opening it, which is what eventually found it.
 *
 * So the check here is content rather than provenance, and it is the
 * automated form of opening the file. Two properties, both of which the
 * broken sheet failed:
 *
 *   - no band of the image is blank enough to be a missing section;
 *   - nothing has ink on the frame edge, which is what clipping looks like.
 *
 * Deliberately *not* widened to the other forty committed PNGs. Those are
 * screenshots of scrolled pages, where a partly visible line of prose at
 * the top edge is what reading an article looks like — `page-woven.png`
 * relies on exactly that, and `tests/tools/shot-framing.test.ts` already
 * polices their framing at the generator instead. This sheet is a *graphic*
 * laid out to fit a frame it chose, so "nothing touches the edge" is a
 * property it can actually be held to.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SHEET = join(ROOT, 'docs/firstrun/icons.png');

interface Bitmap {
  width: number;
  height: number;
  /** Bytes per pixel: 3 for RGB, 4 for RGBA. */
  bpp: number;
  data: Buffer;
}

/**
 * Decode a PNG far enough to look at its pixels.
 *
 * Written out rather than taken as a dependency for the same reason
 * `tools/make-icons.mjs` encodes PNGs by hand: this has to run on any
 * machine with Node and nothing else, and the subset needed is small.
 * 8-bit RGB or RGBA, no interlacing, which is what every PNG in this
 * repository is — anything else throws rather than being guessed at.
 */
function decode(path: string): Bitmap {
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

/**
 * Non-background pixel counts, one per row.
 *
 * "Background" is the top-left pixel, which on a sheet with a margin is the
 * paper. A tolerance of 6 per channel so that a hairline border or the
 * antialiased edge of a label still counts as ink while PNG-exact paper
 * does not.
 */
function inkPerRow({ width, height, bpp, data }: Bitmap): number[] {
  const bg = [data[0]!, data[1]!, data[2]!];
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    let ink = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * bpp;
      if (
        Math.abs(data[i]! - bg[0]!) > 6 ||
        Math.abs(data[i + 1]! - bg[1]!) > 6 ||
        Math.abs(data[i + 2]! - bg[2]!) > 6
      ) {
        ink++;
      }
    }
    rows.push(ink);
  }
  return rows;
}

function inkPerColumn({ width, height, bpp, data }: Bitmap): number[] {
  const bg = [data[0]!, data[1]!, data[2]!];
  const cols: number[] = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * bpp;
      if (
        Math.abs(data[i]! - bg[0]!) > 6 ||
        Math.abs(data[i + 1]! - bg[1]!) > 6 ||
        Math.abs(data[i + 2]! - bg[2]!) > 6
      ) {
        cols[x]!++;
      }
    }
  }
  return cols;
}

/**
 * The last index with ink, written out rather than using
 * `Array.findLastIndex`: the project targets ES2022 and that landed in
 * ES2023, so `tsc --noEmit` rejects it. Widening `lib` for one call in one
 * test would also widen what the compat audit lets through into `src/`.
 */
function lastInk(rows: number[]): number {
  for (let y = rows.length - 1; y >= 0; y--) if (rows[y]! > 0) return y;
  return -1;
}

/** Runs of consecutive blank rows, as `[from, to, length]`. */
function blankRuns(rows: number[]): [number, number, number][] {
  const runs: [number, number, number][] = [];
  let start: number | null = null;
  for (let y = 0; y <= rows.length; y++) {
    if (y < rows.length && rows[y] === 0) {
      if (start === null) start = y;
    } else if (start !== null) {
      runs.push([start, y - 1, y - start]);
      start = null;
    }
  }
  return runs;
}

describe('the icon comparison sheet', () => {
  /*
   * 90 rows, and both bounds are measured rather than picked.
   *
   * The widest *legitimate* gap in the sheet is **42** rows — between the
   * first grid row's caption and the second row's artwork, which is `GAP`
   * plus the caption's own leading. The hole that prompted this file was
   * **134** rows. So the honest window is (42, 134) and 90 sits near its
   * middle: 48 clear of the widest real gap, 44 clear of the defect, which
   * keeps this a regression test against the sheet that actually shipped.
   *
   * Re-measure both if the layout changes. A gap of 42 was 10 to 21 in the
   * old 1180×700 sheet, so this is exactly the kind of number that goes
   * quietly wrong when the thing it describes is redrawn — which is what it
   * did here, on the first pass of this very file.
   *
   * There is far more room than the window suggests, for what it is worth:
   * in the current layout the smallest thing that could render as nothing is
   * one 384px cell.
   */
  const MAX_BLANK = 90;

  test('no band of the sheet is blank enough to be a section that rendered nothing', () => {
    const sheet = decode(SHEET);
    const rows = inkPerRow(sheet);
    // The first and last runs are the sheet's own top and bottom margin and
    // are not sections. Everything between two inked rows is.
    const first = rows.findIndex((n) => n > 0);
    const last = lastInk(rows);
    assert.ok(first >= 0, 'the sheet is entirely blank');
    const inside = blankRuns(rows.slice(first, last + 1)).map(
      ([from, to, length]) => [from + first, to + first, length] as const,
    );
    const holes = inside.filter(([, , length]) => length > MAX_BLANK);
    assert.deepEqual(
      holes.map(([from, to, length]) => `y ${from}-${to} (${length} rows)`),
      [],
      'a labelled section of the sheet delivered no artwork',
    );
  });

  test('nothing has ink on the frame edge, which is what clipping looks like', () => {
    const sheet = decode(SHEET);
    const rows = inkPerRow(sheet);
    const cols = inkPerColumn(sheet);
    // The historical failure was two-sided: content ran off the bottom edge
    // *and* off both side edges, because the magnified row was laid out at a
    // literal 8x, which needs 1792px of width in a 1180px frame. Checking
    // one edge would have passed the sheet that prompted this file, whose
    // top edge is clean.
    const touching = [
      rows[0]! > 0 && 'the top edge',
      rows[rows.length - 1]! > 0 && 'the bottom edge',
      cols[0]! > 0 && 'the left edge',
      cols[cols.length - 1]! > 0 && 'the right edge',
    ].filter((edge): edge is string => typeof edge === 'string');
    assert.deepEqual(touching, [], 'artwork runs off the frame, so it is clipped');
  });

  /*
   * The coupling that makes generating this sheet worth doing at all.
   *
   * `tools/make-icons.mjs` draws each size with its *own* geometry — two
   * warp threads at 16px, three at 32, four at 48 and 128 — because an
   * antialiased 1.4px thread at 16px dissolved into grey smudges in the
   * toolbar, which is the defect `0d9910e` existed to fix. So a sheet that
   * re-rendered the mark from `assets/icon.svg` would show four threads at
   * every size and would misreport the single thing the sheet is for. It
   * has to load the shipped rasters.
   *
   * Derived from the generator rather than typed out, so that adding a
   * fifth icon size obliges the sheet to show it instead of silently
   * omitting it.
   */
  test('the sheet shows every icon size that ships', () => {
    const icons = readFileSync(join(ROOT, 'tools/make-icons.mjs'), 'utf8');
    const sheet = readFileSync(join(ROOT, 'tools/make-icon-sheet.mjs'), 'utf8');
    const sizes = icons
      .match(/const sizes = \[([\d, ]+)\]/)?.[1]
      ?.split(',')
      .map((n) => Number(n.trim()));
    // Non-vacuity floor: a derivation that has stopped matching returns
    // undefined or an empty list and runs the loop below over nothing.
    assert.ok(sizes && sizes.length >= 4, `derived sizes: ${JSON.stringify(sizes)}`);
    const shown = new Set(
      Array.from(sheet.matchAll(/\bsize: (\d+)\b/g), (m) => Number(m[1])),
    );
    for (const size of sizes!) {
      assert.ok(
        shown.has(size),
        `make-icons.mjs writes assets/icon-${size}.png but the sheet does not show it`,
      );
    }
  });

  /*
   * Nearest-neighbour magnification is only truthful at a whole-number
   * factor. At 5.33x — which is what 48px would need to reach a 256px cell
   * — some source columns are duplicated five times and others six, so a
   * thread of uniform width renders with a stagger in it, and the sheet
   * reports a defect the icon does not have.
   */
  test('every magnification factor is a whole number', () => {
    const sheet = readFileSync(join(ROOT, 'tools/make-icon-sheet.mjs'), 'utf8');
    const cell = Number(sheet.match(/const CELL = (\d+)/)?.[1]);
    const sizes = Array.from(sheet.matchAll(/\bsize: (\d+)\b/g), (m) => Number(m[1]));
    assert.ok(cell > 0, 'no CELL size was derived from the generator');
    assert.ok(sizes.length >= 4, `derived sizes: ${JSON.stringify(sizes)}`);
    for (const size of sizes) {
      assert.equal(
        cell % size,
        0,
        `${size}px magnified into a ${cell}px cell is ${(cell / size).toFixed(2)}x, ` +
          'which is not nearest-neighbour',
      );
    }
  });
});
