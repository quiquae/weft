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
