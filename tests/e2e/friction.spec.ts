import { test, expect, squash } from './fixtures.ts';

/**
 * The behaviour that makes Weft more than a vocabulary toy: difficulty that
 * rises with attention, a cooldown that holds, and an escape valve that
 * works.
 */

test.describe('the attention tax', () => {
  test('difficulty rises while you keep reading', async ({ context, configure, origin }) => {
    // A steep curve so the effect is measurable in a test rather than in an
    // afternoon. The shape is unit-tested; this proves the loop is wired:
    // content script counts attention, worker recomputes, page re-weaves.
    await configure({
      'weave.baseRatio': 0.05,
      'weave.ceilingRatio': 0.9,
      'attention.gainPerMinute': 2,
      'attention.idleThresholdSec': 120,
      'weave.renderMode': 'wrapped',
      'weave.minWordGap': 1,
      'weave.maxPerSentence': 12,
    });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    await page.bringToFront();

    const words = page.locator('weft-w');
    await expect(words.first()).toBeVisible({ timeout: 15_000 });
    const before = await words.count();
    expect(before, 'nothing was woven at the resting density').toBeGreaterThan(0);

    // Real input events, so the tracker counts the time as attention.
    const deadline = Date.now() + 16_000;
    let x = 200;
    while (Date.now() < deadline) {
      x = x === 200 ? 260 : 200;
      await page.mouse.move(x, 300);
      await page.mouse.wheel(0, 1);
      await page.waitForTimeout(400);
    }

    await expect
      .poll(async () => words.count(), {
        timeout: 20_000,
        message: `density never rose above the ${before} words woven at rest`,
      })
      .toBeGreaterThan(before);

    const after = await words.count();
    expect(after).toBeGreaterThan(before);
  });

  test('words already woven stay woven as difficulty climbs', async ({
    context,
    configure,
    origin,
  }) => {
    // Prefix-monotone selection is what makes escalation bearable: a word you
    // have just decoded must not flip back to English as the page gets harder
    // around it.
    await configure({
      'weave.baseRatio': 0.1,
      'weave.ceilingRatio': 0.9,
      'attention.gainPerMinute': 2,
      'attention.idleThresholdSec': 120,
      'weave.renderMode': 'wrapped',
      'weave.minWordGap': 1,
      'weave.maxPerSentence': 12,
    });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    await page.bringToFront();
    await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 15_000 });

    const firstSet = new Set(
      await page.locator('#prose-1 weft-w').evaluateAll((els) =>
        els.map((el) => `${el.getAttribute('title')}→${el.textContent}`),
      ),
    );
    expect(firstSet.size).toBeGreaterThan(0);

    const deadline = Date.now() + 14_000;
    while (Date.now() < deadline) {
      await page.mouse.wheel(0, 1);
      await page.waitForTimeout(400);
    }

    const laterSet = new Set(
      await page.locator('#prose-1 weft-w').evaluateAll((els) =>
        els.map((el) => `${el.getAttribute('title')}→${el.textContent}`),
      ),
    );

    for (const pair of firstSet) {
      expect(laterSet.has(pair), `"${pair}" stopped being woven as difficulty rose`).toBe(true);
    }
  });
});

test.describe('the escape valve', () => {
  test('a panic pass returns the page to plain English', async ({
    context,
    configure,
    origin,
    rpc,
  }) => {
    await configure({
      'weave.baseRatio': 0.5,
      'weave.ceilingRatio': 0.5,
      'friction.panicPassesPerDay': 2,
      'friction.panicMinutes': 5,
      'weave.renderMode': 'wrapped',
    });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 15_000 });

    const granted = await rpc<{ granted: boolean; message: string }>({ type: 'use-panic' });
    expect(granted.granted).toBe(true);

    await expect
      .poll(async () => page.locator('weft-w').count(), {
        timeout: 10_000,
        message: 'the panic pass did not clear the page',
      })
      .toBe(0);

    const prose = squash(await page.locator('#prose-1').textContent());
    expect(prose).toContain('The old house stood at the end of a long road');
  });

  test('panic passes are capped per day', async ({ configure, rpc }) => {
    await configure({ 'friction.panicPassesPerDay': 1, 'friction.panicMinutes': 1 });
    const first = await rpc<{ granted: boolean }>({ type: 'use-panic' });
    expect(first.granted).toBe(true);

    // The pass is still running, so asking again reports it rather than
    // spending a second one.
    const second = await rpc<{ granted: boolean; message: string }>({ type: 'use-panic' });
    expect(second.granted).toBe(true);
    expect(second.message).toMatch(/already running/i);
  });
});

