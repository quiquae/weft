/**
 * The store description, held to the code it describes.
 *
 * `docs/STORE-LISTING.md`'s "Detailed description" is the copy Google reviews
 * and every stranger at a store reads first, and `docs/READY-TO-SUBMIT.md`
 * pastes it into four stores' boxes. Other guards hold slices of it: what a
 * translation service is sent (`sending-copy.test.ts`), what is said to be
 * free (`pro-features.test.ts`), the four pasted copies
 * (`ready-to-submit.test.ts`). Read against the code on 2026-11-08, four of
 * the claims nothing held were wrong or short of it, and these are the rules
 * that would have said so, each read from the code rather than typed here:
 *
 * - **A paid feature is marked Pro wherever the description offers it, and a
 *   free one never is.** It offered Hard Mode, the vocabulary check and your
 *   own translation key as "optional", with no word that each was paid. Since
 *   2026-11-09 every feature is free, so no paragraph may say Pro.
 * - **The density it quotes is the default curve's, at the minutes it names,
 *   and says what it is a share of.** `weaveRatio` is a proportion of the
 *   words with a dictionary entry (`eligible` in `selectSwaps`), not of the
 *   page, so "you are reading a third in French" told a stranger a third of
 *   the page, which no setting produces.
 * - **The languages it names are the packs that ship**, by the language
 *   table's names, and the number word before them is their count.
 * - **Each French word it says shares a root with an English one is a claim
 *   the pack's tooltip makes**, read through `entriesByTarget()` as the
 *   tooltip's own feed is.
 *
 * Two claims a reading found false are about the world, not the code, and no
 * test here can hold them: "most of the rest [of English] shares a Latin
 * root", where Finkenstaedt and Wolff count Latin at about 28% of English
 * against French's 28% and the Germanic stock's 25%; and Latin and Old
 * English "which nobody else offers", where a Firefox add-on, Language Lens,
 * lists Latin. TODO.md's Notes record both.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, type Feature } from '../../src/core/entitlements.ts';
import { weaveRatio } from '../../src/core/escalation.ts';
import { LANGUAGES, getLanguage } from '../../src/core/languages.ts';
import { entriesByTarget } from '../../src/core/lexicon.ts';
import { defaultSettings } from '../../src/core/settings.ts';
import type { LangCode, LexEntry } from '../../src/core/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const LISTING = 'docs/STORE-LISTING.md';
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/**
 * The description's paragraphs as a store's box shows them: each on one line,
 * emphasis dropped. The same reading `ready-to-submit.test.ts` pastes by.
 */
function paragraphs(): string[] {
  const lines = read(LISTING).split('\n');
  const start = lines.findIndex((line) => line.startsWith('## Detailed description'));
  assert.notEqual(start, -1, `${LISTING} has no "## Detailed description" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##? /.test(line));
  return (end === -1 ? rest : rest.slice(0, end))
    .join('\n')
    .trim()
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.trim())
        .join(' ')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*([^*\s][^*]*?)\*/g, '$1'),
    );
}

const NUMBERS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

const clip = (p: string): string => (p.length > 90 ? `${p.slice(0, 90)}…` : p);

describe('the store description says Pro exactly where a feature is paid', () => {
  /**
   * The words that offer each shipped feature, the way `PROMISES` in
   * `pro-features.test.ts` names each one not shipped. A feature that ships
   * and has no line here fails the first test, so a fifth is held at once.
   */
  const OFFERS: Partial<Record<Feature, RegExp>> = {
    'hard-mode': /\bHard Mode\b/,
    providers: /\b(?:own|your) [^.]*?\bkey\b/i,
    'unlock-quiz': /\bvocabulary check\b/i,
    'extended-history': /\bsixty days\b|\b60 days\b/i,
  };

  const shipped = FEATURES.filter((f) => (f as { shipped?: boolean }).shipped !== false);

  test('every shipped feature has words that offer it, and they are its own', () => {
    for (const f of shipped) {
      const offer = OFFERS[f.id];
      assert.ok(offer, `${f.id} ships and OFFERS names no words that offer it`);
      assert.match(
        `${f.label}. ${f.detail}`,
        offer,
        `OFFERS for ${f.id} does not match the feature's own label or detail`,
      );
    }
  });

  test('a paragraph offering a feature says Pro exactly when the feature is paid', () => {
    const wrong: string[] = [];
    let offered = 0;
    for (const p of paragraphs()) {
      for (const f of shipped) {
        const offer = OFFERS[f.id];
        if (!offer?.test(p)) continue;
        offered++;
        const saysPro = /\bPro\b/.test(p);
        if (f.tier === 'pro' && !saysPro) wrong.push(`${f.id} is paid and unmarked: ${clip(p)}`);
        if (f.tier === 'free' && saysPro) wrong.push(`${f.id} is free and marked Pro: ${clip(p)}`);
      }
    }
    assert.ok(offered >= 3, `the description offers only ${offered} features; was it read?`);
    assert.deepEqual(wrong, []);
  });
});

