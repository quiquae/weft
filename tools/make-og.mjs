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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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
    <svg viewBox="0 0 128 128">
      <g stroke="#7a96c0" stroke-width="11"><line x1="12.8" y1="12.8" x2="12.8" y2="115.2"/>
      <line x1="46.9" y1="12.8" x2="46.9" y2="115.2"/><line x1="81.1" y1="12.8" x2="81.1" y2="115.2"/>
      <line x1="115.2" y1="12.8" x2="115.2" y2="115.2"/></g>
      <line x1="7.3" y1="64" x2="76.3" y2="64" stroke="#2f4b7c" stroke-width="20.5"/>
    </svg>
    <span>Weft</span>
  </div>

  <h1>The web, partly in another language.</h1>

  <div class="gloss">
    <span class="pair"><span class="t">rivière</span><span class="s">river</span></span>
    <span class="pair"><span class="t">hūs</span><span class="s">house</span></span>
    <span class="pair"><span class="t">cyning</span><span class="s">king</span></span>
    <span class="pair"><span class="t">vacca</span><span class="s">cow</span></span>
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
