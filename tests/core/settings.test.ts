import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSettings,
  validateSettings,
  migrateSettings,
  exportSafeSettings,
  keepLocalOnly,
  LOCAL_ONLY_PATHS,
  DIFFICULTY_PRESETS,
  DEFAULT_POS,
  SCHEMA_VERSION,
} from '../../src/core/settings.ts';
import { applyPatch, getPath } from '../../src/core/patch.ts';
import { DEFAULT_EXCLUSIONS } from '../../src/core/sites.ts';
import { NOW } from '../helpers.ts';

const ID = 'install-1';

describe('defaults', () => {
  test('are internally consistent', () => {
    const s = defaultSettings(NOW, ID);
    assert.equal(s.schemaVersion, SCHEMA_VERSION);
    assert.ok(s.weave.ceilingRatio > s.weave.baseRatio);
    assert.ok(s.learning.targetLangs.includes(s.learning.activeTarget));
    assert.equal(s.onboarded, false);
    assert.equal(s.privacy.telemetry, false);
    assert.equal(s.providers.enabled, false, 'no network calls until explicitly enabled');
  });

  test('exclude function words from weaving', () => {
    const s = defaultSettings(NOW, ID);
    for (const pos of ['det', 'prep', 'conj', 'pron']) {
      assert.ok(!s.learning.posPreference.includes(pos as never), `${pos} must not be woven by default`);
    }
    assert.deepEqual(s.learning.posPreference, DEFAULT_POS);
  });

  test('ship a conservative never-weave list', () => {
    const s = defaultSettings(NOW, ID);
    assert.ok(s.sites.excluded.length > 20);
    assert.ok(s.sites.excluded.includes('paypal.com'));
  });

  test('keep macrons on and exotic letterforms off', () => {
    const s = defaultSettings(NOW, ID);
    assert.equal(s.weave.letterforms.macrons, true);
    assert.equal(s.weave.letterforms.thorn, false);
  });
});

