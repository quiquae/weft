/**
 * Read the loom mark back out of something that draws it.
 *
 * The mark is vertical warp threads with one weft crossing part of them, and
 * it is drawn in three kinds of place: rasters (`assets/icon-*.png`), vector
 * markup (`assets/icon.svg`, the header of every site page), and screenshots
 * of pages that embed that markup (the store tiles, the social card). A test
 * that wants to know whether two of those show the same mark cannot compare
 * bytes, so it reads the shapes back and compares those.
 *
 * Both readers return the same thing — the threads left to right and the
 * weft — in whatever units the source is in: pixels for a bitmap, viewBox
 * units for markup. Not a `.test.ts`, so the test glob does not run it.
 */
import type { Bitmap } from './png.ts';

/** An axis-aligned box, `x1`/`y1` exclusive. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** What a drawing of the mark shows. */
export interface MarkReading {
  /** The warp threads, left to right. */
  threads: Box[];
  /** The one weft that crosses them. */
  weft: Box;
}

export type RGB = readonly [number, number, number];

/**
 * Per channel. The same tolerance `icon-sheet.test.ts` uses for "is this
 * ink", and tight for a reason that was checked rather than assumed: the
 * tiles set blue italic type a few pixels from the mark, and no blend of
 * that blue, the ink or the muted grey with the paper comes within 6 of the
 * warp colour on all three channels, so antialiased text is never mistaken
 * for a thread.
 */
const TOLERANCE = 6;

const lastIndex = (counts: number[], atLeast: number): number => {
  for (let i = counts.length - 1; i >= 0; i--) if (counts[i]! >= atLeast) return i;
  return -1;
};

/** Runs of consecutive `true`, as `[from, to)`. */
const runs = (flags: boolean[], offset: number): [number, number][] => {
  const found: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    if (i < flags.length && flags[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      found.push([start + offset, i + offset]);
      start = -1;
    }
  }
  return found;
};

/**
 * The mark in a bitmap, found by its colours.
 *
 * The warp colour locates it: on every surface that draws the mark in the
 * brand palette, that pale blue appears nowhere else. Threads are counted in
 * the band *above* the weft, where each one is uninterrupted, and the weft
 * is read along the mark's middle row and only between the mark's own edges
 * — the marquee sets blue type on the same rows a thousand pixels away.
 *
 * Null when no mark in these colours is there, which a caller must treat as
 * a finding rather than a skip: art drawn in a superseded palette reads as
 * "no mark" here.
 */
export function markInPixels(
  { width, height, bpp, data }: Bitmap,
  colours: { warp: RGB; weft: RGB },
): MarkReading | null {
  const is = (x: number, y: number, [r, g, b]: RGB): boolean => {
    const i = (y * width + x) * bpp;
    // A faint antialiased edge is not the shape; half coverage is the line.
    if (bpp === 4 && data[i + 3]! < 128) return false;
    return (
      Math.abs(data[i]! - r) <= TOLERANCE &&
      Math.abs(data[i + 1]! - g) <= TOLERANCE &&
      Math.abs(data[i + 2]! - b) <= TOLERANCE
    );
  };

  const perColumn = new Array<number>(width).fill(0);
  const perRow = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (is(x, y, colours.warp)) {
        perColumn[x]!++;
        perRow[y]!++;
      }
    }
  }
  // A thread is at least three pixels tall and two wide at every size the
  // mark is drawn, so a stray pixel of the same colour is not one.
  const left = perColumn.findIndex((n) => n >= 3);
  const right = lastIndex(perColumn, 3);
  const top = perRow.findIndex((n) => n >= 2);
  const bottom = lastIndex(perRow, 2);
  if (left < 0 || top < 0) return null;

  // The top quarter of the warp is clear of the weft at every size: the
  // weft sits on the midline, and where it is proportionally tallest — the
  // 16px icon — it still begins 30% of the way down the threads.
  const bandRows = Math.max(1, Math.floor((bottom - top + 1) * 0.25));
  const inThread: boolean[] = [];
  for (let x = left; x <= right; x++) {
    let hits = 0;
    for (let y = top; y < top + bandRows; y++) if (is(x, y, colours.warp)) hits++;
    inThread.push(hits * 2 >= bandRows);
  }
  const threads = runs(inThread, left).map(([x0, x1]) => ({ x0, x1, y0: top, y1: bottom + 1 }));

  const mid = Math.floor((top + bottom) / 2);
  const from = Math.max(0, left - 2);
  const to = Math.min(width - 1, right + 2);
  let x0 = -1;
  let x1 = -1;
  for (let x = from; x <= to; x++) {
    if (!is(x, mid, colours.weft)) continue;
    if (x0 < 0) x0 = x;
    x1 = x + 1;
  }
  if (x0 < 0 || !threads.length) return null;

  const column = Math.floor((x0 + x1) / 2);
  let y0 = mid;
  let y1 = mid + 1;
  while (y0 > 0 && is(column, y0 - 1, colours.weft)) y0--;
  while (y1 < height && is(column, y1, colours.weft)) y1++;

  return { threads, weft: { x0, x1, y0, y1 } };
}

