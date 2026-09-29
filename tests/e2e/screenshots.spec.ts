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

/**
 * Attention seeded before the dashboard and popup shots, in seconds.
 *
 * Minute-aligned on purpose: `formatDuration` prints whole minutes above 60s,
 * so the seconds a run accrues for itself vanish below the next boundary and
 * the rendered string is the same every time.
 *
 * Half an hour also saturates the site's ceiling, and that is a deliberate
 * cost rather than an accident. Below the ceiling the popup prints a
 * projection instead — "40% after another 7 min", which is the sentence that
 * shows escalation happening, and the committed shot used to carry it. It
 * cannot be made reproducible: the projection is
 * `formatDuration(remaining * 60)` and `remaining` counts *down* by exactly
 * the seconds the run accrues, so `Math.floor(s / 60)` crosses a boundary for
 * every accrual except the knife-edge case where the value sits 59s above
 * one. Saturation is what makes this shot diffable at all. Lower the
 * constant to get the projection back and `popup.png` starts churning again.
 */
export const SEEDED_ATTENTION_SECONDS = 1800;

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

    /*
     * Close both woven pages before touching the store.
     *
     * They are taxed pages running the content script, and while they are
     * open they keep reporting exposures — so the vocabulary list held six
     * words read off `article.html` (`eau`, `jeune`, `route`, `soir`, `un`,
     * `vivant`) on top of the seeded plan, with counts that moved run to run.
     * Resetting the store is not enough on its own if something is still
     * writing to it.
     */
    await reader.close();
    await oe.close();
    /*
     * And let their last writes land before resetting.
     *
     * Closing a taxed page flushes whatever exposures it had pending, which
     * is asynchronous: without this wait the flush races the reset below and
     * lands on either side of it, which is *worse* than leaving the pages
     * open — it drifted five shots rather than one, including
     * `dashboard-transparency.png`, which had been stable throughout.
     */
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Seed a plausible vocabulary through the real import path, so the
    // progress page shows all three stages rather than a single flat band.
    const day = 86_400_000;
    const now = Date.now();
    const seeded: Record<string, unknown> = {};
    // Old English, because those entries carry the etymologies and
    // false-friend notes that the discoveries feed is built from — seeding
    // French would leave that section empty and the screenshot would not
    // show the feature.
    /*
     * French, with entries that carry an etymology, so the discoveries feed
     * in the README shows the feature. Seeding Old English here was why
     * every progress screenshot in the project showed hūs and cyning — the
     * data was only there for the historical languages.
     */
    const plan: Array<[string, number, number, number, number]> = [
      ['rivière', 9, 120, 2, 61], ['montagne', 8, 90, 1, 54], ['roi', 7, 64, 3, 48],
      ['main', 6, 41, 2, 39], ['nuit', 5, 22, 4, 31], ['jour', 4, 14, 2, 26],
      ['cheval', 4, 11, 5, 22], ['forêt', 3, 8, 1, 19], ['matin', 3, 6, 2, 17],
      ['chien', 2, 4, 1, 14], ['oiseau', 2, 3, 3, 12], ['pain', 2, 2, 1, 11],
      ['sel', 1, 1.4, 2, 9], ['pierre', 1, 1.1, 1, 8], ['fenêtre', 1, 0.9, 2, 7],
      ['livre', 1, 0.6, 3, 6], ['mère', 0, 0, 0, 4], ['père', 0, 0, 0, 3],
      ['ami', 0, 0, 0, 2],
    ];
    for (const [lemma, reps, stability, ago, exposures] of plan) {
      seeded[`fr:${lemma}`] = {
        id: `fr:${lemma}`,
        target: 'fr',
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
    /*
     * Wipe the cards the weaving above just created, so the plan is the store.
     *
     * Measured: 12 cards exist here, picked up from `article.html`, with
     * exposure counts that moved run to run — one word was "seen 1x" in one
     * run and "seen 2x" a minute later. That crossed a row in and out of the
     * visible list, which is why `dashboard.png` changed *height* (4145px
     * against 4199px) between two runs of a generator nothing in the product
     * had changed. `import-data` cannot fix it on its own: `mergeCards` takes
     * the max of `exposures` by design, so an import only ever adds to what
     * is already there.
     *
     * Probed rather than assumed: 12 cards before, 0 after, 19 after the
     * import, and those 19 are exactly the plan below.
     *
     * The list in the finished shot holds 26, not 19, and that is expected.
     * The seven extra — `route`, `jeune`, `eau`, `vivant`, `un`, `soir`,
     * `encore` — are written later, by the onboarding page's own live preview
     * when `onboarding.png` is captured: that preview weaves a real passage
     * through the real selector and records real exposures. They are
     * identical every run, so they cost nothing here, but they are a
     * reminder that a preview writes to the learner's vocabulary.
     */
    await rpc({ type: 'reset-vocabulary' });
    await rpc({
      type: 'import-data',
      payload: { format: 'weft-export/1', settings: {}, cards: seeded },
    });
    // Importing validates settings, and a bare settings object resets the
    // site list to the shipped defaults, so reconfigure afterwards.
    await configure({
      'learning.activeTarget': 'fr',
      'learning.targetLangs': ['fr'],
      'weave.baseRatio': 0.28,
      'weave.ceilingRatio': 0.6,
    });

    /*
     * Clear the cooldown the seeding itself queued.
     *
     * Since `splitImportedSettings` landed, an import no longer overwrites
     * settings outright: anything *easier* than the current state becomes a
     * pending change waiting out the user's cooldown. The payload above
     * carries no settings, `validateSettings` fills in the shipped defaults,
     * and those are easier than the density this spec configures — so the
     * import queued "starting density -> 6%; maximum density -> 35%; new
     * words per day -> 12" and both options shots grew a red "One change is
     * waiting" banner ~200px tall. That is the commitment layer working
     * correctly on a payload only the harness would ever send, and it has no
     * place in documentation art.
     *
     * Cancelled by id rather than by matching the settings, so it stays
     * correct whichever field a future default makes easier. Cancelling is
     * instant and free by design, which is the one reason this is safe to do
     * without waiting.
     */
    const queued = await rpc<{ lock: { pending: Array<{ id: string }> } }>({ type: 'get-stats' });
    for (const change of queued.lock.pending) {
      await rpc({ type: 'cancel-pending', id: change.id });
    }

    /*
     * Seed attention to a whole half hour, the same trick and the same figure
     * `store-assets.spec.ts` uses for its progress tile.
     *
     * The popup's attention line and the dashboard's milestone bars are both
     * read off accrued attention, so before this they photographed the clock:
     * a few seconds of real reading, differing every run. It does not need a
     * frozen clock, because `formatDuration` prints whole minutes above 60s,
     * so a minute-aligned seed absorbs whatever the run adds underneath the
     * next boundary. `tests/tools/screenshots.test.ts` re-derives that across
     * the accrual range rather than trusting this comment.
     */
    await rpc({
      type: 'record-attention',
      host: new URL(origin).hostname,
      seconds: SEEDED_ATTENTION_SECONDS,
      url: `${origin}/article.html`,
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
