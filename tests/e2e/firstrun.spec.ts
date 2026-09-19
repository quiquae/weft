import { test, expect } from './fixtures.ts';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk the first five minutes, as a new user sees them.
 *
 *   WEFT_FIRSTRUN=1 npx playwright test firstrun
 *
 * Not an assertion suite: a capture of every surface a person meets before
 * the product has done anything for them, so the friction can be looked at
 * rather than guessed at.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/firstrun');

test.describe('first run', () => {
  test.skip(({}) => process.env['WEFT_FIRSTRUN'] !== '1', 'set WEFT_FIRSTRUN=1');
  test.setTimeout(180_000);

  test('capture what a new user meets', async ({ context, extensionId, origin }) => {
    await mkdir(OUT, { recursive: true });

    // 1. The page that opens itself on install, untouched.
    const ob = await context.newPage();
    await ob.setViewportSize({ width: 1000, height: 900 });
    await ob.goto(`chrome-extension://${extensionId}/onboarding.html`);
    await ob.waitForTimeout(1000);
    await ob.screenshot({ path: join(OUT, '01-onboarding-language.png') });

    // 2. Each subsequent step, reached the way a user reaches it.
    const next = ob.locator('button[data-variant="primary"]').last();
    if (await next.count()) {
      await next.click();
      await ob.waitForTimeout(600);
      await ob.screenshot({ path: join(OUT, '02-onboarding-density.png') });
      const next2 = ob.locator('button[data-variant="primary"]').last();
      if (await next2.count()) {
        await next2.click();
        await ob.waitForTimeout(600);
        await ob.screenshot({ path: join(OUT, '03-onboarding-sites.png'), fullPage: true });
      }
    }
    await ob.close();

    // 3. The popup on a site Weft has NOT been given. This is the state a
    //    new user hits first and most often, and the one most likely to
    //    read as "it is broken".
    const page = await context.newPage();
    await page.goto(`${origin}/showcase.html`);
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 520 });
    await popup.addInitScript(
      ({ url }) => {
        const query = chrome.tabs.query.bind(chrome.tabs);
        (chrome.tabs as unknown as { query: unknown }).query = async (info: unknown) => {
          const real = await query(info as chrome.tabs.QueryInfo);
          return real.map((tab) => ({ ...tab, url }));
        };
      },
      { url: `${origin}/showcase.html` },
    );
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1200);
    await popup.screenshot({ path: join(OUT, '04-popup-untaxed-site.png') });
    await popup.close();

    // 4. The progress page with no history at all — the empty state.
    const dash = await context.newPage();
    await dash.setViewportSize({ width: 1000, height: 900 });
    await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await dash.waitForTimeout(1200);
    await dash.screenshot({ path: join(OUT, '05-dashboard-empty.png') });
    await dash.close();

    // 5. Settings, unconfigured.
    const opt = await context.newPage();
    await opt.setViewportSize({ width: 1000, height: 900 });
    await opt.goto(`chrome-extension://${extensionId}/options.html`);
    await opt.waitForTimeout(1200);
    await opt.screenshot({ path: join(OUT, '06-options-top.png') });
    await opt.close();

    await page.close();
    expect(true).toBe(true);
  });
});
