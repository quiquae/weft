import { test, expect } from './fixtures.ts';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Store listing screenshots, at the exact sizes the stores demand.
 *
 *   WEFT_STORE=1 npx playwright test store-assets
 *
 * Separate from screenshots.spec.ts, which captures documentation shots at
 * whatever size shows the surface best. Store assets have hard constraints
 * that documentation does not:
 *
 *   - Chrome wants 1280x800, "square corners, no padding (full bleed)", so
 *     these are viewport captures rather than fullPage ones. A fullPage shot
 *     of a tall settings page comes out 1280x3000, and the upload is
 *     rejected — or worse, silently letterboxed.
 *   - Edge wants 1366x768. Same shots, different frame.
 *   - Apple accepts 1280x800, 1440x900, 2560x1600 or 2880x1800 for a macOS
 *     listing. 1440x900 is captured here because deviceScaleFactor is a
 *     browser-context option and the fixture's context is shared across
 *     every spec — a 2x frame would mean a second context just for
 *     screenshots. If a Retina-sharp listing matters later, that is the
 *     change to make, not a `scale` field that nothing reads.
 *
 * Five is Chrome's maximum, so the sequence has to carry the whole pitch:
 * what it does, how you escape it, why the historical languages are the
 * reason to look twice, that progress is being kept, and that the friction
 * is deliberate.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/store');

/** Chrome 1280x800; Edge 1366x768; Apple 2880x1800 via a 2x scale factor. */
const FRAMES = [
  { name: 'chrome', width: 1280, height: 800 },
  { name: 'edge', width: 1366, height: 768 },
  { name: 'apple', width: 1440, height: 900 },
];

test.describe('store assets', () => {
  test.skip(({}) => process.env['WEFT_STORE'] !== '1', 'set WEFT_STORE=1');
  test.setTimeout(600_000);

  test('capture the five listing screenshots at every store size', async ({
    context,
    extensionId,
    configure,
    origin,
    rpc,
  }) => {
    await mkdir(OUT, { recursive: true });

    /** Capture one scene into every frame size. */
    const capture = async (
      slug: string,
      prepare: (page: import('@playwright/test').Page) => Promise<void>,
    ) => {
      for (const frame of FRAMES) {
        const page = await context.newPage();
        await page.setViewportSize({ width: frame.width, height: frame.height });
        await prepare(page);
        await page.screenshot({
          path: join(OUT, `${frame.name}-${slug}.png`),
          // Viewport-only: full bleed at exactly the frame size.
          fullPage: false,
        });
        await page.close();
      }
    };

    /*
     * A high ratio on purpose. The shipped default starts at 6% and climbs,
     * which is right for a reader and useless in a screenshot — one changed
     * word in a paragraph reads as a typo rather than as a feature. The
     * listing text says the default is gentler, so this overstates nothing.
     */
    await configure({
      'weave.baseRatio': 0.3,
      'weave.ceilingRatio': 0.6,
      'weave.renderMode': 'wrapped',
      'reveal.hoverDelayMs': 0,
    });

    // 1. The thing itself: French woven into an ordinary English article.
    await capture('01-woven', async (page) => {
      await page.goto(`${origin}/showcase.html`);
      await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1200);
    });

    /*
     * 2. The escape hatch, which is the first question anyone asks.
     *
     * The hovered word is deliberately low and left in the article. The
     * tooltip opens above and to the right of the word, so hovering
     * something in the first paragraph put the panel straight over the
     * headline — a listing screenshot whose main image obscured the title of
     * the page it was demonstrating.
     */
    await capture('02-reveal', async (page) => {
      await page.goto(`${origin}/showcase.html`);
      await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });
      const word = page.locator('#prose-4 weft-w').first();
      if (await word.count()) {
        await word.hover();
        await page.waitForTimeout(700);
      }
    });

    // 3. Old English, the reason this is not another translate extension.
    await configure({
      'learning.activeTarget': 'ang',
      'learning.targetLangs': ['ang'],
      'weave.baseRatio': 0.3,
      'weave.renderMode': 'wrapped',
      'reveal.hoverDelayMs': 0,
    });
    await capture('03-old-english', async (page) => {
      await page.goto(`${origin}/showcase.html`);
      await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });
      const word = page.locator('#prose-4 weft-w').first();
      if (await word.count()) {
        await word.hover();
        await page.waitForTimeout(700);
      }
    });

    // Seed a plausible vocabulary through the real import path so the
    // progress shot shows a populated feed rather than an empty state.
    const day = 86_400_000;
    const now = Date.now();
    const seeded: Record<string, unknown> = {};
    const plan: Array<[string, number, number, number, number]> = [
      ['hūs', 9, 120, 2, 61], ['stān', 8, 90, 1, 54], ['cyning', 7, 64, 3, 48],
      ['hlāford', 6, 41, 2, 39], ['steorfan', 5, 22, 4, 31], ['drēam', 4, 14, 2, 26],
      ['cwēn', 4, 11, 5, 22], ['sōþ', 3, 8, 1, 19], ['morgen', 3, 6, 2, 17],
      ['ǣfen', 2, 4, 1, 14], ['wīfmann', 2, 3, 3, 12], ['hlāf', 2, 2, 1, 11],
      ['sealt', 1, 1.4, 2, 9], ['ġeong', 1, 1.1, 1, 8], ['blæc', 1, 0.9, 2, 7],
      ['fugol', 1, 0.6, 3, 6], ['cwic', 0, 0, 0, 4], ['weġ', 0, 0, 0, 3],
      ['sellan', 0, 0, 0, 2],
    ];
    for (const [lemma, reps, stability, ago, exposures] of plan) {
      seeded[`ang:${lemma}`] = {
        id: `ang:${lemma}`,
        target: 'ang',
        lemma,
        stability,
        difficulty: 5,
        lastReview: reps ? now - ago * day : 0,
        reps,
        lapses: reps > 3 ? 1 : 0,
        exposures,
        firstSeen: now - 30 * day,
        ...(stability >= 60 && reps >= 6 ? { retiredAt: now - ago * day } : {}),
      };
    }
    await rpc({
      type: 'import-data',
      payload: { format: 'weft-export/1', settings: {}, cards: seeded },
    });
    await configure({
      'learning.activeTarget': 'ang',
      'learning.targetLangs': ['ang'],
      'weave.baseRatio': 0.28,
      'weave.ceilingRatio': 0.6,
    });

    /*
     * 4. Progress, and the etymologies that make it worth reading.
     *
     * Scrolled, because a viewport capture of an 800px frame otherwise shows
     * the page header and the top of a chart — true to the product and the
     * least interesting 800 pixels of it. The discoveries feed is the part
     * people repeat to someone else.
     */
    await capture('04-progress', async (page) => {
      await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
      await page.waitForTimeout(1800);
      await page.locator('.section:has(.finds)').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    });

    // 5. The friction, stated plainly. This is the screen-time claim, and
    //    burying it would be a listing that misrepresents the product.
    await capture('05-settings', async (page) => {
      await page.goto(`chrome-extension://${extensionId}/options.html`);
      await page.waitForTimeout(1800);
      await page.locator('.section:has(.band)').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    });
  });
});
