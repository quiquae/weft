import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.ts';
import type { Grade, LexEntry } from '../../src/core/types.ts';

installDom('<p>host</p>');

const { Tooltip } = await import('../../src/content/tooltip.ts');
const { defaultSettings } = await import('../../src/core/settings.ts');
const { applyPatch } = await import('../../src/core/patch.ts');

/**
 * The tooltip's shadow root is closed, so `host.shadowRoot` is null by
 * design: in highlight mode the page can read the woven text but not the
 * English behind it, and a closed root keeps a site from observing which
 * words its reader did not know.
 *
 * Capturing the root through a temporary spy on attachShadow keeps that
 * property intact while still letting the tests read what was rendered. The
 * alternative — a test-only accessor on the class — would put a hole in the
 * production API for the convenience of the tests.
 */
function withCapturedShadowRoot<T>(build: () => T): { value: T; root: ShadowRoot } {
  const proto = (globalThis as unknown as { Element: { prototype: Element } }).Element.prototype as
    Element & { attachShadow(init: ShadowRootInit): ShadowRoot };
  const original = proto.attachShadow;
  let captured: ShadowRoot | null = null;
  proto.attachShadow = function patched(init: ShadowRootInit): ShadowRoot {
    const root = original.call(this, { ...init, mode: 'open' });
    captured = root;
    return root;
  };
  try {
    const value = build();
    assert.ok(captured, 'attachShadow was never called');
    return { value, root: captured as unknown as ShadowRoot };
  } finally {
    proto.attachShadow = original;
  }
}

const baseSettings = defaultSettings(Date.now(), 'test');

function entry(over: Partial<LexEntry> = {}): LexEntry {
  return {
    src: 'house',
    lemma: 'house',
    pos: 'noun',
    tgt: 'hūs',
    tgtLemma: 'hūs',
    zipf: 5.8,
    senses: 3,
    conf: 0.92,
    band: 1,
    gender: 'n',
    ipa: '/ˈhuːs/',
    etymonOf: 'house',
    note: 'Survives in every English place-name ending in -ham.',
    ...over,
  };
}

function open(target: string, settingsPatch: Record<string, unknown> = {}, over: Partial<LexEntry> = {}) {
  installDom('<p>host</p>');
  const graded: Array<{ lemma: string; grade: Grade }> = [];
  const spoken: Array<{ text: string; lang: string | null }> = [];
  const settings = applyPatch(baseSettings, settingsPatch);

  const { value: tooltip, root } = withCapturedShadowRoot(
    () =>
      new Tooltip(settings, {
        onGrade: (lemma, grade) => graded.push({ lemma, grade }),
        onSpeak: (text, lang) => spoken.push({ text, lang }),
      }),
  );

  const e = entry(over);
  tooltip.show(
    { entry: e, target, original: 'house', replacement: e.tgt },
    { top: 100, left: 100, bottom: 120, right: 160, width: 60, height: 20 } as DOMRect,
    false,
  );

  return { tooltip, root, graded, spoken, text: root.textContent ?? '' };
}

