import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey } from '../../src/core/escalation.ts';
import type { LockState } from '../../src/core/lock.ts';
import { applyPatch, getPath } from '../../src/core/patch.ts';
import type { MemoryCard, Settings, SiteAttention } from '../../src/core/types.ts';

/**
 * Taking your data with you, and getting it back.
 *
 * Data export is on the never-gated list (`tests/core/entitlements.test.ts`)
 * and the reason that list exists is that a user must always be able to
 * leave with their data. `exportAll` writes five stores; `importAll` used to
 * read two of them and drop `attention`, `introduced` and `lock` without
 * saying so, reporting `ok: true` about the half it did. Someone moving
 * machines therefore arrived with their vocabulary and their settings and
 * with no history, no streak and no progress tiles, and nothing told them.
 *
 * The three stores are not one decision, because the direction of difficulty
 * splits them. Attention only ever makes the page harder (`weaveRatio` is
 * monotone increasing in it), so it can be merged in at once. Lock state is
 * the opposite in every field — a shorter cooldown, a refilled panic budget,
 * a lower tamper count, an older clock baseline — so it stays on the machine
 * that earned it, and the result message says so rather than being silent.
 *
 * These tests run against a Map-backed `chrome.storage.local`: no browser, no
 * I/O, the same bargain `providers.test.ts` makes when it stubs `fetch`.
 * Each machine is a separate module instance with its own install id, so an
 * import really is crossing from one install to another rather than a file
 * meeting the key that signed it.
 */

type Store = typeof import('../../src/background/storage.ts');

const backing = new Map<string, unknown>();

before(() => {
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
});

let seq = 0;

/**
 * A fresh install: empty storage and a module instance that has never run,
 * so it mints its own install id rather than inheriting the last one's.
 */
async function machine(): Promise<Store> {
  backing.clear();
  seq++;
  return (await import(
    new URL(`../../src/background/storage.ts?machine=${seq}`, import.meta.url).href
  )) as Store;
}

const NOW = Date.now();
const today = dayKey(NOW, 4);
/*
 * The day before `today` by the calendar: noon on it, which no rollover hour
 * moves. Not `dayKey(NOW - 86_400_000, 4)`: a day is 25 hours long on the
 * night the clocks go back, so from 03:00 to 04:00 that morning 24 hours ago
 * is still `today`, and this file failed at 03:29 GMT on 2026-10-25.
 */
const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
const yesterday = dayKey(new Date(ty, tm - 1, td - 1, 12).getTime(), 4);

function site(over: Partial<SiteAttention> = {}): SiteAttention {
  return {
    host: 'news.test',
    seconds: 1800,
    lastTick: NOW,
    day: today,
    history: [{ day: yesterday, seconds: 900 }],
    ...over,
  };
}

function card(lemma: string): MemoryCard {
  return {
    id: `fr:${lemma}`,
    target: 'fr',
    lemma,
    stability: 3,
    difficulty: 5,
    lastReview: NOW,
    reps: 4,
    lapses: 1,
    exposures: 9,
    firstSeen: NOW - 5 * 86_400_000,
  };
}

/** A machine with something in all five stores, exported. */
async function exportFromASeededMachine(
  over: { lock?: Partial<LockState>; attention?: SiteAttention } = {},
): Promise<Record<string, unknown>> {
  const store = await machine();
  await store.saveAttention({ 'news.test': over.attention ?? site() });
  await store.saveIntroduced({ day: today, lemmas: ['chien', 'maison'] });
  await store.replaceCards({ 'fr:chien': card('chien') });
  await store.saveLock({
    pending: [],
    panic: { day: today, used: 3 },
    tamperCount: 2,
    log: [],
    ...over.lock,
  });
  store.invalidate();
  return store.exportAll();
}

let payload: Record<string, unknown>;

describe('what an export actually carries', () => {
  beforeEach(async () => {
    payload = await exportFromASeededMachine();
  });

  test('carries all five stores, which is the whole premise', () => {
    for (const key of ['settings', 'cards', 'attention', 'introduced', 'lock']) {
      assert.ok(payload[key], `the export dropped ${key}`);
    }
  });

  test('never carries the install id, which is signing key material', () => {
    const settings = payload['settings'] as { installId?: string };
    assert.equal(settings.installId, '', 'the export leaked the install id');
  });
});

