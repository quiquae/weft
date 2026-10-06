/**
 * Where two bitmaps differ, by how much, and inside which box.
 *
 * A committed image that moves has moved for a reason, and the bytes cannot
 * say which. What has told a renderer's drift from a real change every time
 * here is where the pixels differ: how many, how far apart their channels
 * are — antialiasing moves a channel by tens, a glyph turning from paper to
 * ink by a hundred and seventy or more — and whether they sit inside the box
 * a change was meant to move. Three sessions wrote a decoder for that and
 * threw it away; this is the one kept, run by `npm run png:diff`.
 *
 * Pure: two bitmaps in, a description out. Reading the files, and reading
 * `HEAD`'s copy out of git, is the command's job, in `tools/png-diff.mjs`.
 */
import type { Bitmap } from './png.ts';

/** An axis-aligned box in pixels, `x1` and `y1` exclusive. */
export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RegionCount {
  region: Region;
  /** Pixels inside the region that differ. */
  differing: number;
  /** Pixels inside the region. */
  total: number;
}

interface Size {
  width: number;
  height: number;
}

export type PixelDiff =
  | { kind: 'sizes'; before: Size; after: Size }
  | {
      kind: 'pixels';
      width: number;
      height: number;
      /** Pixels with any channel different, alpha included. */
      differing: number;
      /** The largest difference in any one channel of any one pixel. */
      largest: number;
      /** The smallest box holding every differing pixel; null when none. */
      box: Region | null;
      regions: RegionCount[];
    };

/** A region as `--region` takes it, so a box printed can be pasted back. */
export const showRegion = ({ x0, y0, x1, y1 }: Region): string => `${x0},${y0},${x1},${y1}`;

/**
 * `x0,y0,x1,y1` in whole pixels. Anything else throws, including a box with
 * nothing in it: an empty region counts no differences, and "0 differ" is
 * exactly the answer a drift check hopes for, so a typo must not produce it.
 */
export function parseRegion(text: string): Region {
  const parts = text.split(',');
  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) {
    throw new Error(`region "${text}" is not x0,y0,x1,y1 in whole pixels`);
  }
  const [x0, y0, x1, y1] = parts.map(Number) as [number, number, number, number];
  if (x1 <= x0 || y1 <= y0) {
    throw new Error(`region "${text}" holds no pixels: x1 and y1 are exclusive, so each must exceed x0 and y0`);
  }
  return { x0, y0, x1, y1 };
}

/** One channel of one pixel, an RGB image's alpha read as opaque. */
const channel = ({ bpp, data }: Bitmap, pixel: number, c: number): number =>
  c === 3 && bpp === 3 ? 255 : data[pixel * bpp + c]!;

/**
 * Compare `after` with `before`, pixel by pixel, counting inside each of
 * `regions` too. Channels are compared as RGBA whatever each file stores, so
 * a re-encoding that adds an opaque alpha channel changes nothing. Images of
 * different sizes are not compared at all, and a region that does not fit
 * inside the image throws rather than being clipped.
 */
export function comparePixels(before: Bitmap, after: Bitmap, regions: Region[] = []): PixelDiff {
  if (before.width !== after.width || before.height !== after.height) {
    return {
      kind: 'sizes',
      before: { width: before.width, height: before.height },
      after: { width: after.width, height: after.height },
    };
  }
  const { width, height } = before;
  for (const region of regions) {
    const { x0, y0, x1, y1 } = region;
    if (!(0 <= x0 && x0 < x1 && x1 <= width && 0 <= y0 && y0 < y1 && y1 <= height)) {
      throw new Error(`region ${showRegion(region)} does not fit inside the ${width}×${height} image`);
    }
  }

  let differing = 0;
  let largest = 0;
  let [minX, minY, maxX, maxY] = [width, height, -1, -1];
  const counts = regions.map(() => 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      let worst = 0;
      for (let c = 0; c < 4; c++) {
        worst = Math.max(worst, Math.abs(channel(before, pixel, c) - channel(after, pixel, c)));
      }
      if (worst === 0) continue;
      differing++;
      largest = Math.max(largest, worst);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      regions.forEach(({ x0, y0, x1, y1 }, i) => {
        if (x >= x0 && x < x1 && y >= y0 && y < y1) counts[i]!++;
      });
    }
  }

  return {
    kind: 'pixels',
    width,
    height,
    differing,
    largest,
    box: differing ? { x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1 } : null,
    regions: regions.map((region, i) => ({
      region,
      differing: counts[i]!,
      total: (region.x1 - region.x0) * (region.y1 - region.y0),
    })),
  };
}

const percent = (part: number, whole: number): string => {
  const value = (100 * part) / whole;
  return value > 0 && value < 0.01 ? 'under 0.01%' : `${value.toFixed(2)}%`;
};

/**
 * What `npm run png:diff` prints under a file whose bytes differ from its
 * `HEAD` blob, `before` being that blob.
 */
export function describeDiff(diff: PixelDiff): string[] {
  if (diff.kind === 'sizes') {
    const { before, after } = diff;
    return [
      `${before.width}×${before.height} at HEAD and ${after.width}×${after.height} here, so no pixel is compared`,
    ];
  }
  const { width, height, differing, largest, box, regions } = diff;
  const total = width * height;
  if (!differing) return [`${width}×${height}, and the pixels are identical`];
  return [
    `${width}×${height}: ${differing} of ${total} pixels differ (${percent(differing, total)})`,
    `largest channel difference ${largest}`,
    `every difference inside ${showRegion(box!)}`,
    ...regions.map(({ region, differing: inside, total: area }) => `${showRegion(region)}: ${inside} of ${area} differ`),
  ];
}