describe('tooltip content', () => {
  test('leads with the English word', () => {
    const { root } = open('ang');
    assert.equal(root.querySelector('.english')?.textContent, 'house');
    assert.equal(root.querySelector('.target')?.textContent, 'hūs');
  });

  test('shows the part of speech and gender', () => {
    const { text } = open('ang');
    assert.match(text, /noun/);
    assert.match(text, /neuter/);
  });

  test('shows IPA for a language with no voice', () => {
    const { text, root } = open('ang');
    assert.match(text, /ˈhuːs/);
    assert.ok(root.querySelector('.ipa'), 'IPA should be set in its own class');
    assert.match(text, /no voice for this language/);
  });

  test('offers audio for a language that has a voice', () => {
    const { text } = open('fr', {}, { tgt: 'maison', tgtLemma: 'maison', ipa: undefined, etymonOf: undefined });
    assert.doesNotMatch(text, /no voice for this language/);
  });

  test('names the English descendant for a historical language', () => {
    // This is the payoff of historical mode: the reader is not memorising a
    // foreign word, they are being shown where their own word came from.
    const { root, text } = open('ang');
    const badge = root.querySelector('.etymon');
    assert.ok(badge, 'no etymon badge');
    assert.match(badge.textContent ?? '', /Ancestor of English/);
    assert.match(badge.textContent ?? '', /house/);
    assert.match(text, /place-name/);
  });

  test('says "related to" rather than "ancestor of" for a modern language', () => {
    const { root } = open('fr', {}, { tgt: 'importante', tgtLemma: 'importante', etymonOf: 'important' });
    assert.match(root.querySelector('.etymon')?.textContent ?? '', /Related to English/);
  });

  test('falls back to a cognate note when there is no etymon', () => {
    const { text } = open('fr', {}, {
      src: 'nation',
      lemma: 'nation',
      tgt: 'nación',
      tgtLemma: 'nación',
      etymonOf: undefined,
      note: undefined,
      ipa: undefined,
    });
    assert.match(text, /identical to the English word/i);
  });

  test('includes the reconstructed-pronunciation note for historical languages', () => {
    const { text } = open('la', {}, { tgt: 'rēx', tgtLemma: 'rēx', ipa: '/ˈreːks/', etymonOf: 'regal' });
    assert.match(text, /Classical reconstruction/);
  });

  test('honours the settings that hide fields', () => {
    const { text } = open('ang', {
      'reveal.showPos': false,
      'reveal.showGender': false,
      'reveal.showIpa': false,
      'reveal.showEtymon': false,
    });
    assert.doesNotMatch(text, /neuter/);
    assert.doesNotMatch(text, /ˈhuːs/);
    assert.doesNotMatch(text, /Ancestor of English/);
  });

  test('shows the band only when asked', () => {
    assert.doesNotMatch(open('ang').text, /A1/);
    assert.match(open('ang', { 'reveal.showBand': true }).text, /A1/);
  });
});

describe('tooltip grading', () => {
  test('reports the grade for the word being shown', () => {
    const { root, graded } = open('ang');
    const buttons = [...root.querySelectorAll('button')];
    const knew = buttons.find((b) => b.textContent === 'I knew it');
    const unsure = buttons.find((b) => b.textContent === 'Not sure');
    assert.ok(knew && unsure);

    const EventCtor = (globalThis as unknown as { window: { Event: typeof Event } }).window.Event;
    knew.dispatchEvent(new EventCtor('click'));
    assert.deepEqual(graded, [{ lemma: 'hūs', grade: 4 }]);
  });

  test('omits the buttons when grading is off', () => {
    const { root } = open('ang', { 'reveal.grading': 'off' });
    const labels = [...root.querySelectorAll('button')].map((b) => b.textContent);
    assert.ok(!labels.includes('I knew it'));
  });
});

describe('tooltip lifecycle', () => {
  test('positions itself on screen when shown and parks off screen when hidden', () => {
    const { tooltip } = open('ang');
    const host = document.querySelector('weft-tooltip') as HTMLElement;
    assert.ok(host);
    assert.notEqual(host.style.top, '-9999px', 'should have been positioned');
    assert.equal(tooltip.isOpen(), true);

    tooltip.hide();
    assert.equal(tooltip.isOpen(), false);
    assert.equal(host.style.top, '-9999px');
  });

  test('is marked so the walker never weaves its own tooltip', () => {
    open('ang');
    const host = document.querySelector('weft-tooltip');
    assert.equal(host?.getAttribute('data-weft'), '1');
  });

  test('destroy removes the host entirely', () => {
    const { tooltip } = open('ang');
    assert.ok(document.querySelector('weft-tooltip'));
    tooltip.destroy();
    assert.equal(document.querySelector('weft-tooltip'), null);
  });

  test('applies the configured minimum font size', () => {
    open('ang', { 'a11y.minTooltipFontPx': 19 });
    const host = document.querySelector('weft-tooltip') as HTMLElement;
    assert.equal(host.style.getPropertyValue('--weft-font-size'), '19px');
  });
});