test.describe('the commitment lock', () => {
  test('an easier setting is queued, not applied', async ({ configure, rpc }) => {
    await configure({
      'weave.baseRatio': 0.4,
      'weave.ceilingRatio': 0.6,
      'friction.cooldownMinutes': 60,
    });

    const result = await rpc<{ applied: boolean; message: string; pending?: { id: string } }>({
      type: 'request-change',
      patch: { 'weave.baseRatio': 0.02 },
    });
    expect(result.applied).toBe(false);
    expect(result.message).toMatch(/Unlocks/i);
    expect(result.pending?.id).toBeTruthy();

    const after = await rpc<{ settings: { weave: { baseRatio: number } } }>({ type: 'get-settings' });
    expect(after.settings.weave.baseRatio, 'the change must not have taken effect').toBeCloseTo(0.4, 5);

    const lock = await rpc<{ lock: { pending: unknown[] } }>({ type: 'get-lock-state' });
    expect(lock.lock.pending.length).toBe(1);
  });

  test('a harder setting applies immediately', async ({ configure, rpc }) => {
    await configure({ 'weave.baseRatio': 0.1, 'friction.cooldownMinutes': 60 });
    const result = await rpc<{ applied: boolean }>({
      type: 'request-change',
      patch: { 'weave.baseRatio': 0.5 },
    });
    expect(result.applied).toBe(true);
    const after = await rpc<{ settings: { weave: { baseRatio: number } } }>({ type: 'get-settings' });
    expect(after.settings.weave.baseRatio).toBeCloseTo(0.5, 5);
  });

  test('re-requesting the same change does not restart the clock', async ({ configure, rpc }) => {
    await configure({ 'weave.baseRatio': 0.4, 'friction.cooldownMinutes': 60 });
    const first = await rpc<{ pending?: { unlocksAt: number } }>({
      type: 'request-change',
      patch: { 'weave.baseRatio': 0.02 },
    });
    const unlocksAt = first.pending?.unlocksAt as number;
    expect(unlocksAt).toBeTruthy();

    const again = await rpc<{ applied: boolean; message: string; pending?: { unlocksAt: number } }>({
      type: 'request-change',
      patch: { 'weave.baseRatio': 0.02 },
    });
    expect(again.applied).toBe(false);
    expect(again.message).toMatch(/Already waiting/i);
    expect(again.pending?.unlocksAt).toBe(unlocksAt);
  });

  test('cancelling a queued change is immediate and free', async ({ configure, rpc }) => {
    await configure({ 'weave.baseRatio': 0.4, 'friction.cooldownMinutes': 60 });
    const queued = await rpc<{ pending?: { id: string } }>({
      type: 'request-change',
      patch: { 'weave.baseRatio': 0.02 },
    });
    await rpc({ type: 'cancel-pending', id: queued.pending?.id });
    const lock = await rpc<{ lock: { pending: unknown[] } }>({ type: 'get-lock-state' });
    expect(lock.lock.pending.length).toBe(0);
  });

  test('the settings page shows a waiting change with a countdown', async ({
    context,
    extensionId,
    configure,
    rpc,
  }) => {
    await configure({ 'weave.baseRatio': 0.4, 'friction.cooldownMinutes': 60 });
    await rpc({ type: 'request-change', patch: { 'weave.baseRatio': 0.02 } });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    const panel = page.locator('.pending');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel).toContainText('starting density');
    await expect(panel).toContainText(/Unlocks in/i);
    await expect(panel.locator('button', { hasText: 'Cancel' })).toBeVisible();
  });
});

