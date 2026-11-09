import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURES,
  NEVER_GATED,
  FREE_LANGUAGE_LIMIT,
  clampToTier,
  exceedsTier,
  featureInfo,
  has,
  historyDays,
  type Feature,
} from '../../src/core/entitlements.ts';
import { settings } from '../helpers.ts';

describe('the feature table', () => {
  test('every feature has real copy, not a placeholder', () => {
    for (const f of FEATURES) {
      assert.ok(f.label.length > 3, `${f.id} has no label`);
      assert.ok(f.detail.length > 60, `${f.id} needs a reason someone would want it`);
      assert.doesNotMatch(f.detail, /TODO|TBD|lorem/i, f.id);
    }
  });

  test('feature ids are unique', () => {
    assert.equal(new Set(FEATURES.map((f) => f.id)).size, FEATURES.length);
  });

  test('featureInfo throws on an unknown feature rather than returning undefined', () => {
    assert.throws(() => featureInfo('nope' as Feature));
  });
});

describe('what is never for sale', () => {
  test('nothing on the never-gated list appears as a paid feature', () => {
    // This test is the guard rail. Accessibility is a floor, not a feature;
    // the never-weave list protects people from the product; panic passes stop
    // a frustrated user uninstalling; and exported data is the user's own. If
    // someone later moves one of these behind the paywall, this fails and
    // says which.
    const paid = new Set<string>(FEATURES.filter((f) => f.tier === 'pro').map((f) => f.id));
    for (const capability of NEVER_GATED) {
      assert.ok(!paid.has(capability), `"${capability}" must never be a paid feature`);
    }
  });

  test('clamping to free leaves accessibility and privacy untouched', () => {
    const configured = settings({
      'a11y.preferWrappedForAT': true,
      'a11y.highContrast': true,
      'a11y.keyboardCursor': true,
      'a11y.minTooltipFontPx': 20,
      'reveal.showIpa': true,
      'reveal.showEtymon': true,
      'reveal.tts': true,
      'friction.panicPassesPerDay': 3,
    });
    const free = clampToTier(configured, 'free');

    assert.deepEqual(free.a11y, configured.a11y, 'accessibility must survive the clamp');
    assert.equal(free.reveal.showIpa, true);
    assert.equal(free.reveal.showEtymon, true, 'the etymologies are the delight; never gate them');
    assert.equal(free.reveal.tts, true);
    assert.equal(free.friction.panicPassesPerDay, 3, 'the escape valve is not for sale');
    assert.deepEqual(free.sites.excluded, configured.sites.excluded, 'the never-weave list stands');
    assert.equal(free.privacy.telemetry, false);
  });

  test('the whole escalation curve works on free', () => {
    const configured = settings({
      'weave.baseRatio': 0.2,
      'weave.ceilingRatio': 0.8,
      'attention.gainPerMinute': 0.05,
      'attention.enabled': true,
      'friction.cooldownMinutes': 720,
    });
    const free = clampToTier(configured, 'free');
    assert.equal(free.weave.baseRatio, 0.2);
    assert.equal(free.weave.ceilingRatio, 0.8);
    assert.equal(free.attention.gainPerMinute, 0.05);
    assert.equal(free.attention.enabled, true);
    assert.equal(free.friction.cooldownMinutes, 720, 'the commitment layer is the product, not an upsell');
  });
});

describe('has', () => {
  test('pro has everything', () => {
    for (const f of FEATURES) assert.equal(has('pro', f.id), true, f.id);
  });

  test('free has exactly the features not marked pro', () => {
    for (const f of FEATURES) {
      assert.equal(has('free', f.id), f.tier !== 'pro', f.id);
    }
  });
});

describe('clampToTier', () => {
  const configured = settings({
    'learning.targetLangs': ['fr', 'la', 'ang'],
    'learning.activeTarget': 'ang',
    'learning.phrasesEnabled': true,
    'friction.requireQuizToUnlock': true,
    'friction.hardMode': true,
    'providers.enabled': true,
    'providers.deepl.key': 'secret-key',
    'sites.taxed': [
      { pattern: 'x.com', enabled: true, escalate: true, target: 'la' },
      { pattern: 'reddit.com', enabled: true, escalate: true },
    ],
  });

  test('pro is returned untouched', () => {
    assert.equal(clampToTier(configured, 'pro'), configured);
  });

  test('free keeps one language, and keeps the one that was active', () => {
    const free = clampToTier(configured, 'free');
    assert.equal(free.learning.targetLangs.length, FREE_LANGUAGE_LIMIT);
    assert.ok(free.learning.targetLangs.includes(free.learning.activeTarget));
  });

  test('free keeps every shipped feature on, and turns off the ones not built', () => {
    const free = clampToTier(configured, 'free');
    assert.equal(free.friction.requireQuizToUnlock, true);
    assert.equal(free.friction.hardMode, true);
    assert.equal(free.providers.enabled, true);
    assert.equal(free.learning.phrasesEnabled, false);
  });

  test('free drops per-site language overrides but keeps the rules themselves', () => {
    // Turning a feature off must not delete the configuration behind it, so
    // that a renewed licence restores everything rather than requiring the
    // user to set it all up again.
    const free = clampToTier(configured, 'free');
    assert.equal(free.sites.taxed.length, 2, 'the site list must survive');
    assert.equal(free.sites.taxed[0]?.pattern, 'x.com');
    assert.equal(free.sites.taxed[0]?.target, undefined, 'the override is dropped');
    assert.equal(free.sites.taxed[1]?.pattern, 'reddit.com');
  });

  test('free does not discard a stored provider key', () => {
    // The key is the user's property and re-entering it is friction for no
    // benefit; only the switch is turned off.
    const free = clampToTier(configured, 'free');
    assert.equal(free.providers.deepl.key, 'secret-key');
  });

  test('is idempotent', () => {
    const once = clampToTier(configured, 'free');
    assert.deepEqual(clampToTier(once, 'free'), once);
  });

  test('copes with an active target absent from the list', () => {
    const odd = settings({ 'learning.targetLangs': ['fr'], 'learning.activeTarget': 'la' });
    const free = clampToTier(odd, 'free');
    assert.ok(free.learning.targetLangs.length >= 1);
    assert.ok(free.learning.targetLangs.includes(free.learning.activeTarget));
  });
});

describe('exceedsTier', () => {
  test('reports nothing for pro', () => {
    assert.deepEqual(exceedsTier(settings({ 'friction.hardMode': true }), 'pro'), []);
  });

  test('names every feature a free user is asking for that is not free', () => {
    const over = exceedsTier(
      settings({
        'learning.targetLangs': ['fr', 'la'],
        'learning.phrasesEnabled': true,
        'friction.requireQuizToUnlock': true,
        'friction.hardMode': true,
        'providers.enabled': true,
        'sites.taxed': [{ pattern: 'x.com', enabled: true, escalate: true, target: 'la' }],
      }),
      'free',
    );
    assert.deepEqual(over, ['multi-language', 'phrases', 'per-site-language'] as Feature[]);
  });

  test('a default free configuration exceeds nothing', () => {
    assert.deepEqual(exceedsTier(clampToTier(settings(), 'free'), 'free'), []);
  });
});

describe('historyDays', () => {
  test('every tier shows sixty days, the whole history being free', () => {
    assert.equal(historyDays('free'), 60);
    assert.equal(historyDays('pro'), 60);
  });
});