/**
 * The mark in SVG markup.
 *
 * Reads both ways of writing a bar — a `<rect>`, or a `<line>` with a
 * stroke width of its own or its group's — because what is being compared is
 * the drawing, not how somebody chose to spell it. Tall shapes are threads
 * and the one wide shape is the weft.
 *
 * Null when the markup holds no such drawing.
 */
export function markInSvg(markup: string): MarkReading | null {
  const shapes: Box[] = [];
  const inherited: number[] = [];
  for (const m of markup.matchAll(/<(\/?)(g|line|rect)\b([^>]*)>/g)) {
    const closing = m[1] === '/';
    const tag = m[2]!;
    const attrs = m[3] ?? '';
    // Not `\b`: that would find `width` inside `stroke-width`.
    const num = (name: string): number | null => {
      const v = attrs.match(new RegExp(`(?<![\\w-])${name}="([^"]+)"`));
      return v ? Number(v[1]) : null;
    };
    if (tag === 'g') {
      if (closing) inherited.pop();
      else inherited.push(num('stroke-width') ?? inherited.at(-1) ?? 0);
      continue;
    }
    if (closing) continue;
    if (tag === 'rect') {
      const x = num('x') ?? 0;
      const y = num('y') ?? 0;
      shapes.push({ x0: x, y0: y, x1: x + (num('width') ?? 0), y1: y + (num('height') ?? 0) });
      continue;
    }
    const half = (num('stroke-width') ?? inherited.at(-1) ?? 0) / 2;
    const ax = num('x1') ?? 0;
    const ay = num('y1') ?? 0;
    const bx = num('x2') ?? 0;
    const by = num('y2') ?? 0;
    shapes.push(
      ax === bx
        ? { x0: ax - half, x1: ax + half, y0: Math.min(ay, by), y1: Math.max(ay, by) }
        : { x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: ay - half, y1: ay + half },
    );
  }

  const tall = (b: Box): boolean => b.y1 - b.y0 > b.x1 - b.x0;
  const threads = shapes.filter(tall).sort((a, b) => a.x0 - b.x0);
  const wefts = shapes.filter((b) => !tall(b));
  if (!threads.length || wefts.length !== 1) return null;
  return { threads, weft: wefts[0]! };
}

/**
 * How many threads the weft covers edge to edge, counted from the left.
 *
 * This is the whole meaning of the mark in one number: a weft that covers
 * every thread is a fully translated page, which is what Weft does not do,
 * and one that stops two short strands a thread on its own — the shape the
 * redraw in `0d9910e` called "an H with a stray stroke beside it".
 *
 * A pixel of slack on the near side only, where the weft and the first
 * thread share an edge and antialiasing can put them a pixel apart.
 */
export function threadsCrossed({ threads, weft }: MarkReading): number {
  let crossed = 0;
  for (const t of threads) {
    if (weft.x0 <= t.x0 + 1 && weft.x1 >= t.x1) crossed++;
    else break;
  }
  return crossed;
}

const tidy = (v: number): number => Math.round(v * 100) / 100;

/** A reading as one line, for a failure message a person can act on. */
export function describeMark({ threads, weft }: MarkReading): string {
  const span = (b: Box): string => `${tidy(b.x0)}–${tidy(b.x1)}`;
  return `threads at x ${threads.map(span).join(', ')}; weft at x ${span(weft)}`;
}

/**
 * Every way two readings disagree by more than `tolerance`, in words.
 *
 * Empty means they are the same drawing. The tolerance is the caller's,
 * because the honest one depends on what is being compared: two pieces of
 * markup from one generator agree to the last digit, while a raster's edges
 * are known only to the nearest pixel.
 */
export function differences(
  a: MarkReading,
  b: MarkReading,
  tolerance: number,
  names: [string, string] = ['the first', 'the second'],
): string[] {
  const found: string[] = [];
  if (a.threads.length !== b.threads.length) {
    return [`${a.threads.length} threads in ${names[0]} and ${b.threads.length} in ${names[1]}`];
  }
  const box = (v: Box): string =>
    `x ${tidy(v.x0)}–${tidy(v.x1)}, y ${tidy(v.y0)}–${tidy(v.y1)}`;
  const differ = (p: Box, q: Box): boolean =>
    Math.abs(p.x0 - q.x0) > tolerance ||
    Math.abs(p.x1 - q.x1) > tolerance ||
    Math.abs(p.y0 - q.y0) > tolerance ||
    Math.abs(p.y1 - q.y1) > tolerance;
  a.threads.forEach((thread, i) => {
    const other = b.threads[i]!;
    if (differ(thread, other)) {
      found.push(`thread ${i + 1} is at ${box(thread)} in ${names[0]} and ${box(other)} in ${names[1]}`);
    }
  });
  if (differ(a.weft, b.weft)) {
    found.push(`the weft is at ${box(a.weft)} in ${names[0]} and ${box(b.weft)} in ${names[1]}`);
  }
  return found;
}
