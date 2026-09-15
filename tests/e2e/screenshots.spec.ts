import { test, expect } from './fixtures.ts';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Capture the interface, for review and for the store listing.
 *
 * Tagged so it does not run in the normal suite: `npx playwright test
 * screenshots`. Every shot is of the real extension driving a real page.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/screens');

test.describe('screenshots', () => {
  test.skip(({}) => process.env['WEFT_SCREENS'] !== '1', 'set WEFT_SCREENS=1');

  // Fourteen surfaces, three of which have to load and weave a real page
  // first. The default sixty seconds is not enough, and when it runs out the
  // fixture's HTTP server is torn down mid-run, which surfaces as a confusing
  // connection-refused rather than as a timeout.
  test.setTimeout(300_000);

  test('capture every surface', async ({ context, extensionId, configure, origin, rpc }) => {
    await mkdir(OUT, { recursive: true });

    // --- the woven page, light and dark ---
    await configure({
      'weave.baseRatio': 0.28,
      'weave.ceilingRatio': 0.6,
      'weave.renderMode': 'highlight',
      'reveal.hoverDelayMs': 0,
    });

    const reader = await context.newPage();
    await reader.setViewportSize({ width: 860, height: 760 });
    await reader.goto(`${origin}/article.html`);
    await reader.waitForTimeout(3500);
    await reader.screenshot({ path: join(OUT, 'page-woven.png') });

    // The tooltip, revealed over a woven word. Hit-testing is by caret
    // position in highlight mode, so aim at a word we know was swapped.
    await configure({ 'weave.renderMode': 'wrapped' });
    const wrapped = await context.newPage();
    await wrapped.setViewportSize({ width: 860, height: 620 });
    await wrapped.goto(`${origin}/article.html`);
    await expect(wrapped.locator('weft-w').first()).toBeVisible({ timeout: 15_000 });
    const target = wrapped.locator('#prose-2 weft-w').first();
    if (await target.count()) {
      await target.hover();
      await wrapped.waitForTimeout(500);
    }
    await wrapped.screenshot({ path: join(OUT, 'page-tooltip.png') });

    // --- Old English, which is the reason to look twice ---
    await configure({
      'learning.activeTarget': 'ang',
      'learning.targetLangs': ['ang'],
      'weave.baseRatio': 0.3,
      'weave.renderMode': 'wrapped',
      'reveal.hoverDelayMs': 0,
    });
    const oe = await context.newPage();
    await oe.setViewportSize({ width: 860, height: 620 });
    await oe.goto(`${origin}/article.html`);
    await expect(oe.locator('weft-w').first()).toBeVisible({ timeout: 15_000 });
    const oeWord = oe.locator('#prose-1 weft-w').first();
    await oeWord.hover();
    await oe.waitForTimeout(500);
    await oe.screenshot({ path: join(OUT, 'page-old-english.png') });

    // Seed a plausible vocabulary through the real import path, so the
    // progress page shows all three stages rather than a single flat band.
    const day = 86_400_000;
    const now = Date.now();
    const seeded: Record<string, unknown> = {};
    // Old English, because those entries carry the etymologies and
    // false-friend notes that the discoveries feed is built from — seeding
    // French would leave that section empty and the screenshot would not
    // show the feature.
    const plan: Array<[string, number, number, number, number]> = [
      // lemma, reps, stability, daysSinceReview, exposures
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
    // Importing validates settings, and a bare settings object resets the
    // site list to the shipped defaults, so reconfigure afterwards.
    await configure({
      'learning.activeTarget': 'ang',
      'learning.targetLangs': ['ang'],
      'weave.baseRatio': 0.28,
      'weave.ceilingRatio': 0.6,
    });

    // --- extension surfaces ---
    const shots: Array<[string, string, { width: number; height: number }]> = [
      ['onboarding.html', 'onboarding.png', { width: 900, height: 900 }],
      ['options.html', 'options.png', { width: 900, height: 1400 }],
      ['dashboard.html', 'dashboard.png', { width: 900, height: 1250 }],
    ];

    for (const [page, file, size] of shots) {
      const view = await context.newPage();
      await view.setViewportSize(size);
      await view.goto(`chrome-extension://${extensionId}/${page}`);
      await view.waitForTimeout(1200);
      await view.screenshot({ path: join(OUT, file), fullPage: file !== 'onboarding.png' });
      await view.close();
    }

    // Close-ups of the two parts that carry the product's identity: the
    // vocabulary list, set as glosses, and a settings block with its sigla.
    const detail = await context.newPage();
    await detail.setViewportSize({ width: 900, height: 900 });
    await detail.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await detail.waitForTimeout(1200);
    // Clipped page shots with a margin, not element shots: an element
    // screenshot cuts at the element's own box and shaves the right-aligned
    // values, which looks like a layout bug and is not one.
    const shoot = async (selector: string, file: string) => {
      const target = detail.locator(selector).first();
      if (!(await target.count())) return;
      const box = await target.boundingBox();
      if (!box) return;
      const pad = 18;
      await detail.screenshot({
        path: join(OUT, file),
        // fullPage so the clip is interpreted in page coordinates; the
        // sections we want sit below the fold.
        fullPage: true,
        clip: {
          x: Math.max(0, box.x - pad),
          y: Math.max(0, box.y - pad),
          width: box.width + pad * 2,
          height: Math.min(box.height + pad * 2, 1400),
        },
      });
    };

    await shoot('.section:has(.finds)', 'dashboard-discoveries.png');
    await shoot('.section:has(.marks)', 'dashboard-milestones.png');
    await shoot('.section:has(.transparency)', 'dashboard-transparency.png');
    await shoot('.section:has(.vocab)', 'dashboard-vocabulary.png');
    await detail.goto(`chrome-extension://${extensionId}/options.html`);
    await detail.waitForTimeout(1200);
    await shoot('.section:has(.band)', 'options-density.png');
    await detail.close();

    /*
     * The popup reads the active tab, and when it is opened as a tab for a
     * screenshot the active tab is itself — a chrome-extension page, which
     * Weft correctly refuses to touch. Stubbing the two browser calls it
     * makes is a test-only override of the browser API, not a change to the
     * product: the popup's own logic runs untouched.
     */
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 340, height: 330 });
    await popup.addInitScript(
      ({ url }) => {
        const query = chrome.tabs.query.bind(chrome.tabs);
        (chrome.tabs as unknown as { query: unknown }).query = async (info: unknown) => {
          const real = await query(info as chrome.tabs.QueryInfo);
          return real.map((tab) => ({ ...tab, url }));
        };
        (chrome.tabs as unknown as { sendMessage: unknown }).sendMessage = async () => ({
          pairs: [
            { target: 'rivière', source: 'river' },
            { target: 'cheval', source: 'horse' },
            { target: 'matin', source: 'morning' },
          ],
          ratio: 0.34,
        });
      },
      { url: `${origin}/article.html` },
    );
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1500);
    await popup.screenshot({ path: join(OUT, 'popup.png') });
    await popup.close();

    // --- dark mode, for the two surfaces where it matters most ---
    for (const [page, file, size] of [
      ['options.html', 'options-dark.png', { width: 900, height: 1000 }],
      ['dashboard.html', 'dashboard-dark.png', { width: 900, height: 1000 }],
    ] as Array<[string, string, { width: number; height: number }]>) {
      const view = await context.newPage();
      await view.emulateMedia({ colorScheme: 'dark' });
      await view.setViewportSize(size);
      await view.goto(`chrome-extension://${extensionId}/${page}`);
      await view.waitForTimeout(1200);
      await view.screenshot({ path: join(OUT, file) });
      await view.close();
    }
  });
});