test.describe('sites Weft must not touch', () => {
  test('an excluded host is left entirely alone', async ({ context, configure, origin, rpc }) => {
    const host = new URL(origin).hostname;
    await configure({ 'weave.baseRatio': 0.6, 'weave.ceilingRatio': 0.6 });
    // The exclusion list beats every other rule, so this must win over the
    // taxed entry for the same host.
    await rpc({ type: 'request-change', patch: { 'sites.excluded': [host] } });
    await rpc({ type: 'reregister-scripts' });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    await page.waitForTimeout(4000);

    expect(await page.locator('weft-w').count()).toBe(0);
    expect(squash(await page.locator('#prose-1').textContent())).toContain(
      'The old house stood at the end of a long road, where the river ran under a stone bridge',
    );
  });
});

test.describe('the progress page', () => {
  test('reports words met after reading', async ({ context, extensionId, configure, origin }) => {
    await configure({ 'weave.baseRatio': 0.6, 'weave.ceilingRatio': 0.6 });

    const reader = await context.newPage();
    await reader.goto(`${origin}/article.html`);
    await reader.bringToFront();
    // Exposures are recorded only for words actually on screen, sampled while
    // the reader is attending, then flushed in a batch.
    for (let i = 0; i < 20; i++) {
      await reader.mouse.wheel(0, 1);
      await reader.waitForTimeout(400);
    }

    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await expect(dashboard.locator('.headline')).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(
        async () => {
          await dashboard.reload();
          const rows = await dashboard.locator('.vocab__row').count();
          return rows;
        },
        { timeout: 25_000, message: 'no vocabulary was recorded' },
      )
      .toBeGreaterThan(0);

    await expect(dashboard.locator('.headline')).toContainText(/words of French/);
    await expect(dashboard.locator('.tile').first()).toBeVisible();
  });
});

