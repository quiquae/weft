#!/usr/bin/env node
/**
 * Render the promotional tiles every store front asks for.
 *
 *   node tools/make-store-tiles.mjs
 *
 * These are graphics, not screenshots, and the sizes are exact — the upload
 * is rejected at anything else:
 *
 *   440x280   Chrome Web Store small tile. REQUIRED. Shown in search
 *             results and category listings, so it has to work small.
 *   1400x560  Chrome Web Store marquee. Optional, but an extension cannot
 *             be featured without one, so it costs nothing to have.
 *   300x300   Microsoft Edge Add-ons store logo. REQUIRED there.
 *
 * Built as HTML and screenshotted, like the Open Graph card, so the tiles
 * use the same typeface and palette as the product instead of drifting into
 * a separate visual identity.
 *
 * The device is the interlinear pair — target word above, English below, a
 * rule between them. It is the product's signature and it is also a picture
 * of what the product does, which is rarer in a promo tile than it should
 * be. Chrome's own guidance notes that images without much text travel
 * better across locales; the pairs carry the idea with four words.
 */
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markSvg, SOLID, LEAD_PAIRS, PALETTE, css } from './brand.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/store');

// The product's palette, from `tools/brand.ts`, as the mark is: typed here,
// a colour retuned there would leave these tiles reported fresh in the old one.
const PAPER = css(PALETTE.linen);
const INK = css(PALETTE.ink);
const MUTED = css(PALETTE['ink-soft']);
const WEFT_BLUE = css(PALETTE.woad);
const RULE = css(PALETTE.thread);

const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

/**
 * The loom mark, at whatever size the caller needs.
 *
 * Embedded from `tools/brand.ts` rather than drawn here. It used to be
 * drawn here, and that copy is why these tiles went on showing a weft that
 * crosses two threads for nine days after the icon they are uploaded beside
 * was redrawn to cross three.
 */
const mark = (px) => markSvg(SOLID, { style: `width:${px}px;height:${px}px;flex:none` });

/**
 * One interlinear pair.
 *
 * Which words is `LEAD_PAIRS` in `tools/brand.ts`, shared with the social
 * card. The marquee used to keep four of its own — *rivière*, *hūs*,
 * *cyning*, *vacca* — which were the card's four until `3060d93` made the
 * card all French and, having no way to know this file existed, left these.
 */
const pair = ({ target, source }, size) => `
  <span class="pair">
    <span class="t" style="font-size:${size}px">${target}</span>
    <span class="s" style="font-size:${Math.round(size * 0.82)}px">${source}</span>
  </span>`;

const shell = (width, height, body, extra = '') => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${width}px; height: ${height}px; overflow: hidden;
    background: ${PAPER}; color: ${INK}; font-family: ${SERIF};
  }
  .pair { display: grid; justify-items: center; line-height: 1.1; }
  .t { color: ${WEFT_BLUE}; font-style: italic; padding: 0 5px 4px; border-bottom: 2px solid ${RULE}; }
  .s { padding-top: 5px; color: ${INK}; }
  ${extra}