describe("the store description's numbers are the code's", () => {
  test('the density it quotes is the default curve at the minutes it names, of the words Weft knows', () => {
    const s = defaultSettings(0, 'store-description');
    const FRACTIONS: Record<string, number> = {
      'a quarter': 1 / 4, 'a third': 1 / 3, half: 1 / 2, 'two thirds': 2 / 3,
    };
    const claims = paragraphs()
      .flatMap((p) => p.split(/(?<=\.)\s+/))
      .map((sentence) => ({
        sentence,
        m: sentence.match(/\b(\w+) minutes on an infinite feed\b.*?\b(a quarter|a third|half|two thirds)\b/i),
      }))
      .filter((c): c is { sentence: string; m: RegExpMatchArray } => c.m !== null);
    assert.ok(claims.length >= 1, 'no sentence quotes a density at a number of minutes; was it read?');

    for (const { sentence, m } of claims) {
      const minutes = NUMBERS[m[1]!.toLowerCase()];
      assert.ok(minutes, `"${m[1]}" is not a number this test can read: ${sentence}`);
      const said = FRACTIONS[m[2]!.toLowerCase()]!;
      const ratio = weaveRatio({
        baseRatio: s.weave.baseRatio,
        ceilingRatio: s.weave.ceilingRatio,
        gainPerMinute: s.attention.gainPerMinute,
        attentionSeconds: minutes * 60,
        escalate: true,
      });
      assert.ok(
        Math.abs(ratio - said) < 0.02,
        `"${sentence}" says ${m[2]} at ${minutes} minutes; the default curve gives ${(ratio * 100).toFixed(1)}%`,
      );
      assert.match(
        sentence,
        /\bof the words Weft knows\b/,
        `"${sentence}" gives a share without saying of what: the ratio is a share of the words Weft knows, not of the page`,
      );
    }
  });

  test('the languages it names are the packs that ship, and it counts them', () => {
    const index = JSON.parse(read('src/lexicon/packs/index.json')) as { packs: { target: LangCode }[] };
    const shipped = index.packs.map((p) => getLanguage(p.target).name);
    assert.ok(shipped.length >= 7, `only ${shipped.length} packs were read`);

    const p = paragraphs().find((x) => /^\w+ languages\./.test(x));
    assert.ok(p, 'the description has no paragraph opening "<number> languages."');
    const word = p.match(/^(\w+) languages\./)![1]!.toLowerCase();
    assert.equal(NUMBERS[word], shipped.length, `"${p.slice(0, 40)}…" counts ${word}; ${shipped.length} packs ship`);

    for (const name of shipped) assert.match(p, new RegExp(`\\b${name}\\b`), `${name} ships and is not named`);
    const unshipped = Object.values(LANGUAGES)
      .map((l) => l.name)
      .filter((name) => name !== 'English' && !shipped.includes(name));
    for (const name of unshipped) {
      assert.doesNotMatch(p, new RegExp(`\\b${name}\\b`), `${name} is named and no pack for it ships`);
    }
  });

  test('each French word it says shares a root with an English one is a claim the tooltip makes', () => {
    const pack = JSON.parse(read('src/lexicon/packs/en-fr.json')) as { entries: Record<string, LexEntry[]> };
    const byTarget = entriesByTarget(pack.entries);
    const p = paragraphs().find((x) => /\bshares a root with\b/.test(x));
    assert.ok(p, 'the description has no "shares a root with" examples; was it read?');

    const clauses = [...p.matchAll(/(\p{L}+) (?:shares a root )?with ((?:["“][^"”]+["”](?:,? and )?)+)/gu)];
    assert.ok(clauses.length >= 3, `only ${clauses.length} examples were read from: ${clip(p)}`);
    for (const [, word, quoted] of clauses) {
      const entry = byTarget.get(word!);
      assert.ok(entry, `"${word}" is given as a French word and the French pack does not teach it`);
      for (const [, english] of quoted!.matchAll(/["“]([^"”]+)["”]/g)) {
        assert.ok(
          entry.note?.includes(`“${english}”`),
          `the description says ${word} shares a root with "${english}"; the tooltip's note is: ${entry.note ?? '(none)'}`,
        );
      }
    }
  });
});