test.describe('the notification fallback', () => {
  /*
   * Safari has never implemented browser.notifications, so `notify()` falls
   * back to marking the toolbar button. That fallback shipped with a bug: it
   * set the badge and never took it off, and `setTitle` replaces the tooltip
   * outright, so the button would go on describing a cooldown that had
   * finished days ago.
   *
   * Safari cannot be driven by Playwright, so the fallback itself is not
   * reachable here — on Chrome the notifications branch is taken. What IS
   * reachable, and what actually broke, is the clearing half: whether
   * opening the popup takes the badge back off. So the test sets the badge
   * the way the fallback would and then checks the popup's own handshake
   * clears it.
   */
  test('opening the popup clears a badge left by the fallback', async ({
    context,
    extensionId,
    origin,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    // Set it exactly as notify() does when notifications are unavailable.
    await page.evaluate(async () => {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setTitle({ title: 'Weft — a change you queued has taken effect' });
    });
    expect(await page.evaluate(() => chrome.action.getBadgeText({}))).toBe('!');

    // get-page-state is the popup's first call, so it is the acknowledgement.
    await page.evaluate(async (url) => {
      await chrome.runtime.sendMessage({ type: 'get-page-state', url });
    }, `${origin}/article.html`);

    await expect
      .poll(async () => page.evaluate(() => chrome.action.getBadgeText({})), {
        timeout: 5_000,
        message: 'the badge was never cleared, so it would stay until reinstall',
      })
      .toBe('');

    // The title has to come back too. An empty string restores the
    // manifest's default_title rather than leaving a stale sentence.
    const title = await page.evaluate(() => chrome.action.getTitle({}));
    expect(title).not.toContain('taken effect');

    await page.close();
  });
});

test.describe('taking your data with you', () => {
  /*
   * Export is in NEVER_GATED — it is promised to free users forever — and
   * losing someone's vocabulary is the worst bug this product could have.
   * The merge rule that import uses is unit-tested; this covers the rest of
   * the path, which the unit tests cannot reach: exportAll, the settings
   * validation on the way in, and the re-signing of imported state with THIS
   * install's key.
   */
  test('a round trip keeps the vocabulary and re-signs it', async ({ rpc }) => {
    const day = 86_400_000;
    const now = Date.now();

    const seeded = {
      'fr:maison': {
        id: 'fr:maison',
        target: 'fr',
        lemma: 'house',
        stability: 120,
        difficulty: 4,
        lastReview: now - 2 * day,
        reps: 9,
        lapses: 1,
        exposures: 61,
        firstSeen: now - 30 * day,
        retiredAt: now - 2 * day,
      },
      'fr:riviere': {
        id: 'fr:riviere',
        target: 'fr',
        lemma: 'river',
        stability: 3,
        difficulty: 7,
        lastReview: now - day,
        reps: 2,
        lapses: 2,
        exposures: 11,
        firstSeen: now - 10 * day,
      },
    };

    await rpc({ type: 'import-data', payload: { format: 'weft-export/1', settings: {}, cards: seeded } });

    const exported = await rpc<{ payload: Record<string, unknown> }>({ type: 'export-data' });
    const payload = exported.payload;

    expect(payload['format']).toBe('weft-export/1');

    // The install id is signing key material and an export is a file people
    // attach to bug reports, so it is blanked rather than omitted — the
    // field stays so the shape is stable, the value goes.
    const settingsOut = payload['settings'] as Record<string, unknown>;
    expect(settingsOut['installId'], 'the signing id leaked into an export').toBe('');
    expect(Object.keys(payload), 'the licence key is the customer’s, not ours to export')
      .not.toContain('licence');

    const cardsOut = payload['cards'] as Record<string, { reps: number; retiredAt?: number }>;
    expect(cardsOut['fr:maison']?.reps).toBe(9);
    expect(cardsOut['fr:maison']?.retiredAt, 'retirement was lost on the way out').toBeTruthy();
    expect(cardsOut['fr:riviere']?.reps).toBe(2);

    // Import the file back. This is the case the old merge rule got wrong:
    // re-importing your own export must be a no-op, not a reset.
    await rpc({ type: 'import-data', payload });
    const again = await rpc<{ payload: Record<string, unknown> }>({ type: 'export-data' });
    const after = again.payload['cards'] as Record<string, { reps: number; exposures: number }>;

    expect(after['fr:maison']?.reps, 'a round trip lost reviews').toBe(9);
    expect(after['fr:maison']?.exposures, 'a round trip inflated exposures').toBe(61);
    expect(after['fr:riviere']?.reps).toBe(2);
  });

  test('importing a file cannot clear a cooldown', async ({ rpc }) => {
    /*
     * An export carries the lock state, including anything queued. Import
     * deliberately ignores it, and that asymmetry is load-bearing rather
     * than an oversight: if import restored the lock, the whole commitment
     * device would come apart — export before requesting an easier setting,
     * wait nothing, import the old file, and the pending change and its
     * clock are gone.
     *
     * Nothing said so, and "make export/import round-trip completely" is
     * exactly the kind of tidying a future change would do. This test is
     * here to fail when it does.
     */
    const before = await rpc<{ payload: Record<string, unknown> }>({ type: 'export-data' });

    const queued = await rpc<{ applied: boolean }>({
      type: 'request-change',
      patch: { 'weave.baseRatio': 0.01 },
    });
    expect(queued.applied, 'an easier setting should be queued, not applied').toBe(false);

    const waiting = await rpc<{ lock: { pending: unknown[] } }>({ type: 'get-lock-state' });
    expect(waiting.lock.pending.length, 'nothing was queued, so this proves nothing').toBe(1);

    // Import the pre-cooldown file. The queued change must survive.
    await rpc({ type: 'import-data', payload: before.payload });

    const after = await rpc<{ lock: { pending: unknown[] } }>({ type: 'get-lock-state' });
    expect(
      after.lock.pending.length,
      'importing an older export erased a pending change — that is a cooldown bypass',
    ).toBe(1);
  });
});

test.describe('turning a site on from the popup', () => {
  /*
   * The most common thing anyone wants from the popup, and for a long time
   * the one thing it would not do: on a site that is not on the list it said
   * "Add it in settings" and sent the reader off to work out that sites are
   * added by typing a pattern into a list.
   *
   * permissions.request needs a user gesture, so this has to happen in the
   * popup rather than the worker. In the test build localhost is already a
   * static host permission, so the call resolves without the native dialog
   * that Playwright cannot dismiss — the rest of the path is the shipping
   * path.
   */
  test('one click adds the current site and it takes effect', async ({
    context,
    extensionId,
    rpc,
    origin,
  }) => {
    const host = new URL(origin).hostname;

    // Start from a clean list so the assertion means something.
    await rpc({
      type: 'complete-onboarding',
      patch: {
        'sites.taxed': [],
        'sites.gentle': [],
        'weave.baseRatio': 0.3,
        // Wrapped, because the assertion below looks for weft-w elements.
        // Highlight mode styles ranges and creates no elements at all, so
        // the first version of this test failed against a working feature.
        'weave.renderMode': 'wrapped',
      },
      origins: [],
    });

    const before = await rpc<{ settings: { sites: { taxed: unknown[] } } }>({ type: 'get-settings' });
    expect(before.settings.sites.taxed, 'the list should start empty').toHaveLength(0);

    const popup = await context.newPage();
    await popup.addInitScript(
      ({ url }) => {
        const query = chrome.tabs.query.bind(chrome.tabs);
        (chrome.tabs as unknown as { query: unknown }).query = async (info: unknown) => {
          const real = await query(info as chrome.tabs.QueryInfo);
          return real.map((tab) => ({ ...tab, url }));
        };
        // The popup reloads the active tab and closes itself on success;
        // neither is meaningful when the popup IS the active tab.
        (chrome.tabs as unknown as { reload: unknown }).reload = async () => {};
        window.close = () => {};
      },
      { url: `${origin}/showcase.html` },
    );
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    const add = popup.getByRole('button', { name: new RegExp(`weave ${host}`, 'i') });
    await expect(add, 'the popup did not offer to weave this site').toBeVisible({ timeout: 10_000 });
    await add.click();

    await expect
      .poll(
        async () => {
          const s = await rpc<{ settings: { sites: { taxed: Array<{ pattern: string }> } } }>({
            type: 'get-settings',
          });
          return s.settings.sites.taxed.map((r) => r.pattern);
        },
        { timeout: 10_000, message: 'the site was never added' },
      )
      .toContain(host);

    await popup.close();

    // And it must actually weave, not merely appear in a list.
    await rpc({ type: 'reregister-scripts' });
    const page = await context.newPage();
    await page.goto(`${origin}/showcase.html`);
    await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });
    await page.close();
  });
});

