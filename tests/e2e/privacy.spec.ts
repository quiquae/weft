import { test, expect } from './fixtures.ts';

/**
 * "0 network requests, ever" — checked against the whole browser, not one page.
 *
 * The dashboard shows this as a counted number, and it is the claim the
 * entire product rests on: no account, no server, licences verified
 * on-device. A claim displayed as a measurement has to be measured.
 *
 * There was already a test asserting no traffic during licence activation,
 * but it watched a single extension page. That is much narrower than it
 * looks: a content script's `fetch` appears on the *article* page, and the
 * service worker's appears on neither, so the weaving path — the part that
 * actually sees what you read — could have called out and the assertion
 * would never have noticed.
 *
 * So this listens on the browser context, which covers every page and the
 * service worker, and then does a realistic session: read a page, let it
 * weave, reveal a word, let difficulty climb, and open the progress page.
 *
 * The test origin is allowed, because that is the page being read. Anything
 * else is a bug.
 */

test.describe('the privacy claim', () => {
  test('a full reading session makes no request to anywhere but the page itself', async ({
    context,
    extensionId,
    configure,
    origin,
  }) => {
    const host = new URL(origin).host;
    const external: string[] = [];

    /**
     * Allowed: the extension's own packaged resources, inline data, and the
     * origin of the page being read.
     *
     * Deliberately NOT a list of known-bad domains. A denylist passes a
     * request to a provider nobody thought of; an allowlist fails it.
     */
    const isExternal = (url: string): boolean => {
      if (url.startsWith('chrome-extension://')) return false;
      if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return false;
      try {
        return new URL(url).host !== host;
      } catch {
        return true;
      }
    };

    // On the context, so content scripts, extension pages and the service
    // worker are all covered by one listener.
    context.on('request', (r) => {
      if (isExternal(r.url())) external.push(`${r.method()} ${r.url()}`);
    });

    await configure({
      'weave.baseRatio': 0.3,
      'weave.ceilingRatio': 0.6,
      'weave.gainPerMinute': 0.2,
      'weave.renderMode': 'wrapped',
      'reveal.hoverDelayMs': 0,
    });

    // 1. Read a page and let it weave.
    const reader = await context.newPage();
    await reader.goto(`${origin}/showcase.html`);
    await expect(reader.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });

    // 2. Reveal a word — the path that looks up a translation.
    const word = reader.locator('#prose-2 weft-w').first();
    if (await word.count()) {
      await word.hover();
      await reader.waitForTimeout(600);
    }

    // 3. Spend attention, so the escalation and card-scheduling paths run.
    for (let i = 0; i < 6; i++) {
      await reader.mouse.wheel(0, 220);
      await reader.waitForTimeout(400);
    }

    // 4. Open the progress page, which reads the vocabulary and renders it.
    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await expect(dashboard.locator('.headline')).toBeVisible({ timeout: 10_000 });
    await dashboard.waitForTimeout(1200);

    expect(
      external,
      `Weft contacted something. The dashboard tells users this never ` +
        `happens, so either the request is a bug or the claim is:\n  ` +
        external.join('\n  '),
    ).toEqual([]);

    await reader.close();
    await dashboard.close();
  });

  test('the packaged lexicons are read from disk, not fetched', async ({
    context,
    configure,
    origin,
  }) => {
    /*
     * A pack is a JSON file in the bundle, loaded with a
     * chrome-extension:// URL. If it were ever moved to a CDN — a plausible
     * "improvement", since the packs are most of the download — the privacy
     * claim would quietly become false while every other test still passed.
     */
    const packRequests: string[] = [];
    context.on('request', (r) => {
      if (r.url().includes('/lexicon/')) packRequests.push(r.url());
    });

    await configure({ 'weave.baseRatio': 0.3, 'weave.renderMode': 'wrapped' });
    const reader = await context.newPage();
    await reader.goto(`${origin}/showcase.html`);
    await expect(reader.locator('weft-w').first()).toBeVisible({ timeout: 20_000 });

    expect(packRequests.length, 'no pack was loaded, so this proves nothing').toBeGreaterThan(0);
    for (const url of packRequests) {
      expect(url, 'a lexicon was fetched over the network').toMatch(/^chrome-extension:\/\//);
    }

    await reader.close();
  });
});
