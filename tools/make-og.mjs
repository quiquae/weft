#!/usr/bin/env node
/**
 * Render the Open Graph card.
 *
 * Built as HTML and screenshotted rather than drawn, because the card should
 * use the same typeface, palette and interlinear device as everything else —
 * and because a hand-rolled raster encoder cannot set type.
 *
 *   node tools/make-og.mjs
 */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markSvg, SOLID, LEAD_PAIRS } from './brand.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * One interlinear pair. Which four, and why all of them are French, is
 * `LEAD_PAIRS` in `tools/brand.ts`: the store tiles show the same words,
 * and when that list lived here the marquee did not follow it.
 */
const pair = ({ target, source }) =>
  `<span class="pair"><span class="t">${target}</span><span class="s">${source}</span></span>`;

const CARD = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
    background: #e9e8e3; color: #20262b;
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  }
  .top { display: flex; align-items: center; gap: 18px; }
  .top svg { width: 46px; height: 46px; }
  .top span { font-size: 30px; letter-spacing: 0.01em; color: #4d565e; }
  h1 {
    font-size: 86px; line-height: 0.98; letter-spacing: -0.035em;
    max-width: 17ch; font-weight: 600;
  }
  /* The interlinear gloss: the product's signature, and a picture of what it does. */
  .gloss { display: flex; gap: 46px; align-items: flex-end; }
  .pair { display: grid; justify-items: center; line-height: 1.12; }
  .t {
    color: #2f4b7c; font-style: italic; font-size: 40px;
    padding: 0 6px 5px; border-bottom: 2px solid #b9b2a2;
  }
  .s { padding-top: 6px; font-size: 40px; }
  .foot { font-size: 27px; color: #4d565e; }
</style></head><body>
  <div class="top">
    ${markSvg(SOLID, { indent: '    ' })}
    <span>Weft</span>
  </div>

  <h1>The web, partly in another language.</h1>

  <div class="gloss">
    ${LEAD_PAIRS.map(pair).join('\n    ')}
  </div>

  <p class="foot">The longer you stay on a page, the more of it you read in the language you are learning.</p>
</body></html>`;

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(CARD, { waitUntil: 'load' });
await page.waitForTimeout(250);
const png = await page.screenshot({ type: 'png' });
await writeFile(join(ROOT, 'site/og.png'), png);
await browser.close();
console.log(`site/og.png  1200x630  ${(png.length / 1024).toFixed(0)} KB`);
