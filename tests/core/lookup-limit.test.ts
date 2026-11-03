import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Settings } from '../../src/core/types.ts';
import { settings } from '../helpers.ts';

/**
 * The daily lookup limit counts a day.
 *
 * The options page calls it "a ceiling on words looked up per day, so a
 * runaway page cannot drain your key", and `docs/PRIVACY.md` makes the same
 * promise. Until 2026-11-03 nothing counted a day: `lookupMissing()` sliced
 * each call's uncached words to the cap, and the content script sends one
 * call of at most 60 words per page load, so at the default 2 000 the cap
 * never bit and two hundred pages could send 12 000 words in a day.
 *
 * What the limit has to mean, each case a test below: the words that leave
 * the machine on one reading day, summed over every call, never exceed it; a
 * request that fails still counts, because the words went out; a cache hit
 * sends nothing and so counts nothing; two calls made at once share one
 * allowance, because a browser restoring fifty tabs makes fifty calls in the
 * same second; and the next day starts again.
 *
 * Words are counted in the request bodies a stubbed `fetch` receives, never
 * in a counter the code under test writes, and storage is a Map-backed
 * `chrome.storage.local`, the bargain `storage-export.test.ts` makes.
 */

type Lookups = typeof import('../../src/core/lookups.ts');
type Providers = typeof import('../../src/background/providers/index.ts');

describe('a day of lookups, as arithmetic', () => {
  let core: Lookups;

  before(async () => {
    core = await import('../../src/core/lookups.ts');
  });

  test('a fresh day grants up to the limit', () => {
    assert.deepEqual(core.takeLookups(undefined, '2026-11-03', 100, 60), {
      granted: 60,
      spent: { day: '2026-11-03', words: 60 },
    });
    assert.deepEqual(core.takeLookups(undefined, '2026-11-03', 100, 150), {
      granted: 100,
      spent: { day: '2026-11-03', words: 100 },
    });
  });

  test('what the day has already spent comes off the allowance', () => {
    const spent = { day: '2026-11-03', words: 60 };
    assert.deepEqual(core.takeLookups(spent, '2026-11-03', 100, 60), {
      granted: 40,
      spent: { day: '2026-11-03', words: 100 },
    });
  });

  test('yesterday’s count does not carry into today', () => {
    const spent = { day: '2026-11-02', words: 100 };
    assert.deepEqual(core.takeLookups(spent, '2026-11-03', 100, 60), {
      granted: 60,
      spent: { day: '2026-11-03', words: 60 },
    });
  });

  test('a limit lowered below the day’s count grants nothing and keeps the count', () => {
    const spent = { day: '2026-11-03', words: 80 };
    assert.deepEqual(core.takeLookups(spent, '2026-11-03', 50, 10), {
      granted: 0,
      spent: { day: '2026-11-03', words: 80 },
    });
    assert.equal(core.takeLookups(undefined, '2026-11-03', 0, 10).granted, 0);
  });
});

describe('the daily lookup limit counts a day', () => {
  const backing = new Map<string, unknown>();
  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  let providers: Providers;

  /** Noon on a calendar day, which no rollover hour moves. */
  const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
  let clock = noon(2026, 11, 3);

  /** The words of every request that reached `fetch`, failed or not. */
  let sent: string[][] = [];
  let status = 200;

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
      if (status !== 200) return new Response('', { status });
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
    status = 200;
    clock = noon(2026, 11, 3);
  });

  const withLimit = (cap: number): Settings =>
    settings({
      'providers.enabled': true,
      'providers.deepl.key': 'test-key',
      'providers.dailyLookupCap': cap,
    });

  /** One page load's call: sixty words the pack does not have. */
  const page = (tag: string, n = 60) =>
    Array.from({ length: n }, (_, i) => ({ word: `${tag}${i}`, pos: 'noun' as const }));

  const lookup = (tag: string, cap: number) => providers.lookupMissing(page(tag), 'en', 'fr', withLimit(cap));

  /** Words that left the machine since `from` requests ago. */
  const wordsSent = (from = 0) => sent.slice(from).reduce((n, words) => n + words.length, 0);

  test('two calls on one day send no more than the limit between them', async () => {
    await lookup('a', 100);
    const before = sent.length;
    await lookup('b', 100);
    assert.equal(wordsSent(), 100, `${wordsSent()} words left the machine on a day limited to 100`);
    assert.equal(wordsSent(before), 40, 'the second call sends only what the first left');
  });

  test('the next day starts again', async () => {
    await lookup('a', 100);
    await lookup('b', 100);
    assert.equal(wordsSent(), 100);
    clock = noon(2026, 11, 4);
    const before = sent.length;
    await lookup('c', 100);
    assert.equal(wordsSent(before), 60, 'a new day sends a whole page’s words again');
  });

  test('a request that fails still counts, because its words went out', async () => {
    status = 500;
    const failed = await lookup('a', 100);
    assert.match(failed.error ?? '', /500/);
    assert.equal(wordsSent(), 50, 'DeepL takes 50 words a request, and the first one failed');
    status = 200;
    const before = sent.length;
    await lookup('b', 100);
    assert.equal(wordsSent(before), 50, 'the failed request’s 50 words came off the day');
    assert.equal(wordsSent(), 100);
  });

  test('a cache hit sends nothing and counts nothing', async () => {
    await lookup('a', 100);
    const before = sent.length;
    const again = await lookup('a', 100);
    assert.equal(again.fromCache, 60);
    assert.equal(wordsSent(before), 0, 'every word was cached');
    await lookup('b', 100);
    assert.equal(wordsSent(before), 40, 'the cached call took nothing off the day');
  });

  test('two calls made at once share one allowance', async () => {
    await Promise.all([lookup('a', 100), lookup('b', 100)]);
    assert.equal(wordsSent(), 100, `${wordsSent()} words left the machine on a day limited to 100`);
  });

  test('a call the limit stops says so', async () => {
    await lookup('a', 100);
    const partial = await lookup('b', 100);
    assert.match(partial.error ?? '', /daily lookup limit of 100 words/);
    assert.match(partial.error ?? '', /20 words were not sent/);
    const none = await lookup('c', 100);
    assert.match(none.error ?? '', /daily lookup limit of 100 words/);
    assert.match(none.error ?? '', /nothing was sent/);
  });

  test('the day turns over when Weft’s day does, not at midnight', async () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).getTime();
    assert.equal(withLimit(100).attention.rolloverHour, 4, 'the default this test is written against');
    await lookup('a', 100);
    await lookup('b', 100);
    clock = at(4, 3);
    const before = sent.length;
    await lookup('c', 100);
    assert.equal(wordsSent(before), 0, 'at 03:00 it is still the day before');
    clock = at(4, 5);
    await lookup('d', 100);
    assert.equal(wordsSent(before), 60, 'at 05:00 the day has turned');
  });
});
