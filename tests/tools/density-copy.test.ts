/**
 * What a density is a share of, said as the selector counts it.
 *
 * `selectSwaps()` weaves `round(ratio × eligible)` words, and `eligible`
 * counts only the words of a page with an entry in the pack — the 356 English
 * lemmas a pack carries — so a density is a share of the words Weft knows: not
 * of the page, and not of its content words, most of which no pack has. The
 * first-run page said so, "of the words Weft knows", and since 2026-11-08 so
 * does the store description (`store-description.test.ts`). Until the same
 * day the settings page's Resting density and Ceiling rows said "6% of content
 * words", the popup "1 word in 17 of the content words is in French", the
 * Standard preset "a third of the content words", and the landing demo's
 * readout "35% of content words": on a page where a third of the content
 * words have an entry, "6% of content words" overstated the density threefold.
 *
 * So, read from the code rather than typed here:
 *
 * - **No copy gives a share of "content words"** — in the source, the README,
 *   the tracked Markdown under `docs/` or the hand-written pages under
 *   `site/`. The phrase stays where it names the class, the opposite of
 *   function words: "Content words carry the meaning."
 * - **Every line that prints a density through `oneWordIn()` says what it is a
 *   share of**, unless `CONTINUES` names it with why; and so does the demo's
 *   readout, which counts its own.
 * - **A preset that quotes its density as "1 word in N" quotes the N the page
 *   prints beside it.** The first-run page shows a preset's detail directly
 *   above "At rest — 1 word in 17", and Standard's said "around 1 word in 16".
 * - **The end-to-end test that refuses a density over an unwoven page looks
 *   for the words the popup prints.** It looked for "of the content words is
 *   in", and renaming the copy alone would have left it passing on a popup
 *   that printed a density anywhere.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFFICULTY_PRESETS } from '../../src/core/settings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** The share a density is of, in the first-run page's words. */
const KNOWN = 'of the words Weft knows';

/** A share given of content words: the class, where the selector counts the words with an entry. */
const OF_CONTENT = /\bof\s+(?:the\s+)?content\s+words\b/i;

/**
 * Files that may quote the old copy, with why: a dated record of what a
 * screenshot printed when it was read.
 */
const RECORDS: Record<string, string> = {
  'docs/SUBMIT-STATUS.md':
    'the record of the 2026-10-24 gate, which quotes what chrome-05-settings.png printed that day',
};

/** Lines that print a density through `oneWordIn()` and lean on the line before for its share, with why. */
const CONTINUES: { file: string; line: string; why: string }[] = [
  {
    file: 'src/ui/onboarding/index.tsx',
    line: 'After a long scroll',
    why: 'the ceiling’s hint, the second of a pair whose first, “At rest”, names the share',
  },
];

/** A text as a reader meets it: comment markers and Markdown quote marks off, lines joined. */
const flat = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\*|\/\/|>)\s?/, ''))
    .join(' ')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ');

/** The words around each share of content words a text gives. */
function sharesOfContent(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(OF_CONTENT.source, 'gi');
  const f = flat(text);
  for (const m of f.matchAll(re)) out.push(f.slice(Math.max(0, m.index! - 40), m.index! + m[0].length + 10));
  return out;
}

