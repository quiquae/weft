import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  pruneAttention,
  pruneByAge,
  MAX_HOSTS,
  HOST_TTL_DAYS,
  MAX_PROVIDER_ENTRIES,
  PROVIDER_TTL_DAYS,
} from '../../src/core/prune.ts';
import type { SiteAttention } from '../../src/core/types.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 15);

function host(name: string, lastTick: number, seconds = 60): SiteAttention {
  return {
    host: name,
    seconds,
    lastTick,
    day: '2026-09-15',
    history: Array.from({ length: 60 }, (_, i) => ({ day: `d${i}`, seconds: 120 })),
  };
}

function record(entries: SiteAttention[]): Record<string, SiteAttention> {
  return Object.fromEntries(entries.map((e) => [e.host, e]));
}

describe('pruneAttention', () => {
  test('keeps everything when under the cap and fresh', () => {
    const input = record([host('a.com', NOW), host('b.com', NOW - DAY)]);
    const { kept, dropped } = pruneAttention(input, NOW);
    assert.equal(dropped, 0);
    assert.deepEqual(Object.keys(kept).sort(), ['a.com', 'b.com']);
  });

  test('drops hosts past the TTL', () => {
    const input = record([host('fresh.com', NOW), host('stale.com', NOW - (HOST_TTL_DAYS + 1) * DAY)]);
    const { kept, dropped } = pruneAttention(input, NOW);
    assert.equal(dropped, 1);
    assert.deepEqual(Object.keys(kept), ['fresh.com']);
  });

  test('keeps a host exactly at the TTL boundary', () => {
    // An off-by-one here silently deletes a site the reader used today-minus-90,
    // which is indistinguishable from a bug in the attention counter.
    const input = record([host('edge.com', NOW - HOST_TTL_DAYS * DAY)]);
    const { kept } = pruneAttention(input, NOW);
    assert.deepEqual(Object.keys(kept), ['edge.com']);
  });

  test('a brand-new record with no tick yet survives', () => {
    const input = record([host('new.com', 0)]);
    const { kept, dropped } = pruneAttention(input, NOW);
    assert.equal(dropped, 0);
    assert.deepEqual(Object.keys(kept), ['new.com']);
  });

  test('caps at MAX_HOSTS, keeping the most recently attended', () => {
    const many = Array.from({ length: MAX_HOSTS + 50 }, (_, i) => host(`h${i}.com`, NOW - i * 1000));
    const { kept, dropped } = pruneAttention(record(many), NOW);
    assert.equal(Object.keys(kept).length, MAX_HOSTS);
    assert.equal(dropped, 50);
    // h0 is the most recent, so it must survive; the oldest must not.
    assert.ok(kept['h0.com'], 'most recent host was evicted');
    assert.ok(!kept[`h${MAX_HOSTS + 49}.com`], 'oldest host survived the cap');
  });

  test('evicts by recency, not by accumulated seconds', () => {
    // The whole point: a site read for hours last year matters less than one
    // read for a minute yesterday. Evicting the low-seconds records would
    // pin exactly the sites the reader has moved on from.
    const heavyButOld = host('old-favourite.com', NOW - 60 * DAY, 999_999);
    const lightButRecent = Array.from({ length: MAX_HOSTS }, (_, i) =>
      host(`recent${i}.com`, NOW - i * 1000, 1),
    );
    const { kept } = pruneAttention(record([heavyButOld, ...lightButRecent]), NOW);
    assert.equal(Object.keys(kept).length, MAX_HOSTS);
    assert.ok(!kept['old-favourite.com'], 'kept the stale heavy host over fresh ones');
  });

  test('bounds the serialised size well under the 10 MB quota', () => {
    // This is the number that motivated the whole module: 60 days of history
    // per host, times an unbounded host count, crosses the quota.
    const many = Array.from({ length: 5000 }, (_, i) => host(`h${i}.com`, NOW - i * 1000));
    const before = JSON.stringify(many).length;
    const { kept } = pruneAttention(record(many), NOW);
    const after = JSON.stringify(kept).length;
    assert.ok(before > 5_000_000, `unpruned should be multi-megabyte, was ${before}`);
    assert.ok(after < 2_000_000, `pruned should be well under quota, was ${after}`);
  });

  test('is idempotent', () => {
    const many = Array.from({ length: MAX_HOSTS + 10 }, (_, i) => host(`h${i}.com`, NOW - i * 1000));
    const once = pruneAttention(record(many), NOW).kept;
    const twice = pruneAttention(once, NOW);
    assert.equal(twice.dropped, 0);
    assert.deepEqual(Object.keys(twice.kept), Object.keys(once));
  });

  test('empty in, empty out', () => {
    const { kept, dropped } = pruneAttention({}, NOW);
    assert.deepEqual(kept, {});
    assert.equal(dropped, 0);
  });
});

describe('pruneByAge', () => {
  const entry = (at: number) => ({ tgt: 'chien', at });

  test('drops entries past the TTL', () => {
    const cache = {
      fresh: entry(NOW),
      stale: entry(NOW - (PROVIDER_TTL_DAYS + 1) * DAY),
    };
    const { kept, dropped } = pruneByAge(cache, NOW);
    assert.equal(dropped, 1);
    assert.deepEqual(Object.keys(kept), ['fresh']);
  });

  test('caps at MAX_PROVIDER_ENTRIES by recency', () => {
    const cache: Record<string, { tgt: string; at: number }> = {};
    for (let i = 0; i < MAX_PROVIDER_ENTRIES + 100; i++) cache[`w${i}`] = entry(NOW - i * 1000);
    const { kept, dropped } = pruneByAge(cache, NOW);
    assert.equal(Object.keys(kept).length, MAX_PROVIDER_ENTRIES);
    assert.equal(dropped, 100);
    assert.ok(kept.w0, 'newest entry evicted');
  });

  test('respects explicit overrides', () => {
    const cache = { a: entry(NOW), b: entry(NOW - 1000), c: entry(NOW - 2000) };
    const { kept } = pruneByAge(cache, NOW, { max: 2 });
    assert.deepEqual(Object.keys(kept), ['a', 'b']);
  });

  test('treats a missing timestamp as ancient rather than throwing', () => {
    // A cache written by an older version has no `at`. Dropping the entry is
    // right — it will simply be fetched again — but crashing on it would take
    // the service worker down on every save.
    const cache = { legacy: { tgt: 'chien' } as { tgt: string; at: number } };
    const { kept, dropped } = pruneByAge(cache, NOW);
    assert.equal(dropped, 1);
    assert.deepEqual(kept, {});
  });
});