describe('validateSettings', () => {
  test('returns defaults for junk input', () => {
    for (const junk of [null, undefined, 42, 'x', []]) {
      const s = validateSettings(junk, NOW, ID);
      assert.equal(s.schemaVersion, SCHEMA_VERSION);
    }
  });

  test('clamps ratios into 0..1', () => {
    const s = validateSettings({ weave: { baseRatio: 40, ceilingRatio: -3 } }, NOW, ID);
    assert.equal(s.weave.baseRatio, 1);
    assert.ok(s.weave.ceilingRatio >= s.weave.baseRatio, 'ceiling is never below base');
  });

  test('forces the ceiling to be at least the base', () => {
    const s = validateSettings({ weave: { baseRatio: 0.5, ceilingRatio: 0.1 } }, NOW, ID);
    assert.equal(s.weave.baseRatio, 0.5);
    assert.equal(s.weave.ceilingRatio, 0.5);
  });

  test('rejects unknown languages and repairs the active target', () => {
    const s = validateSettings(
      { learning: { targetLangs: ['fr', 'klingon', 'en'], activeTarget: 'klingon' } },
      NOW,
      ID,
    );
    assert.deepEqual(s.learning.targetLangs, ['fr']);
    assert.equal(s.learning.activeTarget, 'fr');
  });

  test('never leaves the target list empty', () => {
    const s = validateSettings({ learning: { targetLangs: [] } }, NOW, ID);
    assert.ok(s.learning.targetLangs.length > 0);
  });

  test('accepts historical languages', () => {
    const s = validateSettings(
      { learning: { targetLangs: ['la', 'ang'], activeTarget: 'ang' } },
      NOW,
      ID,
    );
    assert.deepEqual(s.learning.targetLangs, ['la', 'ang']);
    assert.equal(s.learning.activeTarget, 'ang');
  });

  test('clamps the level and cooldown', () => {
    const s = validateSettings(
      { learning: { level: 99 }, friction: { cooldownMinutes: -5 } },
      NOW,
      ID,
    );
    assert.equal(s.learning.level, 6);
    assert.equal(s.friction.cooldownMinutes, 0);
  });

  test('rejects a malformed tint colour', () => {
    const s = validateSettings({ weave: { style: { tint: 'javascript:alert(1)' } } }, NOW, ID);
    assert.match(s.weave.style.tint, /^#[0-9a-f]{6}$/i);
  });

  test('deduplicates and lowercases site rules', () => {
    const s = validateSettings(
      { sites: { taxed: [{ pattern: 'X.com' }, { pattern: 'x.com' }, { pattern: '' }] } },
      NOW,
      ID,
    );
    assert.equal(s.sites.taxed.length, 1);
    assert.equal(s.sites.taxed[0]?.pattern, 'x.com');
  });

  test('always retains the shipped provider never-send list', () => {
    const s = validateSettings({ providers: { neverSendHosts: ['only-mine.com'] } }, NOW, ID);
    for (const host of DEFAULT_EXCLUSIONS) {
      assert.ok(s.providers.neverSendHosts.includes(host), `${host} was pruned`);
    }
    assert.ok(s.providers.neverSendHosts.includes('only-mine.com'));
  });

  test('telemetry can never be switched on', () => {
    const s = validateSettings({ privacy: { telemetry: true } } as never, NOW, ID);
    assert.equal(s.privacy.telemetry, false);
  });

  test('preserves a stored installId', () => {
    const s = validateSettings({ installId: 'stored' }, NOW, 'fallback');
    assert.equal(s.installId, 'stored');
  });

  test('is idempotent', () => {
    const once = validateSettings(defaultSettings(NOW, ID), NOW, ID);
    const twice = validateSettings(once, NOW, ID);
    assert.deepEqual(twice, once);
  });

  test('survives partially-shaped input without throwing', () => {
    const weird = {
      learning: 'nope',
      weave: { style: null },
      sites: { taxed: 'nope', excluded: [null, 5] },
      friction: [],
      providers: { deepl: 'x' },
    };
    const s = validateSettings(weird as never, NOW, ID);
    assert.equal(s.schemaVersion, SCHEMA_VERSION);
    assert.ok(Array.isArray(s.sites.taxed));
    assert.equal(s.providers.deepl.key, '');
  });
});

describe('migrateSettings', () => {
  test('lifts a legacy single targetLang into the list form', () => {
    const s = migrateSettings({ targetLang: 'es' }, NOW, ID);
    assert.deepEqual(s.learning.targetLangs, ['es']);
    assert.equal(s.learning.activeTarget, 'es');
  });

  test('leaves current-version settings alone', () => {
    const current = defaultSettings(NOW, ID);
    assert.deepEqual(migrateSettings(current, NOW, ID), current);
  });

  test('returns defaults for absent storage', () => {
    assert.equal(migrateSettings(undefined, NOW, ID).schemaVersion, SCHEMA_VERSION);
  });
});

/**
 * The fields that stay on the machine they were typed on.
 *
 * Three provider keys and the install id. `exportAll` writes
 * `exportSafeSettings` and `importAll` writes `keepLocalOnly`, both read
 * `LOCAL_ONLY_PATHS`, so the list is the one place a fourth key has to be
 * named — and the last test fails on a settings field named like a secret
 * that nobody named there. `syncSafeSettings`, which these tests used to hold,
 * hand-wrote the three keys, left the install id in, and had no caller.
 */
describe('the fields that stay on this machine', () => {
  const KEYED = applyPatch(defaultSettings(NOW, ID), {
    'providers.deepl.key': 'secret-1',
    'providers.google.key': 'secret-2',
    'providers.openai.key': 'secret-3',
  });

  test('an export copy blanks every one of them', () => {
    const safe = exportSafeSettings(KEYED);
    for (const path of LOCAL_ONLY_PATHS) assert.equal(getPath(safe, path), '', `${path} survived the export`);
    assert.equal(KEYED.providers.deepl.key, 'secret-1', 'input must not be mutated');
    assert.equal(KEYED.installId, ID, 'input must not be mutated');
  });

  test('an export copy keeps non-secret provider configuration', () => {
    const s = applyPatch(KEYED, {
      'providers.openai.model': 'my-model',
      'providers.openai.baseUrl': 'https://llm.example/v1',
      'providers.deepl.free': false,
    });
    const safe = exportSafeSettings(s);
    assert.equal(safe.providers.openai.model, 'my-model');
    assert.equal(safe.providers.openai.baseUrl, 'https://llm.example/v1');
    assert.equal(safe.providers.deepl.free, false);
  });

  test('an import keeps this machine’s value for every one of them, and nothing else', () => {
    const file = applyPatch(defaultSettings(NOW, 'their-install'), {
      'providers.openai.key': 'their-key',
      'weave.ceilingRatio': 0.5,
    });
    const kept = keepLocalOnly(file, KEYED);
    for (const path of LOCAL_ONLY_PATHS) {
      assert.equal(getPath(kept, path), getPath(KEYED, path), `${path} arrived from the file`);
    }
    assert.equal(kept.weave.ceilingRatio, 0.5, 'an import kept more than the local-only fields');
    assert.equal(file.providers.openai.key, 'their-key', 'input must not be mutated');
  });

  test('every path names a string field, so a misspelt one cannot blank nothing', () => {
    // setPath creates a path that is not there, so a typo here would write a
    // new empty field into the export and leave the real key beside it.
    const d = defaultSettings(NOW, ID);
    for (const path of LOCAL_ONLY_PATHS) {
      assert.equal(typeof getPath(d, path), 'string', `${path} is not a string field of the settings`);
    }
  });

  test('every field named like a secret is one of them', () => {
    // Derived from the settings' own shape, not a list: a fourth provider's
    // key would otherwise go into every export until somebody remembered.
    // The last segment is read whole, since `a11y.keyboardCursor` contains "key".
    const SECRET = /^(key|secret|token|password)$|(Key|Secret|Token|Password)$/;
    const leaves: string[] = [];
    const walk = (o: unknown, at: string[]): void => {
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        for (const [k, v] of Object.entries(o)) walk(v, [...at, k]);
      } else leaves.push(at.join('.'));
    };
    walk(defaultSettings(NOW, ID), []);
    const secret = leaves.filter((p) => SECRET.test(p.split('.').at(-1) ?? ''));
    assert.ok(secret.length >= 3, `only ${secret.length} secret-looking fields were found, so the walk read nothing`);
    for (const path of secret) {
      assert.ok(LOCAL_ONLY_PATHS.includes(path), `${path} looks like a secret and is not in LOCAL_ONLY_PATHS`);
    }
  });
});

