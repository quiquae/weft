#!/usr/bin/env node
/**
 * Render the icon comparison sheet.
 *
 *   npm run icons:sheet
 *
 * Writes `docs/firstrun/icons.png`: the toolbar mark at the size it actually
 * lives at, on the three backgrounds a toolbar actually has, and then
 * magnified far enough to count the pixels.
 *
 * The sheet documents the fix in `0d9910e`, "The toolbar icon dissolved at
 * the size it actually lives at". Four warp threads at 8.5% of the size with
 * 85% opacity is a clean 11px line at 128px and 1.36px of pale blue on
 * fractional coordinates at 16px, where it smeared across two columns at
 * half coverage and the mark became four grey smudges and a bar. So
 * `tools/make-icons.mjs` now draws each size with its own geometry, and this
 * sheet is how anyone checks that without a toolbar to look at.
 *
 * ## It loads the shipped rasters, and it has to
 *
 * There is an `assets/icon.svg` right beside the PNGs and it would be far
 * easier to scale. It has **four** warp threads, because it is the vector
 * version for the landing page and the store listing, where there is room
 * for four. The 16px raster has **two** and the 32px has three. A sheet
 * rendered from the SVG would therefore show four threads at every size and
 * would misreport the single thing the sheet exists to show — while looking
 * entirely plausible. So every image here is the committed PNG the browser
 * will really display, read off disk and inlined as a data URI.
 *
 * That is also what makes this worth generating rather than drawing: the
 * sheet now has committed inputs, so `artefacts:check` can report it stale
 * when the icons or this tool move. Before, it was written by nothing, and
 * the consequence was not hypothetical — the sheet's lower half sat blank
 * for eight days. `git status` was clean throughout, `artefacts:check` had
 * no sources to compare against, and the pathspec guard beside it excluded
 * the file by name on the grounds that it was hand-made.
 *
 * ## Why one cell size rather than one magnification
 *
 * The sheet this replaces promised "Magnified 8x (nearest neighbour)" and
 * delivered 134 blank rows with a fragment of one thread running off the
 * bottom edge. A literal 8x is why: 16, 32, 48 and 128 become 128, 256, 384
 * and 1024, which is 1792px of artwork plus gaps inside a 1180px frame.
 *
 * Every icon is magnified to the same CELL instead, and each cell states
 * its own factor. Two reasons, and the second is the stronger one:
 *
 *   - at one common size the four marks can be compared directly, which is
 *     the comparison `0d9910e` was about — two fat threads at 16px beside
 *     four thin ones at 128px, at the same scale;
 *   - CELL is the least common multiple of the four sizes, so every factor
 *     is a whole number. Nearest neighbour is only truthful at an integer
 *     factor: at 5.33x some source columns are duplicated five times and
 *     others six, so a thread of uniform width acquires a stagger and the
 *     sheet reports a defect the icon does not have. 384 is the smallest
 *     size at which all four divide, and `tests/tools/icon-sheet.test.ts`
 *     fails if that stops being true.
 */
import { chromium } from '@playwright/test';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/firstrun');

/**
 * The magnified cell, and the reason it is 384 and not a round number:
 * 384 = 16x24 = 32x12 = 48x8 = 128x3, the least common multiple of the four
 * shipped sizes. See the note above on why a whole-number factor is not a
 * nicety.
 */
const CELL = 384;

/** Grid geometry. Two columns, so the sheet is portrait rather than a frieze. */
const COLUMNS = 2;
const PAD = 36;
const GAP = 40;
const WIDTH = PAD * 2 + CELL * COLUMNS + GAP * (COLUMNS - 1);

const INK = '#474747';
const PAPER = '#ffffff';

/**
 * The three backgrounds a toolbar has, sampled from the sheet this replaces
 * so the half that was always correct keeps its appearance.
 *
 * The white band carries a hairline border: without one, a white tile on
 * white paper is invisible and the row reads as two bands and a gap.
 */
const BANDS = [
  { name: 'light', background: '#dee1e6', border: 'transparent' },
  { name: 'dark', background: '#35363a', border: 'transparent' },
  { name: 'white', background: '#ffffff', border: '#dddddd' },
];

/**
 * The icons, in the order they are drawn.
 *
 * `where` is what each size is actually for, because "48px" tells a reader
 * nothing and the sheet is documentation. The sizes themselves are not a
 * free choice — they are the four `tools/make-icons.mjs` writes, and the
 * test beside this file derives that list from the generator and fails if
 * the sheet omits one.
 */
