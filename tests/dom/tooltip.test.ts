import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.ts';
import type { Grade, LexEntry } from '../../src/core/types.ts';

installDom('<p>host</p>');

const { Tooltip } = await import('../../src/content/tooltip.ts');
const { defaultSettings } = await import('../../src/core/settings.ts');
const { applyPatch } = await import('../../src/core/patch.ts');
const { LANGUAGES } = await import('../../src/core/languages.ts');

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

  test('calls a Latin word the source of the English word, not its ancestor', () => {
    // Latin is dead and English borrowed from it, so "ancestor" — the word
    // for what Old English is to English — is false of it. The site's Latin
    // word pages say "the source of English vaccine"; so does the badge, and
    // so does the line above it that explains the choice.
    const { root, text } = open('la', {}, { tgt: 'vacca', tgtLemma: 'vacca', ipa: '/ˈwakka/', etymonOf: 'vaccine', note: undefined });
    assert.equal(root.querySelector('.etymon')?.textContent, 'Source of English vaccine');
    assert.match(root.querySelector('.why')?.textContent ?? '', /source of English “vaccine”/i);
    assert.doesNotMatch(text, /ancestor/i);
  });

  test('calls a French etymon the source of the English word', () => {
    // Every French etymon is a word English took from French or Old French,
    // checked against a dictionary (tools/seed/fr-cousins.tsv), so the badge
    // says what was checked rather than the vaguer "related to".
    const { root } = open('fr', {}, { tgt: 'forêt', tgtLemma: 'forêt', etymonOf: 'forest', note: undefined });
    assert.equal(root.querySelector('.etymon')?.textContent, 'Source of English forest');
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

  test('hides a borrowing as completely as a descent', () => {
    // The badge and the reason line beneath it both name the English word,
    // in either noun, so hiding the badge has to silence both.
    const { root, text } = open(
      'la',
      { 'reveal.showEtymon': false },
      { tgt: 'vacca', tgtLemma: 'vacca', ipa: '/ˈwakka/', etymonOf: 'vaccine', note: undefined },
    );
    assert.equal(root.querySelector('.etymon'), null);
    assert.ok(root.querySelector('.why'), 'the reason line should still be there');
    assert.doesNotMatch(text, /vaccine|(ancestor|source) of English/i);
  });

  test('keeps the note when the etymon badge is hidden', () => {
    // The note is appended unconditionally while the badge above it is behind
    // a switch, so a note written to lean on that badge loses its referent
    // and nothing in the rendering notices. Pinned here because it is the
    // premise tests/tools/lexicon-notes.test.ts rests on: if the note ever
    // becomes conditional too, that guard is policing a problem that no
    // longer exists.
    const { root, text } = open(
      'la',
      { 'reveal.showEtymon': false },
      {
        tgt: 'septem',
        tgtLemma: 'septem',
        ipa: '/ˈsɛptɛm/',
        etymonOf: 'September',
        note: 'September was the seventh month of the old Roman year',
      },
    );
    assert.equal(root.querySelector('.etymon'), null, 'the etymon badge should be hidden');
    assert.match(text, /September was the seventh month of the old Roman year/);
  });

  test('shows the band only when asked', () => {
    assert.doesNotMatch(open('ang').text, /A1/);
    assert.match(open('ang', { 'reveal.showBand': true }).text, /A1/);
  });

  test('prints no level for a word whose band nobody has judged', () => {
    // A translation service's word has no band, and "B1" under one would be a
    // level nobody chose. The helper's defaults carry a band, so it is unset.
    const { root } = open('fr', { 'reveal.showBand': true }, { band: undefined, note: 'Machine translation, not a checked gloss.' });
    const keys = [...root.querySelectorAll('.row .key')].map((k) => k.textContent);
    assert.ok(!keys.includes('level'), `a level was printed among ${keys.join(', ')}`);
  });
});

describe('the etymon badge follows descent, not death', () => {
  // The badge once said "Ancestor of" for every historical language, so
  // Latin, being dead, was given Old English's noun on 300 of its words —
  // the choice #49 took out of the feed. Whether English descends from a
  // language is worked out here from the table's own names, a historical
  // language called "… English", rather than read from `ancestorOfEnglish`,
  // so flagging Latin fails by name instead of moving the expectation with
  // the behaviour.
  const targets = Object.values(LANGUAGES).filter((l) => l.code !== 'en');
  const inherited = (name: string, historical: boolean) => historical && / English$/.test(name);

  test('says "ancestor of" for a stage of English and "source of" for every other language', () => {
    const wrong: string[] = [];
    for (const lang of targets) {
      const { root, text } = open(lang.code, {}, { tgt: 'wyrd', tgtLemma: 'wyrd', etymonOf: 'weird', note: undefined });
      const badge = root.querySelector('.etymon')?.textContent ?? '(no badge)';
      const want = `${inherited(lang.name, lang.historical) ? 'Ancestor' : 'Source'} of English weird`;
      if (badge !== want) wrong.push(`${lang.code} (${lang.name}): "${badge}", wanted "${want}"`);
      if (!inherited(lang.name, lang.historical) && /ancestor/i.test(text)) {
        wrong.push(`${lang.code} (${lang.name}): the card says "ancestor"`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  test('the table gives both nouns something to say', () => {
    assert.ok(targets.some((l) => inherited(l.name, l.historical)), 'no language is a stage of English');
    assert.ok(targets.some((l) => l.historical && !inherited(l.name, l.historical)), 'no dead language English borrowed from');
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
