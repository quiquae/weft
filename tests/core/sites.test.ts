import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHost,
  registrableDomain,
  parsePattern,
  patternMatches,
  findRule,
  classifyUrl,
  rulesFromPreset,
  originsForRules,
  DEFAULT_EXCLUSIONS,
  SITE_PRESETS,
} from '../../src/core/sites.ts';
import { settings } from '../helpers.ts';
import type { SiteRule } from '../../src/core/types.ts';

const rule = (pattern: string, over: Partial<SiteRule> = {}): SiteRule => ({
  pattern,
  enabled: true,
  escalate: true,
  ...over,
});

describe('normalizeHost', () => {
  test('lowercases and strips www and a trailing dot', () => {
    assert.equal(normalizeHost('WWW.Example.COM.'), 'example.com');
  });
});

describe('registrableDomain', () => {
  test('collapses subdomains', () => {
    assert.equal(registrableDomain('mobile.twitter.com'), 'twitter.com');
    assert.equal(registrableDomain('a.b.c.example.com'), 'example.com');
  });

  test('handles multi-part public suffixes', () => {
    assert.equal(registrableDomain('news.bbc.co.uk'), 'bbc.co.uk');
    assert.equal(registrableDomain('shop.example.com.au'), 'example.com.au');
  });

  test('passes through hosts that are already registrable', () => {
    assert.equal(registrableDomain('example.com'), 'example.com');
    assert.equal(registrableDomain('localhost'), 'localhost');
    assert.equal(registrableDomain('127.0.0.1'), '127.0.0.1');
  });
});

describe('parsePattern', () => {
  test('parses bare hosts', () => {
    assert.deepEqual(parsePattern('Twitter.com'), {
      host: 'twitter.com', pathPrefix: null, subdomainsOnly: false, exact: false,
    });
  });

  test('parses a subdomain-only wildcard', () => {
    assert.equal(parsePattern('*.example.com')?.subdomainsOnly, true);
  });

  test('parses an exact-host prefix', () => {
    assert.equal(parsePattern('=example.com')?.exact, true);
  });

  test('parses a path prefix', () => {
    assert.equal(parsePattern('reddit.com/r/all')?.pathPrefix, '/r/all');
  });

  test('strips a scheme', () => {
    assert.equal(parsePattern('https://example.com/x')?.host, 'example.com');
  });

  test('rejects empty and malformed patterns', () => {
    assert.equal(parsePattern(''), null);
    assert.equal(parsePattern('   '), null);
    assert.equal(parsePattern('has space.com'), null);
  });
});

describe('patternMatches', () => {
  const u = (s: string) => new URL(s);

  test('a bare host matches itself and its subdomains', () => {
    assert.equal(patternMatches('twitter.com', u('https://twitter.com/home')), true);
    assert.equal(patternMatches('twitter.com', u('https://mobile.twitter.com/home')), true);
    assert.equal(patternMatches('twitter.com', u('https://nottwitter.com/')), false);
  });

  test('a wildcard matches subdomains only', () => {
    assert.equal(patternMatches('*.twitter.com', u('https://mobile.twitter.com/')), true);
    assert.equal(patternMatches('*.twitter.com', u('https://twitter.com/')), false);
  });

  test('an exact pattern excludes subdomains', () => {
    assert.equal(patternMatches('=twitter.com', u('https://twitter.com/')), true);
    assert.equal(patternMatches('=twitter.com', u('https://mobile.twitter.com/')), false);
  });

  test('a path prefix must match', () => {
    assert.equal(patternMatches('reddit.com/r/all', u('https://reddit.com/r/all/top')), true);
    assert.equal(patternMatches('reddit.com/r/all', u('https://reddit.com/r/cats')), false);
  });
});

describe('findRule', () => {
  test('the most specific pattern wins', () => {
    const rules = [rule('reddit.com'), rule('reddit.com/r/languagelearning')];
    const hit = findRule(new URL('https://reddit.com/r/languagelearning/new'), rules);
    assert.equal(hit?.pattern, 'reddit.com/r/languagelearning');
  });

  test('returns null when nothing matches', () => {
    assert.equal(findRule(new URL('https://example.org/'), [rule('reddit.com')]), null);
  });
});

