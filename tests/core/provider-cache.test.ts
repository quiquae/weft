import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Settings } from '../../src/core/types.ts';
import { settings } from '../helpers.ts';

/**
 * The provider cache keeps an answer for as long as “Keep answers for” says.
 *
 * The options page offers one day to a year, and `lookupMissing()` serves an
 * answer from the cache for as long as the setting says. Until 2026-11-05
 * every save pruned the cache at `PROVIDER_TTL_DAYS`, 180, whatever the
 * setting said, so from 181 days up the slider promised a length the store
 * never kept, and a word its user had asked to keep for a year was sent
 * again after six months. Two lengths on one store: the comment above
 * `saveProviderCache()`'s call records the same shape for two caps.
 *
 * The longest length is read off the slider itself, so a slider that later
 * offers more is held too. Words are counted in the request bodies a stubbed
 * `fetch` receives, and storage is a Map-backed `chrome.storage.local`, the
 * bargain `lookup-limit.test.ts` makes.
 */

type Providers = typeof import('../../src/background/providers/index.ts');

const DAY = 86_400_000;
const CACHE = 'weft:provider-cache';

/** The longest “Keep answers for” the options page offers, read off its slider. */
function longestOffered(): number {
  const source = readFileSync(new URL('../../src/ui/options/data.tsx', import.meta.url), 'utf8');
  const bound = source.indexOf("c.set('providers.cacheDays'");
  assert.notEqual(bound, -1, 'no control on the options page sets providers.cacheDays');
  const row = source.lastIndexOf('<Row', bound);
  const max = /\bmax=\{(\d+)\}/.exec(source.slice(row, bound));
  assert.ok(max, 'the control that sets providers.cacheDays has no maximum');
  return Number(max[1]);
}

describe('the provider cache keeps an answer for as long as the setting says', () => {
  const backing = new Map<string, unknown>();
  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  let providers: Providers;
  let clock = new Date(2026, 10, 5, 12).getTime();

  /** The words of every request that reached `fetch`. */
  let sent: string[][] = [];

  before(async () => {
    const g = globalThis as unknown as Record<string, unknown>;
    g['__WEFT_VERSION__'] = '1.0.1-test';
    g['__WEFT_TARGET__'] = 'chrome';
    g['chrome'] = {
      storage: {
        local: {
          get: async (key: string) => (backing.has(key) ? { [key]: backing.get(key) } : {}),
          set: async (items: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(items)) backing.set(k, structuredClone(v));
          },
          remove: async (key: string) => void backing.delete(key),
        },
      },
    };
    Date.now = () => clock;
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { text?: string[] };
      const text = body.text ?? [];
      sent.push(text);
      return new Response(JSON.stringify({ translations: text.map((w) => ({ text: `fr-${w}` })) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    providers = await import('../../src/background/providers/index.ts');
  });

  after(() => {
    globalThis.fetch = realFetch;
    Date.now = realNow;
  });

  beforeEach(() => {
    backing.clear();
    sent = [];
    clock = new Date(2026, 10, 5, 12).getTime();
  });

  const keepingFor = (days: number): Settings =>
    settings({
      'providers.enabled': true,
      'providers.deepl.key': 'test-key',
      'providers.cacheDays': days,
    });

  const lookup = (word: string, keep: Settings) =>
    providers.lookupMissing([{ word, pos: 'noun' }], 'en', 'fr', keep);

  /** How old each stored answer is, in days, by its word. */
  const storedAges = () => {
    const cache = (backing.get(CACHE) ?? {}) as Record<string, { at: number }>;
    return Object.fromEntries(
      Object.entries(cache).map(([key, v]) => [key.split(':').pop()!, (clock - v.at) / DAY]),
    );
  };

  test('the options page offers more than a few days, or this test proves little', () => {
    assert.ok(longestOffered() >= 180, `the slider offers at most ${longestOffered()} days`);
  });

  test('an answer is served for every length the slider offers', async () => {
    const days = longestOffered();
    const keep = keepingFor(days);
    await lookup('dog', keep);
    assert.deepEqual(sent, [['dog']]);

    clock += (days - 1) * DAY;
    // Another word, so the cache is saved, and a save is when it is pruned.
    await lookup('cat', keep);
    const before = sent.length;
    const again = await lookup('dog', keep);
    assert.equal(
      again.fromCache,
      1,
      `an answer ${days - 1} days old was not kept, under “Keep answers for” ${days} days`,
    );
    assert.deepEqual(sent.slice(before), [], 'the word was sent again');
  });

  test('an answer older than the setting is asked for again', async () => {
    const keep = keepingFor(30);
    await lookup('dog', keep);
    clock += 31 * DAY;
    const before = sent.length;
    const again = await lookup('dog', keep);
    assert.equal(again.fromCache, 0);
    assert.deepEqual(sent.slice(before), [['dog']]);
  });

  test('the store keeps no answer it would not serve', async () => {
    const keep = keepingFor(30);
    await lookup('dog', keep);
    clock += 31 * DAY;
    await lookup('cat', keep);
    assert.deepEqual(
      storedAges(),
      { cat: 0 },
      'an answer older than “Keep answers for” is still stored, where the privacy page says it is not kept',
    );
  });
});