describe('difficulty presets', () => {
  test('are ordered from easiest to hardest', () => {
    const base = DIFFICULTY_PRESETS.map((p) => Number(p.patch['weave.baseRatio']));
    const ceil = DIFFICULTY_PRESETS.map((p) => Number(p.patch['weave.ceilingRatio']));
    for (let i = 1; i < base.length; i++) {
      assert.ok((base[i] as number) > (base[i - 1] as number), 'base should rise');
      assert.ok((ceil[i] as number) > (ceil[i - 1] as number), 'ceiling should rise');
    }
  });

  test('every preset validates when applied', () => {
    for (const preset of DIFFICULTY_PRESETS) {
      const s = validateSettings(applyPatch(defaultSettings(NOW, ID), preset.patch), NOW, ID);
      assert.ok(s.weave.ceilingRatio >= s.weave.baseRatio, `${preset.id} inconsistent`);
      assert.deepEqual(
        { base: s.weave.baseRatio, ceiling: s.weave.ceilingRatio },
        { base: preset.patch['weave.baseRatio'], ceiling: preset.patch['weave.ceilingRatio'] },
        `${preset.id} was altered by validation`,
      );
    }
  });

  test('have unique ids and non-empty copy', () => {
    const ids = new Set<string>();
    for (const p of DIFFICULTY_PRESETS) {
      assert.ok(!ids.has(p.id));
      ids.add(p.id);
      assert.ok(p.label && p.tagline && p.detail.length > 40, `${p.id} needs real copy`);
    }
  });
});