describe('classifyUrl', () => {
  test('never weaves browser-internal or non-web schemes', () => {
    const s = settings();
    for (const url of [
      'chrome://settings',
      'chrome-extension://abc/page.html',
      'about:blank',
      'file:///Users/x/secret.txt',
      'view-source:https://example.com',
      'data:text/html,hi',
    ]) {
      assert.equal(classifyUrl(url, s).mode, 'excluded', `${url} should be excluded`);
    }
  });

  test('handles a malformed URL without throwing', () => {
    assert.equal(classifyUrl('not a url', settings()).mode, 'excluded');
  });

  test('the exclusion list beats every other rule', () => {
    const s = settings({
      'sites.taxed': [rule('mail.google.com'), rule('chase.com')],
    });
    const d = classifyUrl('https://mail.google.com/mail/u/0', s);
    assert.equal(d.mode, 'excluded');
    assert.match(String(d.reason), /excluded by/);
    assert.equal(classifyUrl('https://chase.com/login', s).mode, 'excluded');
  });

  test('ships exclusions for money, mail, credentials and health', () => {
    for (const host of ['paypal.com', 'mail.google.com', '1password.com', 'nhs.uk', 'irs.gov']) {
      assert.ok(DEFAULT_EXCLUSIONS.includes(host), `${host} should ship excluded`);
    }
  });

  test('taxed sites escalate; gentle sites do not', () => {
    const s = settings({
      'sites.taxed': [rule('x.com')],
      'sites.gentle': [rule('wikipedia.org', { escalate: false })],
    });
    const taxed = classifyUrl('https://x.com/home', s);
    assert.equal(taxed.mode, 'taxed');
    assert.equal(taxed.escalate, true);
    assert.equal(taxed.ceilingRatio, s.weave.ceilingRatio);

    const gentle = classifyUrl('https://en.wikipedia.org/wiki/Cat', s);
    assert.equal(gentle.mode, 'gentle');
    assert.equal(gentle.escalate, false);
    assert.equal(gentle.ceilingRatio, gentle.baseRatio, 'gentle sites are flat');
  });

  test('a specific gentle rule overrides a broad taxed one', () => {
    const s = settings({
      'sites.taxed': [rule('reddit.com')],
      'sites.gentle': [rule('reddit.com/r/languagelearning', { escalate: false })],
    });
    assert.equal(classifyUrl('https://reddit.com/r/all', s).mode, 'taxed');
    assert.equal(classifyUrl('https://reddit.com/r/languagelearning/x', s).mode, 'gentle');
  });

  test('taxed-only mode leaves unlisted sites completely alone', () => {
    const s = settings({ 'sites.mode': 'taxed-only', 'sites.taxed': [rule('x.com')] });
    assert.equal(classifyUrl('https://example.org/', s).mode, 'off');
  });

  test('everywhere-except mode gives unlisted sites a flat gentle dose', () => {
    const s = settings({ 'sites.mode': 'everywhere-except', 'sites.taxed': [] });
    const d = classifyUrl('https://example.org/', s);
    assert.equal(d.mode, 'gentle');
    assert.equal(d.escalate, false);
  });

  test('disabled rules are ignored', () => {
    const s = settings({ 'sites.taxed': [rule('x.com', { enabled: false })] });
    assert.equal(classifyUrl('https://x.com/', s).mode, 'off');
  });

  test('a rule can override ratios and target language', () => {
    const s = settings({
      'sites.taxed': [rule('x.com', { baseRatio: 0.2, ceilingRatio: 0.9, target: 'la' })],
    });
    const d = classifyUrl('https://x.com/', s);
    assert.equal(d.baseRatio, 0.2);
    assert.equal(d.ceilingRatio, 0.9);
    assert.equal(d.target, 'la');
  });

  test('turning the attention tax off flattens escalation everywhere', () => {
    const s = settings({ 'sites.taxed': [rule('x.com')], 'attention.enabled': false });
    const d = classifyUrl('https://x.com/', s);
    assert.equal(d.escalate, false);
  });

  test('groups attention by registrable domain', () => {
    const s = settings({ 'sites.taxed': [rule('twitter.com')] });
    assert.equal(classifyUrl('https://mobile.twitter.com/x', s).attentionKey, 'twitter.com');
  });
});

describe('presets', () => {
  test('every preset has patterns and a stable id', () => {
    const ids = new Set<string>();
    for (const p of SITE_PRESETS) {
      assert.ok(p.patterns.length > 0, `${p.id} has no patterns`);
      assert.ok(!ids.has(p.id), `duplicate preset id ${p.id}`);
      ids.add(p.id);
      for (const pattern of p.patterns) {
        assert.ok(parsePattern(pattern), `${p.id}: unparseable pattern ${pattern}`);
      }
    }
  });

  test('escalating presets produce taxed rules and flat ones produce gentle rules', () => {
    assert.ok(rulesFromPreset('social').taxed.length > 0);
    assert.equal(rulesFromPreset('social').gentle.length, 0);
    assert.ok(rulesFromPreset('news').gentle.length > 0);
    assert.equal(rulesFromPreset('news').taxed.length, 0);
  });

  test('an unknown preset id yields nothing rather than throwing', () => {
    assert.deepEqual(rulesFromPreset('nope'), { taxed: [], gentle: [] });
  });
});

describe('originsForRules', () => {
  test('produces match patterns for the host and its subdomains', () => {
    const origins = originsForRules([rule('x.com')]);
    assert.ok(origins.includes('*://x.com/*'));
    assert.ok(origins.includes('*://*.x.com/*'));
  });

  test('deduplicates', () => {
    const origins = originsForRules([rule('x.com'), rule('x.com/home')]);
    assert.equal(new Set(origins).size, origins.length);
  });
});