test.describe('the progress page before you have done anything', () => {
  /*
   * A fresh install opening Progress used to meet "You have read 0 words",
   * four zero tiles, "Nothing learned yet" under a heading about where your
   * vocabulary stands, and a flat chart reading "peak 0s". Each panel was
   * correct and the page as a whole read as broken, on the first screen
   * someone opens after installing.
   */
  test('shows an explanation, not a wall of zeros', async ({ context, extensionId, rpc }) => {
    await rpc({ type: 'reset-vocabulary', confirm: 'yes' });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);

    await expect(page.locator('.empty__lead')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.headline')).toHaveCount(0);
    await expect(page.locator('.tiles')).toHaveCount(0);

    // The history panels describe a history there is none of.
    await expect(page.getByText('Where your vocabulary stands')).toHaveCount(0);
    await expect(page.getByText('Nothing learned yet')).toHaveCount(0);

    /*
     * But the transparency panel stays. "0 requests" is the most useful
     * thing this page can tell someone who has just installed an extension
     * and wants to know what it is doing, so it is the one panel that is
     * worth more empty than full.
     */
    await expect(page.getByText('What has left this machine')).toBeVisible();
    await expect(page.getByText(/network requests, ever/i)).toBeVisible();

    await page.close();
  });
});

test.describe('the locked-feature rows', () => {
  /*
   * `.locked` is a flex container, and the message used to be loose inline
   * content: the text, the "Part of Pro" link and the full stop each became
   * their own flex item. The link collapsed into a narrow column reading
   * "Part / of / Pro" with a stray period beside it — on every locked row,
   * which for a free reader is most of the settings page.
   *
   * Measured rather than eyeballed, because the markup looked entirely
   * reasonable and only the layout was wrong.
   */
  test('the Pro link reads as one line, not a narrow column', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const link = page.locator('.locked a').first();
    await expect(link).toBeVisible({ timeout: 10_000 });

    const box = await link.boundingBox();
    expect(box, 'the Pro link has no box').not.toBeNull();

    // One line of 13px text is ~16-20px tall. Three stacked lines is ~50px.
    expect(
      box!.height,
      `the Pro link is ${Math.round(box!.height)}px tall, so it has wrapped into a column`,
    ).toBeLessThan(30);
    // And it should be wider than it is tall — "Part of Pro" on one line.
    expect(box!.width).toBeGreaterThan(box!.height);

    await page.close();
  });
});
