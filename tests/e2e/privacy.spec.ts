import { test, expect } from './fixtures.ts';
import { dayKey } from '../../src/core/escalation.ts';
import { howToStop, whatIsSent } from '../../src/core/sending.ts';

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

test.describe('what a fresh install may touch', () => {
  /*
   * Weft asks for no site at install. The browser grants an extension the
   * host permissions its manifest declares and none of its optional ones, so
   * a production install holds no origin at all, and this test build holds
   * exactly the loopback seam it declares for the server below. And with no
   * site the user chose among the origins granted, the worker's install
   * handler registers no content script.
   *
   * CLAUDE.md said this was asserted for a month before anything asserted
   * it. tests/tools/install-permissions.test.ts holds the manifests; this
   * holds what the browser made of one.
   */
  test('is granted only what its manifest declares, and runs on no page', async ({
    context,
    extensionId,
    worker,
    configure,
    origin,
  }) => {
    // The install handler opens the first-run page only after
    // registerContentScripts() has resolved, so its tab says the handler ran.
    await expect
      .poll(() => context.pages().some((p) => p.url() === `chrome-extension://${extensionId}/onboarding.html`), {
        timeout: 20_000,
        message: 'the install handler never opened the first-run page',
      })
      .toBe(true);

    const read = () =>
      worker.evaluate(async () => {
        const manifest = chrome.runtime.getManifest();
        return {
          staticScripts: manifest.content_scripts ?? null,
          declared: [...(manifest.host_permissions ?? [])].sort(),
          granted: [...((await chrome.permissions.getAll()).origins ?? [])].sort(),
          registered: (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.matches ?? []),
        };
      });

    const fresh = await read();
    expect(fresh.staticScripts, 'the loaded manifest declares static content_scripts').toBeNull();
    expect(fresh.granted, 'the browser granted an origin the manifest does not declare').toEqual(fresh.declared);
    expect(fresh.registered, 'a fresh install registered a content script').toEqual([]);

    // The read can see a registration: once the user names the site, there is one.
    await configure({});
    const named = await read();
    expect(named.registered.length, 'naming a site registered no content script, so the empty read proves nothing').toBe(1);
    expect(named.registered[0]).toContain(`http://${new URL(origin).hostname}/*`);
  });
});

test.describe('what has left this machine today', () => {
  /*
   * The daily lookup limit counts the words sent on Weft's day, a failed
   * request included (`tests/core/lookup-limit.test.ts`). The panel that
   * counts every request since install also shows that day's words against
   * the limit, so the limit is checkable the way the request count is,
   * rather than a sentence on the settings page.
   *
   * The log is seeded in storage rather than earned, because nothing in this
   * suite may reach a real translation service.
   */
  test('the network panel shows the day’s words against the limit', async ({ context, extensionId, worker }) => {
    const log = {
      requests: 3,
      words: 1240,
      hosts: ['api-free.deepl.com'],
      last: Date.now(),
      today: { day: dayKey(Date.now(), 4), words: 120 },
    };
    await worker.evaluate(async (value) => {
      await chrome.storage.local.set({ 'weft:network': value });
    }, log);

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await expect(page.getByText(/network requests, carrying 1,240 individual words/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Today, 120 of the 2,000 words the daily lookup limit allows.')).toBeVisible();
    await page.close();
  });

  /**
   * With “Send the surrounding sentence” on, the OpenAI-compatible service is
   * sent the sentence each word appears in. Until 2026-11-03 the panel said
   * "Only isolated words are ever sent, never page text." whatever the
   * setting said, and the settings page's notice "It does not send the page,
   * the sentence, …" two rows above the switch that sends it.
   */
  test('with sentence context on, the dashboard and the settings say the sentence goes', async ({
    context,
    extensionId,
    worker,
    rpc,
  }) => {
    const change = await rpc<{ applied: boolean }>({
      type: 'request-change',
      patch: { 'providers.enabled': true, 'providers.sendContext': true },
    });
    expect(change.applied).toBe(true);
    const log = {
      requests: 1,
      words: 40,
      hosts: ['api.openai.com'],
      last: Date.now(),
      today: { day: dayKey(Date.now(), 4), words: 40 },
    };
    await worker.evaluate(async (value) => {
      await chrome.storage.local.set({ 'weft:network': value });
    }, log);

    const sending = { enabled: true, sendContext: true };
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await expect(page.getByText(/network requests, carrying 40 individual words/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`${whatIsSent(sending)} ${howToStop(sending)}`)).toBeVisible();
    await expect(page.getByText(/never page text/)).toHaveCount(0);
    // The masthead said Weft "sends nothing anywhere" above this panel too.
    await expect(page.getByText(/sends nothing anywhere/)).toHaveCount(0);
    await expect(page.getByText(/sends words only to a translation service you gave it a key for/)).toBeVisible();

    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(page.getByText(whatIsSent(sending))).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/does not send the page, the sentence/)).toHaveCount(0);
    await page.close();
  });
});
