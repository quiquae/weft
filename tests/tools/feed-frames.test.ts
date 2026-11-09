/**
 * The discoveries feed tells each pack's words in the verbs that are true of
 * them.
 *
 * Its frames for a plain descent once came in two sets chosen by whether the
 * language is still spoken, so Latin, being dead, was told in the set
 * written for Old English: "rēx survived into English as regal", "English
 * aquatic comes straight from aqua", "camera has not changed in a thousand
 * years". 232 of the 314 lines the Latin pack can produce said English
 * descends from the word; English borrowed it, as the Latin site's own word
 * pages say. The set is now chosen by whether English descends from the
 * language, which the language table records as `ancestorOfEnglish`.
 *
 * Worked out here over the packs that ship, with each language's own entry
 * in that table, so a flag that moves fails by name. Only the lines whose
 * sentence is wholly a frame are read — a descent, and a word that did not
 * change — because a note is the pack's own words and may say "began as"
 * about a Latin word's meaning.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entriesByTarget } from '../../src/core/lexicon.ts';
import { buildDiscoveries, type Discovery } from '../../src/core/discoveries.ts';
import { getLanguage, LANGUAGES } from '../../src/core/languages.ts';
import type { LangCode, LexEntry, MemoryCard } from '../../src/core/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');

/** The verbs that say English descends from a word. */
const DESCENT = [/survived into English/, /comes straight from/, /began as/, /thousand years/, /became English/];

/** Every line a pack's feed can print, every word met once, read as the dashboard reads it. */
function feed(lang: LangCode): Discovery[] {
  const pack = JSON.parse(readFileSync(join(PACKS, `en-${lang}.json`), 'utf8')) as { entries: Record<string, LexEntry[]> };
  const lookup = entriesByTarget(pack.entries);
  const cards: MemoryCard[] = [...lookup.keys()].map((lemma, i) => ({
    id: `${lang}:${lemma}`,
    target: lang,
    lemma,
    stability: 0,
    difficulty: 5,
    lastReview: 0,
    reps: 0,
    lapses: 0,
    exposures: 1,
    firstSeen: i,
  }));
  const language = getLanguage(lang);
  return buildDiscoveries({
    cards,
    entriesByLemma: lookup,
    historical: language.historical,
    ancestorOfEnglish: language.ancestorOfEnglish === true,
    limit: cards.length,
  });
}

const framed = (lines: Discovery[]): Discovery[] => lines.filter((d) => d.kind === 'descent' || d.kind === 'unchanged');
const toldAsDescent = (d: Discovery): boolean => DESCENT.some((verb) => verb.test(d.text));

const langs = readdirSync(PACKS)
  .filter((name) => /^en-[a-z]+\.json$/.test(name))
  .map((name) => name.slice(3, -5) as LangCode);

describe('the feed tells each pack’s words in the verbs that are true of them', () => {
  test('English descends from the stages of English, and from no other language', () => {
    // Derived from the table's own names rather than listed, so the checks
    // below cannot be satisfied by moving the flag: the first probe of this
    // file flagged Latin and every other test here still passed.
    const wrong = Object.values(LANGUAGES)
      .filter((l) => Boolean(l.ancestorOfEnglish) !== (l.historical && / English$/.test(l.name)))
      .map((l) => `${l.code} (${l.name}): ancestorOfEnglish is ${Boolean(l.ancestorOfEnglish)}`);
    assert.deepEqual(wrong, []);
    assert.ok(Object.values(LANGUAGES).some((l) => l.ancestorOfEnglish), 'no language is an ancestor of English');
  });

  test('no language English borrowed from is told as though English descends from it', () => {
    const offenders: string[] = [];
    for (const lang of langs) {
      if (getLanguage(lang).ancestorOfEnglish) continue;
      for (const d of framed(feed(lang)).filter(toldAsDescent)) offenders.push(`${lang}: ${d.text}`);
    }
    assert.deepEqual(
      offenders.slice(0, 5),
      [],
      `${offenders.length} lines tell a borrowing as a descent, first:\n  ${offenders.slice(0, 5).join('\n  ')}`,
    );
  });

  test('Old English, which English descends from, is told in the verbs of descent', () => {
    const lines = framed(feed('ang'));
    const told = lines.filter(toldAsDescent).length;
    assert.ok(told > lines.length / 2, `only ${told} of ${lines.length} Old English lines say the word became English`);
  });

  test('the packs give both rules something to police', () => {
    // 304 Latin descents and 264 Old English on 2026-10-02. Floors, so that
    // correcting a claim needs no edit here.
    assert.equal(langs.length, 7, `read ${langs.length} packs`);
    assert.ok(framed(feed('la')).length > 200, 'the Latin pack gave the feed almost nothing to tell');
    assert.ok(framed(feed('ang')).length > 200, 'the Old English pack gave the feed almost nothing to tell');
  });
});

