/**
 * Each pack names the sources its claims were read in.
 *
 * The lexicons are CC BY-SA 4.0, and `meta.attribution` is how the credit
 * travels with the data: LICENSE-DATA, `docs/THIRD-PARTY.md` and CLAUDE.md
 * all say so. Until 2026-10-30 every pack carried one list, written before
 * any ledger existed: the curated lexicon, SUBTLEX, and a line each for the
 * Latin and Old English dictionaries. So the five modern packs credited
 * Lewis & Short and Bosworth–Toller, in which none of their claims was read,
 * and no pack named English Wiktionary, whose entries the ledgers in
 * `tools/seed/` cite 5 213 times and quote under its CC BY-SA 4.0
 * licence — nor etymonline, which every etymology claim cites.
 *
 * So the rule is derived from the ledgers, `tools/seed/<lang>-*.tsv`: every
 * source a pack's ledgers cite is named in that pack's attribution, and no
 * source the test knows is named by a pack whose ledgers never cite it. A
 * citation whose prefix the test does not know fails by name, so a new
 * source is credited before it can land. It cannot tell a line somebody
 * read from one somebody typed, as no ledger test can; it holds the credit
 * to what the ledgers claim.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');
const SEED = join(ROOT, 'tools/seed');

/**
 * What each citation prefix stands for, as a pack's attribution must name it.
 * A ledger writes `wikt:fr:maison`, `ls:dico2`, `bt:13263`, `etym:house`,
 * `wright:§320`, `mk:§160` or `ag:336`; the headers of the ledgers say so.
 */
const SOURCES: Record<string, string> = {
  wikt: 'Wiktionary',
  etym: 'Online Etymology Dictionary',
  ls: 'Lewis & Short',
  bt: 'Bosworth–Toller',
  wright: 'Wright',
  mk: 'Knott',
  ag: 'Greenough',
};

type Meta = { target: string; attribution: string[]; bands: number[] };
type Citation = { file: string; line: number; prefix: string };

const packs: Meta[] = readdirSync(PACKS)
  .filter((f) => /^en-[a-z]+\.json$/.test(f))
  .sort()
  .map((f) => (JSON.parse(readFileSync(join(PACKS, f), 'utf8')) as { meta: Meta }).meta);

/** A pack's ledgers are the seed files named for its language. */
const ledgersOf = (lang: string): string[] =>
  readdirSync(SEED)
    .filter((f) => f.startsWith(`${lang}-`) && f.endsWith('.tsv'))
    .sort();

/** A citation is a word that begins with a prefix and a colon; a comment is the ledger's own prose. */
const CITATION = /(?:^|\s)([a-z]+):(?=\S)/g;

const citationsOf = (lang: string): Citation[] =>
  ledgersOf(lang).flatMap((file) =>
    readFileSync(join(SEED, file), 'utf8')
      .split('\n')
      .flatMap((text, i) =>
        text.startsWith('#')
          ? []
          : [...text.matchAll(CITATION)].map((m) => ({ file, line: i + 1, prefix: m[1] ?? '' })),
      ),
  );

const cited = new Map(packs.map((p) => [p.target, citationsOf(p.target)]));
const credit = (p: Meta): string => p.attribution.join('\n');

describe('a pack names the sources its ledgers cite', () => {
  test('every source a pack’s ledgers cite is named in its attribution', () => {
    const missing: string[] = [];
    for (const p of packs) {
      const counts = new Map<string, number>();
      for (const c of cited.get(p.target) ?? []) {
        if (!(c.prefix in SOURCES)) {
          missing.push(`tools/seed/${c.file}:${c.line} cites “${c.prefix}:”, which SOURCES does not name`);
          continue;
        }
        counts.set(c.prefix, (counts.get(c.prefix) ?? 0) + 1);
      }
      for (const [prefix, n] of counts) {
        const name = SOURCES[prefix] ?? prefix;
        if (!credit(p).includes(name)) {
          missing.push(`en-${p.target}.json names no ${name}, which its ledgers cite ${n} time${n === 1 ? '' : 's'}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  test('no pack names a source its ledgers never cite', () => {
    const stray: string[] = [];
    for (const p of packs) {
      const prefixes = new Set((cited.get(p.target) ?? []).map((c) => c.prefix));
      for (const [prefix, name] of Object.entries(SOURCES)) {
        if (!prefixes.has(prefix) && credit(p).includes(name)) {
          stray.push(`en-${p.target}.json credits ${name}, which no ${p.target}-*.tsv ledger cites`);
        }
      }
    }
    assert.deepEqual(stray, []);
  });

  test('a pack that carries frequency bands names SUBTLEX, where the bands come from', () => {
    const silent = packs.filter((p) => p.bands.length > 0 && !credit(p).includes('SUBTLEX'));
    assert.deepEqual(
      silent.map((p) => `en-${p.target}.json`),
      [],
    );
  });

  test('the rule has something to hold', () => {
    assert.ok(packs.length >= 7, `only ${packs.length} packs were read`);
    const uncited = packs.filter((p) => (cited.get(p.target) ?? []).length === 0);
    assert.deepEqual(
      uncited.map((p) => `en-${p.target}.json has no ledger citing a source`),
      [],
      'a pack with no ledgers would pass the rule above by naming nothing',
    );
    const used = new Set([...cited.values()].flat().map((c) => c.prefix));
    const unused = Object.keys(SOURCES).filter((prefix) => !used.has(prefix));
    assert.deepEqual(unused, [], 'a source no ledger cites has outlived its line in SOURCES');
    const total = [...cited.values()].reduce((n, list) => n + list.length, 0);
    assert.ok(total > 5000, `only ${total} citations were read`);
  });
});
