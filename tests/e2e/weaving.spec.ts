import { test, expect, squash, changedWordCount } from './fixtures.ts';

/**
 * End-to-end, in a real Chromium with the extension loaded.
 *
 * These assert the things that unit tests cannot: that the content script is
 * actually registered and runs, that the Custom Highlight API path works in a
 * browser that has it, that the tooltip appears inside its shadow root, and
 * that a page holding stale text-node references is not broken by any of it.
 */

const ORIGINAL_1 =
  'The old house stood at the end of a long road, where the river ran under a stone bridge ' +
  'and the road climbed towards the mountain. In the morning a woman came down from the ' +
  'village with bread and salt, and the young king rode past on a black horse without a word.';

test.describe('weaving a page', () => {
  test('replaces words in prose and leaves the page readable', async ({
    context,
    configure,
    origin,
  }) => {
    await configure({ 'weave.baseRatio': 0.4, 'weave.ceilingRatio': 0.4 });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    const prose = page.locator('#prose-1');
    await expect(prose).toBeVisible();

    // The content script is registered dynamically, so give it a beat.
    await expect
      .poll(async () => squash(await prose.textContent()) !== squash(ORIGINAL_1), {
        timeout: 15_000,
        message: 'prose was never woven',
      })
      .toBe(true);

    const woven = squash(await prose.textContent());
    const changed = changedWordCount(ORIGINAL_1, woven);
    expect(changed, `expected several words to change, got: ${woven}`).toBeGreaterThan(2);

    // Same number of words: a swap is one word for one word.
    expect(woven.split(' ').length).toBe(squash(ORIGINAL_1).split(' ').length);

    // French words we know are in the pack.
    expect(woven).toMatch(/maison|route|rivière|pierre|pont|montagne|femme|village|pain|sel|roi|cheval|noir|mot|matin/);
  });

  test('never touches controls, code, editable text or short sentences', async ({
    context,
    configure,
    origin,
  }) => {
    await configure({ 'weave.baseRatio': 1, 'weave.ceilingRatio': 1 });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    await expect
      .poll(async () => squash(await page.locator('#prose-1').textContent()) !== squash(ORIGINAL_1), {
        timeout: 15_000,
      })
      .toBe(true);

    const untouched: Array<[string, string]> = [
      ['#ctl-button', 'Save the house'],
      ['#short', 'The cat sat.'],
      ['#code', 'const house = "the old house on the road";'],
      ['#editable', 'The house by the water and the road.'],
      ['#foreign', 'La maison au bout de la longue route.'],
      ['#notranslate', 'The house at the end of the road stood alone.'],
      ['#live', 'The water level by the bridge is rising now.'],
      ['#nav', 'Home About'],
    ];

    for (const [selector, expected] of untouched) {
      expect(squash(await page.locator(selector).textContent()), `${selector} was modified`).toBe(
        squash(expected),
      );
    }
  });

  test('reveals the English on hover, in a shadow root', async ({ context, configure, origin }) => {
    await configure({
      'weave.baseRatio': 0.5,
      'weave.ceilingRatio': 0.5,
      'reveal.hoverDelayMs': 0,
      'weave.renderMode': 'wrapped',
    });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);

    const word = page.locator('weft-w').first();
    await expect(word).toBeVisible({ timeout: 15_000 });

    // Wrapped mode is what carries the language tag for a screen reader.
    await expect(word).toHaveAttribute('lang', 'fr');
    const english = await word.getAttribute('title');
    expect(english).toBeTruthy();

    await word.hover();

    /*
     * The tooltip lives in a CLOSED shadow root, which Playwright cannot
     * pierce — and that is the point. In highlight mode the page can read the
     * woven text but not the English behind it, so a closed root stops a site
     * from observing which words its reader did not know. Keeping that
     * property is worth more than an easy assertion, so the end-to-end test
     * proves the tooltip opened and positioned itself, and its contents are
     * asserted in tests/dom/tooltip.test.ts where the root is reachable.
     */
    const host = page.locator('weft-tooltip');
    await expect(host).toHaveCount(1, { timeout: 5000 });
    await expect
      .poll(
        async () => {
          const pos = await host.evaluate((el) => {
            const style = getComputedStyle(el as HTMLElement);
            return { top: parseFloat(style.top), left: parseFloat(style.left) };
          });
          return pos.top > -1000 && pos.left > -1000;
        },
        { timeout: 5000, message: 'the tooltip never moved on-screen' },
      )
      .toBe(true);

    const box = await host.boundingBox();
    expect(box, 'the tooltip has no box, so it did not render').not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThan(80);
  });

  test('styles words without changing the DOM in highlight mode', async ({
    context,
    configure,
    origin,
  }) => {
    await configure({
      'weave.baseRatio': 0.4,
      'weave.ceilingRatio': 0.4,
      'weave.renderMode': 'highlight',
    });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    await expect
      .poll(async () => squash(await page.locator('#prose-1').textContent()) !== squash(ORIGINAL_1), {
        timeout: 15_000,
      })
      .toBe(true);

    // No elements added anywhere in the page.
    expect(await page.locator('weft-w').count()).toBe(0);
    const paragraph = await page.locator('#prose-1').evaluate((el) => ({
      children: el.children.length,
      childNodes: el.childNodes.length,
      firstIsText: el.firstChild?.nodeType === 3,
    }));
    expect(paragraph.children).toBe(0);
    expect(paragraph.childNodes).toBe(1);
    expect(paragraph.firstIsText).toBe(true);

    // And the highlight registry is populated, which is what paints them.
    const highlights = await page.evaluate(() => {
      const registry = (CSS as unknown as { highlights?: Map<string, Set<unknown>> }).highlights;
      if (!registry) return null;
      return {
        woven: registry.get('weft-woven')?.size ?? 0,
        registered: [...registry.keys()],
      };
    });
    expect(highlights, 'the Custom Highlight API should be available in Chromium').not.toBeNull();
    expect(highlights?.registered).toContain('weft-woven');
    expect(highlights?.woven ?? 0).toBeGreaterThan(2);
  });

  test('does not break a page holding stale text-node references', async ({
    context,
    configure,
    origin,
  }) => {
    // This is the failure that translation extensions cause in React: they
    // replace a text node, and the library's stored reference then has no
    // parent, so removeChild throws. Weft edits nodeValue in place.
    await configure({ 'weave.baseRatio': 0.6, 'weave.ceilingRatio': 0.6 });

    const errors: string[] = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`${origin}/reconciler.html`);
    await expect(page.locator('#status')).toHaveText('mounted');
    const ORIGINAL_APP =
      'The old house stood at the end of a long road by the river. ' +
      'A woman came down from the village with bread and salt today. ' +
      'The young king rode past on a black horse without saying a word.';

    await expect
      .poll(async () => squash(await page.locator('#app').textContent()) !== squash(ORIGINAL_APP), {
        timeout: 15_000,
        message: 'the reconciler page was never woven',
      })
      .toBe(true);

    const result = await page.evaluate(() =>
      (window as unknown as { weftUnmount(): string }).weftUnmount(),
    );
    expect(result, 'removeChild threw on a node Weft had rewritten').toBe('unmounted-clean');
    expect(errors).toEqual([]);
  });

  test('keeps weaving content added after load', async ({ context, configure, origin }) => {
    await configure({ 'weave.baseRatio': 0.5, 'weave.ceilingRatio': 0.5 });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);
    await expect
      .poll(async () => squash(await page.locator('#prose-1').textContent()) !== squash(ORIGINAL_1), {
        timeout: 15_000,
      })
      .toBe(true);

    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'added';
      p.textContent =
        'A stranger walked along the river towards the bridge and the mountain beyond the forest.';
      document.body.appendChild(p);
    });

    await expect
      .poll(
        async () =>
          squash(await page.locator('#added').textContent()) !==
          'A stranger walked along the river towards the bridge and the mountain beyond the forest.',
        { timeout: 10_000, message: 'dynamically added prose was never woven' },
      )
      .toBe(true);
  });

  test('weaves Old English, with the etymon in the tooltip', async ({
    context,
    configure,
    origin,
  }) => {
    await configure({
      'learning.activeTarget': 'ang',
      'learning.targetLangs': ['ang'],
      'weave.baseRatio': 0.6,
      'weave.ceilingRatio': 0.6,
      'weave.renderMode': 'wrapped',
      'reveal.hoverDelayMs': 0,
    });

    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);

    const word = page.locator('weft-w').first();
    await expect(word).toBeVisible({ timeout: 15_000 });
    await expect(word).toHaveAttribute('lang', 'ang');

    const prose = squash(await page.locator('#prose-1').textContent());
    // Old English forms from the pack.
    expect(prose).toMatch(/hūs|weġ|ēa|stān|brycg|beorg|morgen|wīfmann|þorp|hlāf|sealt|cyning|hors|blæc|word/);

    // Every woven word exposes its English without needing the tooltip, which
    // is what a screen reader reads. The etymon badge itself is asserted in
    // tests/dom/tooltip.test.ts, where the closed shadow root is reachable.
    const first = page.locator('weft-w').first();
    expect(await first.getAttribute('title')).toBeTruthy();
    expect(await first.getAttribute('aria-description')).toContain('in ang');
  });
});

