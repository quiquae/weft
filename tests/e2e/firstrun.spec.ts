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

    /*
     * 6. The help surface, with the diagnostic block built.
     *
     * Captured because this shot carries the version number, and a shot that
     * carries the version number goes stale at every bump. It was a manual
     * capture until 2026-09-29 and had been reading "Weft 1.0.0" since the
     * bump to 1.0.1 — an orphan inside the `first-run walkthrough shots`
     * pathspec that `npm run artefacts:check` reported stale and no
     * regeneration could ever correct, because nothing regenerated it.
     * `tests/tools/artefacts.test.ts` now fails if a file in that pathspec
     * has no generator, so this cannot silently happen again.
     *
     * The details have to be gathered first: the block does not exist until
     * the button is pressed, which is the point of the surface — nothing is
     * assembled, let alone sent, until a person asks for it.
     */
    const help = await context.newPage();
    await help.setViewportSize({ width: 1000, height: 900 });
    await help.goto(`chrome-extension://${extensionId}/options.html`);
    await help.waitForTimeout(1200);
    await help.getByRole('button', { name: 'Gather the details' }).click();
    await help.waitForTimeout(600);
    await help.locator('.section:has(.help__report)').first().scrollIntoViewIfNeeded();
    await help.waitForTimeout(400);
    await help.screenshot({ path: join(OUT, '07-help.png') });
    await help.close();

    await page.close();
    expect(true).toBe(true);
  });
});