const FILES = execFileSync(
  'git',
  ['ls-files', 'src/*.ts', 'src/*.tsx', 'README.md', 'docs/*.md', 'site/*.html'],
  { cwd: ROOT, encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

/** Every line under `src/ui/` that prints a density through `oneWordIn()`. */
const DENSITY_LINES = FILES.filter((f) => f.startsWith('src/ui/') && f.endsWith('.tsx')).flatMap((file) =>
  read(file)
    .split('\n')
    .map((text, i) => ({ file, at: i + 1, text }))
    .filter((l) => l.text.includes('oneWordIn(') && !/\bfunction oneWordIn\b/.test(l.text)),
);

const continued = (l: { file: string; text: string }) =>
  CONTINUES.some((c) => c.file === l.file && l.text.includes(c.line));

describe('what a density is said to be a share of', () => {
  test('the reader finds a share of content words, and not the class where it is one', () => {
    for (const text of [
      '6% of content words — 1 word in 17',
      '<strong>{oneWordIn(state.ratio)}</strong> of the content words is in {lang.name}.',
      'climbs towards a third of the content words after half an hour on a feed',
      "readout.textContent = pct + '% of content words — 1 in ' + oneIn;",
      '// a third of the\n// content words, wrapped across a comment',
    ]) {
      assert.equal(sharesOfContent(text).length, 1, `no share of content words was read in “${text}”`);
    }
    for (const text of [
      'everything else, for almost no vocabulary gained. Content words carry the meaning.',
      'almost no vocabulary gained. Content words — concrete nouns first, then',
      'Note content words the shipped pack has never heard of.',
      '1 word in 17 of the words Weft knows is in French.',
    ]) {
      assert.deepEqual(sharesOfContent(text), [], `“${text}” was read as a share`);
    }
  });

  test('the copy is read, and the surfaces that print a density are found', () => {
    assert.ok(FILES.length >= 70, `only ${FILES.length} files were read`);
    // 5 on 2026-11-08: the settings page's two rows, the popup, and the first-run page's pair.
    assert.ok(DENSITY_LINES.length >= 4, `only ${DENSITY_LINES.length} lines print a density through oneWordIn()`);
    for (const file of ['src/ui/options/sections.tsx', 'src/ui/popup/index.tsx', 'src/ui/onboarding/index.tsx']) {
      assert.ok(DENSITY_LINES.some((l) => l.file === file), `${file} prints no density through oneWordIn()`);
    }
  });

  test('no copy gives a density as a share of content words', () => {
    const found = FILES.filter((file) => !(file in RECORDS)).flatMap((file) =>
      sharesOfContent(read(file)).map((around) => `${file}: …${around}…`),
    );
    assert.deepEqual(
      found,
      [],
      `selectSwaps() weaves a share of the words with an entry in the pack: say “${KNOWN}”`,
    );
  });

  test('every line that prints a density through oneWordIn() says what it is a share of', () => {
    const unsaid = DENSITY_LINES.filter((l) => !l.text.includes(KNOWN) && !continued(l)).map(
      (l) => `${l.file}:${l.at}: ${l.text.trim()}`,
    );
    assert.deepEqual(unsaid, [], `a density is a share of the words Weft knows; say “${KNOWN}” beside it`);

    for (const c of CONTINUES) {
      const lines = DENSITY_LINES.filter((l) => l.file === c.file && l.text.includes(c.line));
      assert.equal(lines.length, 1, `CONTINUES names “${c.line}” in ${c.file}, which prints no density there`);
      assert.ok(!lines[0]!.text.includes(KNOWN), `“${c.line}” in ${c.file} says the share itself; drop it from CONTINUES`);
      const before = DENSITY_LINES.filter((l) => l.file === c.file && l.at < lines[0]!.at);
      assert.ok(
        before.some((l) => l.text.includes(KNOWN)),
        `“${c.line}” in ${c.file} leans on a line before it that names no share`,
      );
    }
    for (const file of Object.keys(RECORDS)) assert.ok(FILES.includes(file), `RECORDS names ${file}, which is not tracked`);
  });

  test('the landing demo’s readout says what its share is of', () => {
    const page = read('site/index.html');
    const lines = page.split('\n').filter((line) => /\breadout\.textContent\s*=/.test(line));
    assert.equal(lines.length, 1, 'the demo no longer writes its readout in one place');
    assert.ok(lines[0]!.includes(KNOWN), `the demo’s readout gives a share without saying of what: ${lines[0]!.trim()}`);
  });

  test('a preset that quotes its density as 1 word in N quotes the N the page prints', () => {
    // oneWordIn() in src/ui/components/pieces.tsx prints Math.max(2, Math.round(1 / ratio)).
    const prints = (ratio: number) => Math.max(2, Math.round(1 / ratio));
    let quoted = 0;
    for (const p of DIFFICULTY_PRESETS) {
      const figures = [...p.detail.matchAll(/\b1 (?:word )?in (\d+)\b/g)].map((m) => Number(m[1]));
      const ratios = [p.patch['weave.baseRatio'], p.patch['weave.ceilingRatio']] as number[];
      figures.forEach((n, i) => {
        quoted++;
        const ratio = ratios[i];
        assert.ok(ratio !== undefined, `${p.id} quotes more figures than it has a resting density and a ceiling`);
        assert.equal(
          n,
          prints(ratio),
          `${p.id} says “1 word in ${n}” where the page prints 1 word in ${prints(ratio)} for ${ratio}`,
        );
      });
    }
    assert.ok(quoted >= 2, `only ${quoted} figures were read in the presets`);
  });

  test('the end-to-end test that refuses a density over an unwoven page looks for the popup’s words', () => {
    const spec = read('tests/e2e/friction.spec.ts');
    const m = spec.match(/getByText\(\/(.+?)\/(\w*)\),\s*'a density was printed over an unwoven page'/);
    assert.ok(m, 'friction.spec.ts no longer refuses a density over an unwoven page');
    const refuses = new RegExp(m[1]!, m[2]);
    const popup = DENSITY_LINES.filter((l) => l.file === 'src/ui/popup/index.tsx');
    assert.equal(popup.length, 1, 'the popup prints its density on more than one line');
    const printed = popup[0]!.text.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, 'X').trim();
    assert.match(printed, refuses, `the test looks for ${refuses}, which the popup no longer prints: “${printed}”`);
  });
});
