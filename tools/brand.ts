/**
 * What Weft looks like, written down once: the loom mark, and the words the
 * artwork leads with.
 *
 * The mark is the product: vertical warp threads with a weft crossing only
 * part of them. A full crossing would mean a fully translated page, which is
 * exactly what Weft does not do.
 *
 * Everything that draws it draws it from here — the four shipped rasters,
 * the vector icon, the header of every site page, the social card and the
 * store tiles. It was not always so, and the reason this module exists is
 * what happened while it was not: `0d9910e` redrew the mark and changed the
 * rasters only, because the vector was written out by hand in five other
 * places — four tools and the landing page — and nothing tied any of them
 * to the geometry that had moved. For nine days the tiles bound for the
 * Chrome Web Store carried the mark the icon beside them had replaced, with
 * every generator reproducing its committed output exactly.
 *
 * TypeScript rather than another `tools/*.mjs` for the reason
 * `tools/sitemap.ts` records: `tsc` rejects a `.mjs` import from a `.ts`
 * test with TS7016. Pure — no I/O, no clock — so the tests read it directly.
 */

export type RGB = readonly [number, number, number];

/** The weft. */
export const WOAD: RGB = [47, 75, 124];
/** The warp. */
export const WOAD_LIGHT: RGB = [122, 150, 192];

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
export const CROSSING: Record<number, number> = { 2: 0.58, 3: 0.62, 4: 0.72 };

interface Geometry {
  /** How many warp threads. */
  warps: number;
  /** Thread width, weft height and outer padding, as fractions of the size. */
  warpFrac: number;
  weftFrac: number;
  insetFrac: number;
  /** Opacity of the warp; the weft is always opaque. */
  alpha: number;
  /** Whether edges are rounded to whole pixels. */
  snap: boolean;
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
export const GEOMETRY: Record<number, Geometry> = {
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

/** An axis-aligned box in the mark's own pixel grid; `x1`/`y1` exclusive. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The mark as the boxes that make it up. */
export interface Mark {
  size: number;
  /** The warp threads, left to right. */
  warps: Rect[];
  /** The weft, drawn over them. */
  weft: Rect;
  /** Opacity of the warp; the weft is always opaque. */
  warpAlpha: number;
}

/**
 * The boxes that make up the mark at `size`.
 *
 * A raster fills them and a vector writes them out, so the two cannot show
 * different marks. Sizes with no geometry of their own take the 128px one.
 */
export function markGeometry(size: number): Mark {
  const g = GEOMETRY[size] ?? GEOMETRY[128]!;
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
  const snap = (v: number): number => (g.snap ? Math.round(v) : v);

  const warpWidth = Math.max(g.snap ? 2 : 1, size * g.warpFrac);
  const pitch = span / (g.warps - 1);
  const warps: Rect[] = [];
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
    warps.push({ x0, y0: inset, x1, y1: size - inset });
  }

  // Weft: one horizontal thread crossing part of the warp, drawn over it.
  const weftHeight = Math.max(2, size * g.weftFrac);
  const cy = size / 2;
  const y0 = snap(cy - weftHeight / 2);
  const y1 = Math.max(y0 + 2, snap(cy + weftHeight / 2));
  const left = snap(inset - warpWidth / 2);
  const crossing = CROSSING[g.warps] ?? 0.72;
  const right = snap(inset - warpWidth / 2 + span * crossing + warpWidth);

  return {
    size,
    warps,
    weft: { x0: Math.max(0, left), y0, x1: Math.min(size, right), y1 },
    warpAlpha: g.alpha,
  };
}

/** How the mark is coloured where it is drawn as a vector. */
export interface MarkPaint {
  /** Any CSS colour, `currentColor` included. */
  warp: string;
  weft: string;
  /** Opacity of the warp; the weft is always opaque. */
  warpOpacity: number;
}

/** A colour triple as CSS. */
export const css = ([r, g, b]: RGB): string => `rgb(${r} ${g} ${b})`;

/** The side of the box the vector is drawn in, and the size it is drawn at. */
const VECTOR_SIZE = 128;

/** Two decimal places, and no trailing zeros: `10.56`, `96`. */
const n = (v: number): string => String(Math.round(v * 100) / 100);

/**
 * The mark's shapes as SVG elements, one per line, for a 128-unit viewBox.
 *
 * Rectangles rather than stroked lines. A stroked line states a centre and a
 * width and leaves both ends to be worked out, and the hand-written vector
 * this replaces is what that costs: its weft was given an end at 0.62 of the
 * span and no allowance for the thread it was meant to reach, so it stopped
 * five units short of where the raster beside it did even before the redraw.
 * A rectangle is the same four numbers the raster fills.
 */
export function markShapes(paint: MarkPaint): string[] {
  const { warps, weft } = markGeometry(VECTOR_SIZE);
  const rect = (r: Rect, extra = ''): string =>
    `<rect x="${n(r.x0)}" y="${n(r.y0)}" width="${n(r.x1 - r.x0)}" height="${n(r.y1 - r.y0)}"${extra}/>`;
  const opacity = paint.warpOpacity === 1 ? '' : ` opacity="${paint.warpOpacity}"`;
  return [
    `<g fill="${paint.warp}"${opacity}>`,
    ...warps.map((w) => `  ${rect(w)}`),
    '</g>',
    rect(weft, ` fill="${paint.weft}"`),
  ];
}

/**
 * `assets/icon.svg`, whole: the 128px icon as a vector.
 *
 * Painted exactly as that raster is, down to the warp's opacity, which is
 * read off the geometry rather than typed again.
 */
export function iconSvg(): string {
  const paint = {
    warp: css(WOAD_LIGHT),
    weft: css(WOAD),
    warpOpacity: markGeometry(VECTOR_SIZE).warpAlpha,
  };
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VECTOR_SIZE} ${VECTOR_SIZE}" role="img" aria-label="Weft">`,
    '  <title>Weft</title>',
    ...markShapes(paint).map((line) => `  ${line}`),
    '</svg>',
    '',
  ].join('\n');
}