describe('an export opened on another machine', () => {
  beforeEach(async () => {
    payload = await exportFromASeededMachine();
  });

  test('brings the attention history with it', async () => {
    const fresh = await machine();
    const result = await fresh.importAll(payload);
    assert.equal(result.ok, true);

    const snapshot = await fresh.load();
    const moved = snapshot.attention['news.test'];
    assert.ok(moved, 'the attention record did not arrive');
    assert.equal(moved.seconds, 1800, "today's attention did not arrive");
    assert.deepEqual(
      moved.history,
      [{ day: yesterday, seconds: 900 }],
      'the history behind the streak did not arrive',
    );
  });

  test("brings today's introduced words, so they are not introduced twice", async () => {
    const fresh = await machine();
    await fresh.importAll(payload);
    const snapshot = await fresh.load();
    assert.deepEqual([...snapshot.introduced.lemmas].sort(), ['chien', 'maison']);
  });

  test('brings the vocabulary, which it always did', async () => {
    const fresh = await machine();
    await fresh.importAll(payload);
    const cards = await fresh.loadCards();
    assert.equal(cards['fr:chien']?.reps, 4, 'the FSRS state did not survive the trip');
  });

  test('leaves the cooldown state on the machine that earned it', async () => {
    const fresh = await machine();
    await fresh.importAll(payload);
    const snapshot = await fresh.load();
    assert.equal(snapshot.lock.tamperCount, 0, 'an imported file set the tamper count');
    assert.equal(snapshot.lock.panic.used, 0, 'an imported file spent this machine’s panic passes');
    assert.deepEqual(snapshot.lock.pending, [], 'an imported file queued a change here');
  });

  test('cannot hand itself an unlocked difficulty reduction', async () => {
    // The hazard `lock` exists for: a pending change whose cooldown expired
    // long ago is, on arrival, a reduction that can be applied immediately.
    const forged = await exportFromASeededMachine({
      lock: {
        pending: [
          {
            id: 'forged',
            kind: 'reduce-difficulty',
            patch: { 'weave.ceilingRatio': 0.01 },
            requestedAt: NOW - 7 * 86_400_000,
            unlocksAt: NOW - 6 * 86_400_000,
            summary: 'maximum density to 1%',
          },
        ],
      },
    });
    const fresh = await machine();
    await fresh.importAll(forged);
    const snapshot = await fresh.load();
    assert.deepEqual(snapshot.lock.pending, [], 'an export file queued a ready-to-apply reduction');
  });

  test('says what it did and what it left behind', async () => {
    const fresh = await machine();
    const result = await fresh.importAll(payload);
    assert.match(result.message, /attention/i, 'the message does not mention the attention it imported');
    assert.match(
      result.message,
      /cooldown|panic|friction/i,
      'the message does not mention the lock state it discarded',
    );
  });
});

describe('merging rather than replacing', () => {
  test('never lowers attention this machine already has', async () => {
    const small = await exportFromASeededMachine({ attention: site({ seconds: 60, history: [] }) });

    const fresh = await machine();
    await fresh.saveAttention({ 'news.test': site({ seconds: 3600, history: [] }) });
    fresh.invalidate();
    await fresh.importAll(small);

    const snapshot = await fresh.load();
    assert.equal(
      snapshot.attention['news.test']?.seconds,
      3600,
      'a smaller export overwrote a larger local record',
    );
  });

  test('importing the same file twice is importing it once', async () => {
    payload = await exportFromASeededMachine();
    const fresh = await machine();
    await fresh.importAll(payload);
    const once = structuredClone((await fresh.load()).attention);
    fresh.invalidate();
    await fresh.importAll(payload);
    const twice = (await fresh.load()).attention;
    assert.deepEqual(twice, once, 'a second import inflated the attention totals');
  });
});

/**
 * The hole next to the one this file was opened for.
 *
 * `importAll` promised in its own doc comment that an imported difficulty
 * reduction "still has to pass the cooldown, because settings are applied
 * through the same lock path as any other change". It did not use that path:
 * it wrote the settings object straight to storage. Editing one number in an
 * exported JSON file was therefore a complete bypass of the commitment
 * layer, which is the thing the product is built around — and it was a
 * bigger hole than the `lock` import the comment was worrying about.
 */
describe('a hand-edited settings file', () => {
  async function importWith(edit: (s: Settings) => void): Promise<Store> {
    const file = await exportFromASeededMachine();
    edit(file['settings'] as Settings);
    const fresh = await machine();
    await fresh.importAll(file);
    return fresh;
  }

  test('cannot lower the ceiling without waiting out the cooldown', async () => {
    // 0.10 rather than something extreme: the two gates compose, and
    // validateSettings runs first, so a ceiling below baseRatio is clamped
    // up to it (settings.ts:277) before the lock ever sees a direction.
    const fresh = await importWith((s) => {
      s.weave.ceilingRatio = 0.1;
    });
    const snapshot = await fresh.load();
    assert.equal(snapshot.settings.weave.ceilingRatio, 0.35, 'the file lowered the ceiling outright');
    assert.equal(snapshot.lock.pending.length, 1, 'the reduction was not queued either');
    assert.deepEqual(snapshot.lock.pending[0]?.patch, { 'weave.ceilingRatio': 0.1 });
  });

  test('cannot switch the attention tax off without waiting', async () => {
    const fresh = await importWith((s) => {
      s.attention.enabled = false;
    });
    const snapshot = await fresh.load();
    assert.equal(snapshot.settings.attention.enabled, true, 'the file turned the tax off outright');
    assert.equal(snapshot.lock.pending.length, 1);
  });

  test('cannot shorten the cooldown that governs it', async () => {
    const fresh = await importWith((s) => {
      s.friction.cooldownMinutes = 0;
    });
    const snapshot = await fresh.load();
    assert.equal(snapshot.settings.friction.cooldownMinutes, 15, 'the file shortened its own gate');
  });

  test('still applies a harder setting at once, like every other harder change', async () => {
    const fresh = await importWith((s) => {
      s.weave.ceilingRatio = 0.62;
    });
    const snapshot = await fresh.load();
    assert.equal(snapshot.settings.weave.ceilingRatio, 0.62, 'a harder setting was made to wait');
    assert.deepEqual(snapshot.lock.pending, []);
  });

  test('still applies settings that are not difficulty at all', async () => {
    const fresh = await importWith((s) => {
      s.a11y.highContrast = true;
    });
    const snapshot = await fresh.load();
    assert.equal(snapshot.settings.a11y.highContrast, true, 'a contrast setting was put behind a cooldown');
    assert.deepEqual(snapshot.lock.pending, []);
  });

  test('says that something is waiting rather than reporting a clean import', async () => {
    const file = await exportFromASeededMachine();
    (file['settings'] as Settings).weave.ceilingRatio = 0.1;
    const fresh = await machine();
    const result = await fresh.importAll(file);
    assert.equal(result.ok, true);
    assert.match(result.message, /waiting out the cooldown/i);
  });
});