/**
 * What the copy calls a false friend, the feed marks as one.
 *
 * The dashboard is the one place Weft marks a false friend: its line goes to
 * the top of the feed, under a madder border (`data-kind` in
 * `src/ui/dashboard/index.tsx`, `dashboard.css`). And it marks a word only
 * when the word's note says what it meant, read by `FALSE_FRIEND` in
 * `src/core/discoveries.ts` — "meant", "means", "simply", "not a", "rather
 * than". `docs/PEDAGOGY.md`'s table, the descent hub and the launch draft
 * called `mete` and `cwic` false friends while their notes said "“mete” was
 * food of any kind" and "“the quick and the dead”", so the feed told both
 * as plain descents, "mete is where meat comes from" and "quick began as
 * cwic", until 2026-11-09. That `cwic` meant alive sat on the note of
 * `swift`, woven for "quick", which the feed told as "swift became English
 * swift, but “cwic” meant alive".
 *
 * So every word a paragraph sets apart beside "false friend", in emphasis or
 * in code, must be one the feed of a pack that teaches it tells as a false
 * friend. A paragraph ending in a colon carries the block after it, which is
 * how `docs/PEDAGOGY.md` brings in its table. Widening the pattern instead
 * was measured the same day: "was" would have taken 16 notes, among them
 * "the moon was masculine" and "September was the seventh month".
 */
describe('what the copy calls a false friend, the feed marks as one', () => {
  /** Copy a reader is shown: the README, the documents, the hand-written pages and the site builder's paragraphs. */
  const COPY = [
    'README.md',
    ...execFileSync('git', ['ls-files', 'docs/*.md', 'site/*.html'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean),
    'tools/build-site.mjs',
  ];

  type Block = { file: string; line: number; text: string };

  /**
   * A file a paragraph at a time, as a reader takes it: Markdown by its blank
   * lines, a quote's marks set aside, and HTML and the builder's templates by
   * their `<p>` elements.
   */
  function blocks(file: string): Block[] {
    const text = readFileSync(join(ROOT, file), 'utf8');
    if (!file.endsWith('.md')) {
      return [...text.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => ({
        file,
        line: text.slice(0, m.index).split('\n').length,
        text: m[1] as string,
      }));
    }
    const out: Block[] = [];
    let lines: string[] = [];
    let start = 0;
    text.split('\n').forEach((raw, i) => {
      const line = raw.replace(/^>\s?/, '');
      if (line.trim() === '') {
        if (lines.length) out.push({ file, line: start + 1, text: lines.join('\n') });
        lines = [];
        return;
      }
      if (!lines.length) start = i;
      lines.push(line);
    });
    if (lines.length) out.push({ file, line: start + 1, text: lines.join('\n') });
    return out;
  }

  /** The words a block sets apart, in Markdown's emphasis or code or HTML's. */
  const named = (text: string): string[] =>
    [...text.matchAll(/`([^`\n]+)`|(?<![*\w])\*([^*\n]+)\*(?!\*)|<(?:em|i|code)>([^<]+)<\/(?:em|i|code)>/g)].map((m) =>
      (m[1] ?? m[2] ?? m[3] ?? '').trim(),
    );

  /** Each block that says "false friend", with the block a colon brings in. */
  function claims(): { at: string; words: string[] }[] {
    const out: { at: string; words: string[] }[] = [];
    for (const file of COPY) {
      const all = blocks(file);
      all.forEach((b, i) => {
        if (!/\bfalse[ -]friends?\b/i.test(b.text)) return;
        const next = /:\s*$/.test(b.text) ? all[i + 1] : undefined;
        out.push({ at: `${file}:${b.line}`, words: [...named(b.text), ...(next ? named(next.text) : [])] });
      });
    }
    return out;
  }

  const headwords = (lang: LangCode): Set<string> =>
    new Set(
      entriesByTarget(
        (JSON.parse(readFileSync(join(PACKS, `en-${lang}.json`), 'utf8')) as { entries: Record<string, LexEntry[]> })
          .entries,
      ).keys(),
    );

  /** Each word a claim names that a pack teaches, with what that pack's feed says of it. */
  function checks(): { at: string; word: string; lang: LangCode; line: Discovery | undefined }[] {
    const taught = langs.map((lang) => ({ lang, words: headwords(lang), lines: feed(lang) }));
    return claims().flatMap(({ at, words }) =>
      words.flatMap((word) =>
        taught.flatMap(({ lang, words: teach, lines }) => {
          const lemma = [word, word.toLowerCase()].find((w) => teach.has(w));
          return lemma ? [{ at, word, lang, line: lines.find((d) => d.id === `${lang}:${lemma}`) }] : [];
        }),
      ),
    );
  }

  test('every word a paragraph names beside "false friend" is one the feed tells as a false friend', () => {
    const wrong = checks()
      .filter((c) => c.line?.kind !== 'false-friend')
      .map(
        (c) =>
          `${c.at} calls ${c.lang} \`${c.word}\` a false friend, and the feed tells it as ` +
          (c.line ? `a ${c.line.kind}: “${c.line.text}”` : 'nothing at all'),
      );
    assert.deepEqual(wrong, []);
  });

  test('the copy gives the rule words to police', () => {
    // 17 words in 4 files on 2026-11-09. Floors, so that a document naming
    // one more or one fewer needs no edit here.
    const all = checks();
    const files = new Set(all.map((c) => c.at.split(':')[0]));
    assert.ok(all.length >= 12, `only ${all.length} words were read beside "false friend"; has the copy's emphasis changed?`);
    assert.ok(files.size >= 3, `only ${[...files].join(', ')} call a pack's word a false friend`);
  });
});
