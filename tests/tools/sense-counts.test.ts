/**
 * How many senses a quoted English word has, said as the core list counts them.
 *
 * `tools/seed/english-core.tsv` counts the common senses of every English
 * lemma, and the selector gates on the count: a word with more senses than
 * `maxSenses`, four by default, is never woven, and below that each sense
 * costs it score (`scoreCandidate()`'s `ambiguityGate`). Three places quote a
 * count to explain the gate — the core list's own header, the Ambiguity
 * bullet of `docs/PEDAGOGY.md`, and the comment above the gate — and until
 * 2026-11-09 the comment gave "light" nine senses, where the list gives it
 * eight.
 *
 * So every count of an English word's senses that the source, the tools, the
 * seed headers, the README, the documents or the site quote is the one the
 * core list gives that word: "“light” with eight senses", "“light” (8
 * senses)", and a bare "“bridge” (2)" in a sentence about senses. Notes in a
 * seed's rows are about the target word, not the English one, so a seed is
 * read only in its `#` header; `TODO.md` and `CLAUDE.md` are records, and
 * quote the wrong count to say it was wrong.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const CORE = 'tools/seed/english-core.tsv';

/** Each lemma's sense counts and the line that gives each, one per part of speech. */
function coreSenses(): Map<string, { senses: number; line: number }[]> {
  const counts = new Map<string, { senses: number; line: number }[]>();
  read(CORE)
    .split('\n')
    .forEach((text, i) => {
      if (!text.trim() || text.startsWith('#')) return;
      const [lemma, , , , senses] = text.split('\t');
      const list = counts.get(lemma!) ?? [];
      list.push({ senses: Number(senses), line: i + 1 });
      counts.set(lemma!, list);
    });
  return counts;
}

const NUMBERS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const count = (said: string): number => (/^\d+$/.test(said) ? Number(said) : (NUMBERS[said.toLowerCase()] ?? NaN));

/** The files that may quote a count, and how much of each a reader meets as prose. */
function texts(): { path: string; text: string }[] {
  const files = execFileSync(
    'git',
    ['ls-files', 'README.md', 'docs/*.md', 'site/*.html', 'src/*.ts', 'src/*.tsx', 'tools/*.mjs', 'tools/*.ts', 'tools/*.md', 'tools/*.tsv'],
    { cwd: ROOT, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
  return files.map((path) => {
    let lines = read(path).split('\n');
    if (path.endsWith('.tsv')) lines = lines.filter((line) => line.startsWith('#'));
    // Comment markers and Markdown emphasis off, lines joined, so a claim a
    // line break divides is read whole.
    const text = lines
      .map((line) => line.replace(/^\s*(?:\*|\/\/|#|>)\s?/, ''))
      .join(' ')
      .replace(/[*`]/g, '')
      .replace(/\s+/g, ' ');
    return { path, text };
  });
}

const Q = '[“"]([a-z]+)[”"]';
/** "“light” with eight senses", "“light” has eight senses", "“light” (8 senses)". */
const CLAIM = new RegExp(`${Q},?\\s+(?:with|has|having)\\s+([a-z]+|\\d+)\\s+senses\\b|${Q}\\s+\\(([a-z]+|\\d+)\\s+senses?\\)`, 'gi');
/** "“bridge” (2)", read only in a sentence that is about senses. */
const BARE = new RegExp(`${Q}\\s+\\((\\d+)\\)`, 'g');

function claims(): { path: string; word: string; said: string }[] {
  return texts().flatMap(({ path, text }) => {
    const found: { path: string; word: string; said: string }[] = [];
    for (const m of text.matchAll(CLAIM)) found.push({ path, word: (m[1] ?? m[3])!, said: (m[2] ?? m[4])! });
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      if (!/\bsenses\b/i.test(sentence)) continue;
      for (const m of sentence.matchAll(BARE)) found.push({ path, word: m[1]!, said: m[2]! });
    }
    return found;
  });
}

describe('how many senses a quoted English word has', () => {
  test('every count quoted is the one the core list gives the word', () => {
    const core = coreSenses();
    assert.ok(core.size > 300, `only ${core.size} lemmas were read from ${CORE}`);
    const found = claims();
    assert.ok(found.length >= 4, `only ${found.length} counts were read; has the phrasing changed?`);
    const wrong = found.flatMap(({ path, word, said }) => {
      const rows = core.get(word.toLowerCase());
      if (!rows) return [`${path}: "${word}" is given ${said} senses and is not in ${CORE}`];
      if (rows.some((row) => row.senses === count(said))) return [];
      const given = rows.map((row) => `${row.senses} (${CORE}:${row.line})`).join(' or ');
      return [`${path}: "${word}" is given ${said} senses, where the core list gives ${given}`];
    });
    assert.deepEqual(wrong, []);
  });
});