/**
 * The keys to somebody else's translation account.
 *
 * `docs/PRIVACY.md` — the page every store's form links to — and
 * `docs/SUPPORT.md` both said an export strips API keys, and the options page
 * said "and no keys" as it saved the file. `exportAll` blanked the install id
 * and nothing else, so the three provider keys went into a file people attach
 * to bug reports, in clear.
 *
 * The import half is the part that makes the fix safe. `importAll` saved the
 * file's settings as they came, so a machine holding keys that imported a file
 * holding none was left with none — a defect between two machines already, and
 * once exports stop carrying keys it would have been every import. A key
 * belongs to the machine it was typed on: it never leaves in a file and never
 * arrives in one, so an export written before this fix cannot quietly replace
 * one either.
 */
describe('API keys', () => {
  const PLANTED = {
    'providers.deepl.key': 'deepl-planted-7f3a',
    'providers.google.key': 'google-planted-91c2',
    'providers.openai.key': 'sk-planted-4be0',
  };

  /** A fresh install with all three keys typed in, as the options page would save them. */
  async function machineWithKeys(): Promise<Store> {
    const store = await machine();
    await store.saveSettings(applyPatch((await store.load()).settings, PLANTED));
    store.invalidate();
    return store;
  }

  function keysOn(settings: Settings): Record<string, unknown> {
    return Object.fromEntries(Object.keys(PLANTED).map((path) => [path, getPath(settings, path)]));
  }

  test('an export carries none of them, anywhere in the file', async () => {
    const store = await machineWithKeys();
    assert.deepEqual(keysOn((await store.load()).settings), PLANTED, 'the keys were never planted');
    // The text rather than the fields, as the diagnostic report is held: a key
    // copied anywhere else in the file is as much a leak as one left in place.
    const text = JSON.stringify(await store.exportAll());
    for (const key of Object.values(PLANTED)) {
      assert.ok(!text.includes(key), `the export holds ${key} in clear`);
    }
  });

  test('a machine keeps its keys when it imports a file that has none', async () => {
    const file = await exportFromASeededMachine();
    const here = await machineWithKeys();
    await here.importAll(file);
    assert.deepEqual(keysOn((await here.load()).settings), PLANTED, 'importing a file erased this machine’s keys');
  });

  test('a key never arrives by file, so an old export cannot replace one', async () => {
    // An export written before exports stopped carrying keys, or a hand-edited one.
    const file = await exportFromASeededMachine();
    const from = applyPatch(file['settings'] as Settings, {
      'providers.deepl.key': 'deepl-from-the-file',
      'providers.openai.key': 'sk-from-the-file',
    });

    const keyed = await machineWithKeys();
    await keyed.importAll({ ...file, settings: from });
    assert.deepEqual(keysOn((await keyed.load()).settings), PLANTED, 'a file replaced this machine’s keys');

    const bare = await machine();
    await bare.importAll({ ...file, settings: from });
    const landed = keysOn((await bare.load()).settings);
    assert.deepEqual(
      landed,
      { 'providers.deepl.key': '', 'providers.google.key': '', 'providers.openai.key': '' },
      'a key arrived by file',
    );
  });

  test('a file’s install id does not land either', async () => {
    const file = await exportFromASeededMachine();
    const here = await machine();
    const own = (await here.load()).settings.installId;
    await here.importAll({ ...file, settings: { ...(file['settings'] as Settings), installId: 'forged-id' } });
    assert.equal((await here.load()).settings.installId, own, 'an imported file replaced the install id');
  });

  test('says so when a file carried keys it did not bring', async () => {
    const file = await exportFromASeededMachine();
    const from = applyPatch(file['settings'] as Settings, { 'providers.openai.key': 'sk-from-the-file' });
    const result = await (await machine()).importAll({ ...file, settings: from });
    assert.match(result.message, /API keys/, 'the message is silent about the keys it left out');

    const clean = await (await machine()).importAll(await exportFromASeededMachine());
    assert.doesNotMatch(clean.message, /API keys/, 'a file with no keys was told it had some');
  });
});
