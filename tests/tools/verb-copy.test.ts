/**
 * What a verb is woven as, said as the packs weave it.
 *
 * Every pack weaves a verb under two English forms: its base form, as the
 * infinitive, and its `-ing` form, as the form its language uses there — the
 * present participle in French, German, Latin and Old English, the gerund in
 * Spanish, Portuguese and Italian (`tools/build-pack.mjs`, and the Verbs
 * bullet of `docs/PEDAGOGY.md`). Until 2026-11-09 the settings page's verbs
 * chip said "Woven as infinitives; inflected English forms are skipped", over
 * 79 to 81 `-ing` forms in each of the seven packs.
 *
 * So, read from the shipped packs rather than typed here:
 *
 * - **Every English form a pack weaves a verb under is one `SAID` has words
 *   for**: its base form or its `-ing` form. A pack that weaves a verb under a
 *   form of another kind — a past tense, a third-person `-s` — fails by name,
 *   because the copy says those are skipped, until `SAID` gives the words an
 *   account must use for it.
 * - **Every account of what a verb is woven as uses those words for each kind
 *   a pack weaves, in the clause that says what is woven**: the chip's title,
 *   which is the one a reader choosing the kinds of word sees, and the
 *   document the README sends a reader to for the reason. The clause is the
 *   account's first, up to a full stop or a semicolon, because each goes on to
 *   say what is skipped or never sent — the Verbs bullet names `-ing` again
 *   among the endings a translation service is never sent — and a kind named
 *   only there is a kind the account says is not woven.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LexEntry } from '../../src/core/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** The words an account must use for each kind of English form a verb is woven under. */
const SAID: Readonly<Record<string, { form: string; words: RegExp }>> = {
  base: { form: 'the base form, woven as the infinitive', words: /\binfinitives?\b/i },
  ing: { form: 'the -ing form, woven as a participle or gerund', words: /[“"]?-ing\b/ },
};

/** Which kind of English form an entry weaves its verb under, or the form itself when it is neither. */
const kindOf = (entry: LexEntry): string => {
  if (entry.src === entry.lemma) return 'base';
  if (entry.src.endsWith('ing')) return 'ing';
  return `"${entry.src}", a form of "${entry.lemma}"`;
};

type Entries = Record<string, LexEntry[]>;
const packs = (): { target: string; verbs: LexEntry[] }[] => {
  const index = JSON.parse(read('src/lexicon/packs/index.json')) as { packs: { target: string }[] };
  return index.packs.map(({ target }) => {
    const { entries } = JSON.parse(read(`src/lexicon/packs/en-${target}.json`)) as { entries: Entries };
    return { target, verbs: Object.values(entries).flat().filter((e) => e.pos === 'verb') };
  });
};

/** The title of the settings page's verbs chip, as the source writes it. */
function chipTitle(): string {
  const source = read('src/ui/options/sections.tsx');
  const m = /\{\s*id:\s*'verb',\s*label:\s*'[^']*',\s*title:\s*'((?:[^'\\]|\\.)*)'\s*\}/.exec(source);
  assert.ok(m, 'src/ui/options/sections.tsx has no verbs chip with a title; has POS_OPTIONS changed shape?');
  return m[1]!.replace(/\\(.)/g, '$1');
}

/** The Verbs bullet of `docs/PEDAGOGY.md`, up to the next bullet or paragraph. */
function pedagogyBullet(): string {
  const text = read('docs/PEDAGOGY.md');
  const m = /^- \*\*Verbs\*\*[^\n]*(?:\n(?!- |\n)[^\n]*)*/m.exec(text);
  assert.ok(m, 'docs/PEDAGOGY.md has no "- **Verbs**" bullet');
  return m[0].replace(/\s+/g, ' ');
}

/** An account's first clause, up to a full stop or a semicolon: the one that says what is woven. */
const wovenClause = (text: string): string => text.split(/[.;](?:\s|$)/)[0]!;

describe('what a verb is woven as', () => {
  test('every English form a pack weaves a verb under is one SAID has words for', () => {
    const all = packs();
    assert.ok(all.length >= 7, `only ${all.length} packs were read`);
    const verbs = all.reduce((n, { verbs }) => n + verbs.length, 0);
    assert.ok(verbs > 7 * 100, `only ${verbs} verb entries were read across the packs`);
    const unnamed = all.flatMap(({ target, verbs }) =>
      verbs
        .map(kindOf)
        .filter((kind) => !(kind in SAID))
        .map((kind) => `en-${target} weaves a verb under ${kind}, a kind of form SAID has no words for`),
    );
    assert.deepEqual([...new Set(unnamed)], []);
  });

  test('each account of what a verb is woven as names, where it says what is woven, every kind a pack weaves', () => {
    const woven = new Set(packs().flatMap(({ verbs }) => verbs.map(kindOf)));
    // Both kinds, or the account would be held to less than the packs weave.
    for (const kind of Object.keys(SAID)) assert.ok(woven.has(kind), `no pack weaves a verb under ${SAID[kind]!.form}`);
    const ACCOUNTS: { where: string; text: string }[] = [
      { where: 'the settings page’s verbs chip (src/ui/options/sections.tsx)', text: wovenClause(chipTitle()) },
      { where: 'the Verbs bullet of docs/PEDAGOGY.md', text: wovenClause(pedagogyBullet()) },
    ];
    const silent = ACCOUNTS.flatMap(({ where, text }) =>
      [...woven]
        .filter((kind) => kind in SAID && !SAID[kind]!.words.test(text))
        .map((kind) => `${where} does not say a verb is woven under ${SAID[kind]!.form}: "${text}"`),
    );
    assert.deepEqual(silent, []);
  });
});