test.describe('announcing swaps to a screen reader', () => {
  /*
   * `a11y.announceSwaps` shipped as a setting that did nothing: no live
   * region was ever created, so a reader who found the toggle and switched
   * it on got silence. The unit tests cover the region's own behaviour;
   * this covers the part they cannot, which is whether the content script
   * actually builds one on a real page and feeds it.
   */
  test('a live region appears and carries the English on reveal', async ({
    context,
    configure,
    origin,
  }) => {
    await configure({
      'weave.baseRatio': 0.3,
      'weave.renderMode': 'wrapped',
      'reveal.hoverDelayMs': 0,
      'a11y.announceSwaps': true,
    });

    const page = await context.newPage();
    await page.goto(`${origin}/showcase.html`);
    await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });

    const region = page.locator('[data-weft-announcer]');
    await expect(region).toHaveCount(1);
    await expect(region).toHaveAttribute('role', 'status');
    await expect(region).toHaveAttribute('aria-live', 'polite');

    // The page summary lands once weaving settles.
    await expect(region).toContainText(/words on this page are in/i, { timeout: 10_000 });

    // Revealing a word must say it. This is the moment the reader is
    // waiting to hear something, and the tooltip alone is visual.
    const word = page.locator('#prose-2 weft-w').first();
    await word.hover();
    await expect(region).toContainText('—', { timeout: 5_000 });
  });

  test('the region exists before anything is announced', async ({ context, configure, origin }) => {
    /*
     * The discriminating test, and the reason the first version of this
     * block was worthless: Announcer.say() creates the region lazily if one
     * is missing, so any page that announces something ends up with a
     * region whether or not the content script ever called start(). I
     * removed the start() call to check the test caught it and it passed
     * happily.
     *
     * A live region has to exist BEFORE its text changes or the change is
     * announced unreliably, so eager creation is the property worth
     * protecting. Weaving nothing is what separates the two: no swaps means
     * no summary and no reveal, so the region can only be there if it was
     * created up front.
     */
    await configure({
      'weave.baseRatio': 0,
      'weave.ceilingRatio': 0,
      'weave.renderMode': 'wrapped',
      'a11y.announceSwaps': true,
    });

    const page = await context.newPage();
    await page.goto(`${origin}/showcase.html`);
    // Nothing is woven at ratio zero, so wait on the region itself.
    const region = page.locator('[data-weft-announcer]');
    await expect(region, 'the region is created lazily, not up front').toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator('weft-w')).toHaveCount(0);
    await expect(region).toHaveText('');
  });

  test('no region exists when the setting is off', async ({ context, configure, origin }) => {
    // The default. An empty live region is harmless but it is still a node
    // injected into someone's page for no reason.
    await configure({
      'weave.baseRatio': 0.3,
      'weave.renderMode': 'wrapped',
      'a11y.announceSwaps': false,
    });
    const page = await context.newPage();
    await page.goto(`${origin}/showcase.html`);
    await expect(page.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-weft-announcer]')).toHaveCount(0);
  });
});
