import { test, expect } from './fixtures.ts';
import { webcrypto } from 'node:crypto';
import { TEST_LICENCE_PRIVATE_JWK } from '../fixtures/licence-keypair.ts';

/**
 * The commercial path, end to end in a real browser.
 *
 * Proves three things that are easy to get wrong and expensive to get wrong:
 * a fresh install is Free and works; a genuine key unlocks Pro with no network
 * request; and a forged key does not.
 *
 * "Genuine" means signed by the key the extension under test verifies
 * against. These tests used to sign with the publisher's real private key,
 * read from `.licence-private.jwk` — which is gitignored, correctly, so they
 * passed locally and failed in CI on every push. Skipping them would have
 * removed "does a paid licence unlock Pro" from the only place that runs
 * everything, so instead `build.mjs --test` compiles in a throwaway public
 * key and these sign with its private half. `npm run validate` fails if that
 * key ever appears in a shippable package.
 */

const b64url = (b: Buffer | ArrayBuffer) =>
  Buffer.from(b as Buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function issue(payload: Record<string, unknown>, forged = false): Promise<string> {
  let key: CryptoKey;
  if (forged) {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ]);
    key = pair.privateKey;
  } else {
    key = await webcrypto.subtle.importKey(
      'jwk',
      TEST_LICENCE_PRIVATE_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  }
  const part = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    Buffer.from(part, 'utf8'),
  );
  return `WEFT-${part}.${b64url(sig)}`;
}

const proPayload = {
  v: 1,
  id: 'e2e-test',
  tier: 'pro',
  name: 'End To End',
  issued: Date.now(),
};

test.describe('tiers', () => {
  test('a fresh install is Free, and Free weaves', async ({ context, configure, origin, rpc }) => {
    const licence = await rpc<{ tier: string }>({ type: 'get-licence' });
    expect(licence.tier).toBe('free');

    await configure({ 'weave.baseRatio': 0.4, 'weave.ceilingRatio': 0.4 });
    const page = await context.newPage();
    await page.goto(`${origin}/article.html`);

    // The core experience is not gated. If this ever fails, the free tier has
    // been crippled and the product will not convert.
    await expect
      .poll(
        async () =>
          (await page.locator('#prose-1').textContent())?.includes('The old house stood at the end of a long road') === false,
        { timeout: 15_000, message: 'Free did not weave the page' },
      )
      .toBe(true);
  });

  test('Free refuses a Pro setting immediately instead of queueing it', async ({ configure, rpc }) => {
    await configure({ 'friction.cooldownMinutes': 60 });
    const result = await rpc<{ applied: boolean; message: string; needsPro?: string }>({
      type: 'request-change',
      patch: { 'providers.enabled': true },
    });

    // Queueing it would make the user wait an hour to discover they cannot
    // have it, which is the worst possible ordering of those two facts.
    expect(result.applied).toBe(false);
    expect(result.needsPro).toBe('providers');
    expect(result.message).toMatch(/Pro/);

    const lock = await rpc<{ lock: { pending: unknown[] } }>({ type: 'get-lock-state' });
    expect(lock.lock.pending.length).toBe(0);
  });

  test('a genuine key unlocks Pro, and makes no network request doing it', async ({
    context,
    extensionId,
    rpc,
  }) => {
    const page = await context.newPage();
    const requests: string[] = [];
    // Anything leaving the machine would contradict the central claim.
    page.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith('chrome-extension://') && !url.startsWith('data:')) requests.push(url);
    });
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const key = await issue(proPayload);
    const applied = await page.evaluate(async (licence) => {
      const reply = await chrome.runtime.sendMessage({ type: 'set-licence', key: licence });
      return reply?.data;
    }, key);

    expect((applied as { tier: string }).tier).toBe('pro');
    expect(requests, `unexpected network traffic: ${requests.join(', ')}`).toEqual([]);

    const after = await rpc<{ tier: string }>({ type: 'get-licence' });
    expect(after.tier).toBe('pro');

    // And the gate is actually open now.
    const change = await rpc<{ applied: boolean }>({
      type: 'request-change',
      patch: { 'providers.enabled': true },
    });
    expect(change.applied).toBe(true);
  });

  test('a forged key is refused', async ({ rpc }) => {
    const forgedKey = await issue(proPayload, true);
    const reply = await rpc<{ tier: string; licence: { kind: string } }>({
      type: 'set-licence',
      key: forgedKey,
    });
    expect(reply.licence.kind).toBe('invalid');
    expect(reply.tier).toBe('free');
  });

  test('an expired key falls back to Free without losing the vocabulary', async ({ rpc }) => {
    const expiredKey = await issue({ ...proPayload, expires: Date.now() - 86_400_000 });
    const reply = await rpc<{ tier: string; licence: { kind: string }; message: string }>({
      type: 'set-licence',
      key: expiredKey,
    });
    expect(reply.licence.kind).toBe('expired');
    expect(reply.tier).toBe('free');
    expect(reply.message).toMatch(/still here/);
  });

  test('the settings page shows the Pro section and activates a key through the UI', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const section = page.locator('.section', { hasText: 'Weft Pro' });
    await expect(section).toBeVisible({ timeout: 10_000 });
    await expect(section).toContainText('Hard Mode');
    await expect(section.locator('.pro__plan').first()).toBeVisible();

    // Locked affordances explain rather than nag.
    const locked = page.locator('.locked').first();
    await expect(locked).toBeVisible();
    await expect(locked).toContainText(/Part of Pro/);

    const key = await issue(proPayload);
    await section.locator('input[aria-label="Licence key"]').fill(key);
    await section.locator('button', { hasText: 'Activate' }).click();

    await expect(page.locator('.section', { hasText: 'Your licence' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('.notice, .row__detail').filter({ hasText: 'End To End' }).first()).toBeVisible();
    // Nothing should still be locked.
    await expect(page.locator('.locked')).toHaveCount(0);
  });
});