const ICONS = [
  { size: 16, where: 'toolbar' },
  { size: 32, where: 'Windows taskbar' },
  { size: 48, where: 'extensions page' },
  { size: 128, where: 'store listing' },
];

/** `assets/icon-<size>.png` as a data URI, so the page needs no server. */
async function inline(size) {
  const png = await readFile(join(ROOT, `assets/icon-${size}.png`));
  return `data:image/png;base64,${png.toString('base64')}`;
}

const sources = new Map(await Promise.all(ICONS.map(async (i) => [i.size, await inline(i.size)])));

/**
 * One icon.
 *
 * `image-rendering: pixelated` is the whole point of the magnified half: it
 * is what makes the browser duplicate source pixels instead of
 * interpolating between them, so a 2px thread stays a hard-edged 48px
 * thread rather than a gradient. Applied at actual size too, where it is a
 * no-op at 1x but stops a future device-scale-factor change from quietly
 * resampling the row that is supposed to show the raster as shipped.
 */
const img = (size, px) =>
  `<img src="${sources.get(size)}" width="${px}" height="${px}" alt="Weft, ${size} pixels"
        style="image-rendering: pixelated; display: block">`;

const actualSize = `
  <p class="label">Actual size, on browser-toolbar backgrounds</p>
  <div class="bands">
    ${BANDS.map(
      (band) => `
    <div class="band" style="background: ${band.background}; border-color: ${band.border}">
      ${ICONS.map((icon) => img(icon.size, icon.size)).join('')}
    </div>`,
    ).join('')}
  </div>`;

const magnified = `
  <p class="label">Magnified to ${CELL}px, nearest neighbour</p>
  <div class="grid">
    ${ICONS.map(
      (icon) => `
    <figure class="cell">
      ${img(icon.size, CELL)}
      <figcaption>${icon.size}px &mdash; ${CELL / icon.size}&times; &mdash; ${icon.where}</figcaption>
    </figure>`,
    ).join('')}
  </div>`;

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; padding: ${PAD}px; background: ${PAPER}; color: ${INK};
    font: 600 13px/1.4 -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  .label { margin-bottom: 10px; }
  .bands { display: grid; gap: 12px; margin-bottom: 34px; }
  /*
   * Centred, because that is what a toolbar does: a browser gives every
   * action the same square and centres the icon in it, so the 16px mark and
   * the 128px one share a midline rather than a baseline. Aligning them on
   * their bottom edges instead would put the small icon where no toolbar
   * ever puts it, which is the opposite of what this half is for.
   */
  .band {
    display: flex; align-items: center; gap: 28px;
    padding: 16px 24px; border-radius: 8px; border: 1px solid;
  }
  .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, ${CELL}px); gap: ${GAP}px; }
  .cell { display: grid; gap: 10px; }
  .cell img { border: 1px solid #dddddd; }
  figcaption { font-weight: 500; color: #6b6b6b; }
</style></head><body>${actualSize}${magnified}</body></html>`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: WIDTH, height: 600 }, deviceScaleFactor: 1 });
await page.setContent(HTML, { waitUntil: 'load' });

/*
 * Assert the artwork fits before writing, the same bargain `frameOn` makes
 * in `tests/e2e/fixtures.ts`: a generator that cannot frame its subject
 * should fail rather than write a clipped asset that two consecutive runs
 * will then agree with each other about. This is the check whose absence
 * cost the sheet its lower half, and it is cheap because the page is laid
 * out to a frame of its own choosing rather than scrolled to.
 */
const overflow = await page.evaluate((width) => {
  const el = document.documentElement;
  return { scrollWidth: el.scrollWidth, width, clientWidth: el.clientWidth };
}, WIDTH);
if (overflow.scrollWidth > overflow.width) {
  throw new Error(
    `the sheet is ${overflow.scrollWidth}px wide inside a ${overflow.width}px frame, ` +
      'so it would be clipped — widen WIDTH or lower CELL',
  );
}

// `fullPage` rather than a fixed viewport height, so the frame is the
// content's own height and the bottom margin cannot be the thing that gets
// cut. The width is still asserted above, because a full-page screenshot
// grows downwards only and would have hidden the horizontal overflow that
// put a magnified thread off the right edge of the old sheet.
const png = await page.screenshot({ type: 'png', fullPage: true });
await writeFile(join(OUT, 'icons.png'), png);
await page.close();
await browser.close();

console.log(
  `docs/firstrun/icons.png  ${WIDTH}px wide   ${(png.length / 1024).toFixed(0)} KB   ` +
    `${ICONS.map((i) => `${i.size}@${CELL / i.size}x`).join(' ')}`,
);