/**
 * The mark in its own colours, opaque: for artwork that sits on a known
 * background, where a see-through warp would take on the paper's tint.
 */
export const SOLID: MarkPaint = { warp: css(WOAD_LIGHT), weft: css(WOAD), warpOpacity: 1 };

/**
 * The mark as an inline `<svg>`, for a page or a card to embed.
 *
 * `style` sizes it where the surrounding CSS does not; `indent` is put in
 * front of every line after the first, so the markup sits tidily inside
 * whatever template interpolates it.
 */
export function markSvg(paint: MarkPaint, { style = '', indent = '' } = {}): string {
  const sized = style ? ` style="${style}"` : '';
  return [
    `<svg viewBox="0 0 ${VECTOR_SIZE} ${VECTOR_SIZE}" role="img" aria-label="Weft"${sized}>`,
    ...markShapes(paint).map((line) => `  ${line}`),
    '</svg>',
  ].join(`\n${indent}`);
}

/** The pack the artwork's words are drawn from. */
export const LEAD_LANGUAGE = 'fr';

/**
 * The words the artwork leads with: the interlinear pairs on the social
 * card and the store tiles, target word above its English.
 *
 * All four French. They used to be one French, two Old English and one
 * Latin — *rivière*, *hūs*, *cyning*, *vacca* — and `3060d93` changed the
 * card for a reason that is about first contact rather than about the card:
 * it is the first thing anyone sees of this product, with no other context,
 * and *hūs* next to *cyning* reads as a tool for medievalists rather than
 * as a way to learn a language someone is actually planning to speak.
 *
 * That commit said "French leads everywhere now" and the Chrome marquee
 * went on showing the old four for five more days, because the marquee kept
 * its own list and nobody knew it had a generator. It is one list now. The
 * small tile has room for one pair and takes the first.
 *
 * `tests/tools/brand.test.ts` fails if any of them is not a pair the pack
 * named above actually weaves, in exactly this form.
 */
export const LEAD_PAIRS: { target: string; source: string }[] = [
  { target: 'rivière', source: 'river' },
  { target: 'cheval', source: 'horse' },
  { target: 'matin', source: 'morning' },
  { target: 'forêt', source: 'forest' },
];