</style></head><body>${body}</body></html>`;

/**
 * 440x280. The hard one: it is small, and it appears next to competitors.
 *
 * Deliberately one pair rather than four. At this size four pairs render at
 * about 18px and turn into texture; one at 40px is still a legible idea.
 */
const SMALL = shell(
  440,
  280,
  `
  <div class="wrap">
    <div class="top">${mark(34)}<span class="name">Weft</span></div>
    <div class="mid">${pair(LEAD_PAIRS[0], 44)}</div>
    <p class="tag">The web, partly<br>in another language.</p>
  </div>`,
  `
  .wrap { height: 100%; padding: 26px 30px; display: flex; flex-direction: column; justify-content: space-between; }
  .top { display: flex; align-items: center; gap: 12px; }
  .name { font-size: 25px; color: ${MUTED}; letter-spacing: 0.01em; }
  /* Left, not centred: the mark and the tagline are both flush left, and a
     centred pair between them reads as a mistake rather than as emphasis. */
  .mid { display: flex; justify-content: flex-start; padding-left: 2px; }
  .tag { font-size: 23px; line-height: 1.24; letter-spacing: -0.014em; }
  `,
);

/**
 * 1400x560. Room for the whole claim, including the escalation, which is
 * the part that distinguishes Weft from a translate button.
 */
const MARQUEE = shell(
  1400,
  560,
  `
  <div class="wrap">
    <div class="left">
      <div class="top">${mark(44)}<span class="name">Weft</span></div>
      <h1>The web, partly in<br>another language.</h1>
      <p class="tag">The longer you stay on a page, the more of it arrives in the<br>language you are learning. Point at a word to get the English back.</p>
    </div>
    <div class="right">
      ${LEAD_PAIRS.map((p) => pair(p, 40)).join('')}
    </div>
  </div>`,
  `
  .wrap { height: 100%; padding: 62px 74px; display: flex; align-items: center; justify-content: space-between; gap: 60px; }
  .left { display: grid; gap: 26px; }
  .top { display: flex; align-items: center; gap: 16px; }
  .name { font-size: 31px; color: ${MUTED}; }
  h1 { font-size: 66px; line-height: 1.0; letter-spacing: -0.032em; font-weight: 600; }
  .tag { font-size: 24px; line-height: 1.42; color: ${MUTED}; }
  /*
   * Sized to fit, not eyeballed. Four pairs at 40px are about 73px tall
   * each; 4 x 73 + 3 x 22 = 358px inside a 436px content box. At 46px with
   * 34px gaps it came to 438px and the frame clipped the top of the first
   * pair and the bottom of the last — an overflow of two pixels that looked
   * like a deliberate bleed and was not.
   */
  .right { display: grid; gap: 22px; justify-items: end; flex: none; }
  `,
);

/**
 * 300x300 for Edge. Square, so the wordmark sits under the mark rather than
 * beside it; a horizontal lockup in a square crop leaves dead space.
 */
const EDGE_LOGO = shell(
  300,
  300,
  `
  <div class="wrap">
    ${mark(116)}
    <span class="name">Weft</span>
  </div>`,
  `
  .wrap { height: 100%; display: grid; place-content: center; justify-items: center; gap: 18px; }
  .name { font-size: 40px; color: ${MUTED}; letter-spacing: 0.01em; }
  `,
);

const TILES = [
  { file: 'tile-small-440x280.png', html: SMALL, width: 440, height: 280, note: 'Chrome small tile (required)' },
  { file: 'tile-marquee-1400x560.png', html: MARQUEE, width: 1400, height: 560, note: 'Chrome marquee (needed to be featured)' },
  { file: 'logo-edge-300x300.png', html: EDGE_LOGO, width: 300, height: 300, note: 'Edge store logo (required)' },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });

/*
 * Render all three, and write none until all three fit.
 *
 * The same bargain `make-icon-sheet.mjs` and `frameOn` make: a generator
 * that cannot frame its subject fails, rather than writing a clipped asset
 * that two consecutive runs will then agree with each other about. These
 * are fixed-size frames with `overflow: hidden`, so anything that outgrows
 * one is cut off silently — which the marquee's own stylesheet records
 * having happened once, by two pixels, looking like a deliberate bleed. The
 * words on these tiles come from `LEAD_PAIRS` and can change length without
 * anyone opening this file, so the fit is checked here rather than trusted.
 *
 * Collected and then written, because a tile that throws after its
 * neighbours were already saved would leave a set that is half regenerated.
 */
const rendered = [];
try {
  for (const tile of TILES) {
    const page = await browser.newPage({
      viewport: { width: tile.width, height: tile.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(tile.html, { waitUntil: 'load' });
    await page.waitForTimeout(200);

    const outside = await page.evaluate(({ width, height }) => {
      const found = [];
      for (const el of document.body.querySelectorAll('*')) {
        const box = el.getBoundingClientRect();
        if (!box.width && !box.height) continue;
        const over = Math.max(-box.left, -box.top, box.right - width, box.bottom - height);
        // Half a pixel of grace for layout arithmetic, none for content.
        if (over > 0.5) {
          const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28);
          found.push(`<${el.tagName.toLowerCase()}> "${text}" by ${Math.ceil(over)}px`);
        }
      }
      return found;
    }, { width: tile.width, height: tile.height });
    if (outside.length) {
      throw new Error(
        `${tile.file}: ${outside.length} element(s) run off the ${tile.width}x${tile.height} ` +
          `frame and would be clipped, so nothing was written — ${outside.slice(0, 3).join('; ')}`,
      );
    }

    rendered.push({ tile, png: await page.screenshot({ type: 'png' }) });
    await page.close();
  }
} finally {
  await browser.close();
}

for (const { tile, png } of rendered) {
  await writeFile(join(OUT, tile.file), png);
  console.log(
    `docs/store/${tile.file.padEnd(28)} ${tile.width}x${tile.height}`.padEnd(58) +
      `${(png.length / 1024).toFixed(0)} KB   ${tile.note}`,
  );
}
