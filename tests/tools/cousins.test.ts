/**
 * `tools/seed/lex-fr.tsv` is partly generated, and until now nothing said so.
 *
 * Its `etymon` and `note` columns are written by `tools/merge-cousins.mjs`
 * from `tools/seed/fr-cousins.tsv`, which exists so that reviewing French
 * etymology means reading 116 claims rather than 356 rows of vocabulary.
 * Measured on 2026-09-30: every one of the 118 values in those two columns
 * came from that file, and none was written by hand.
 *
 * The merge had three ways to fail silently, and each is an edit to the
 * review file that never reaches the product:
 *
 *   - **A correction.** The tool refused to overwrite a value already there,
 *     and counted a field holding the corrected claim and a field holding
 *     the old one alike, as "left alone (already had a value)". So fixing a
 *     claim and re-running printed exactly what an untouched tree prints,
 *     exited 0, and the old claim kept shipping. Its own doc comment said so.
 *   - **A retraction.** Deleting a claim left its value in `lex-fr.tsv`,
 *     because the merge only ever wrote. The review file's own header says a
 *     false etymology "costs more trust than a blank field"; deleting one
 *     did not blank the field.
 *   - **A line that cannot ship as written** — a space where a tab belongs,
 *     a misspelt kind, a second claim for one word. The first was skipped,
 *     the second was never applied and never reported, the third silently
 *     replaced the first.
 *
 * Nothing downstream could see any of them. CI's `Committed packs match the
 * seed lexicons` step rebuilds the packs *from* `lex-fr.tsv`, one layer
 * later, so a stale `lex-fr.tsv` passed it with everything green.
 *
 * So the merge is a pure function now, in `tools/cousins.ts`, that sorts
 * every field into in step, added, disagreeing or unclaimed; and the last
 * suite below checks the committed lexicon is a fixed point of it. That is
 * the packs step's rebuild-and-compare, one layer upstream — and unlike the
 * screenshots it can ask about content rather than provenance, because this
 * is text and comes out the same on every machine.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeCousins, type Drift } from '../../tools/cousins.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const AMOROUS = 'shares a root with English “amorous”';
const AMIABLE = 'shares a root with English “amiable”';

/** One lexicon row: lemma, pos, tgt, tgt2, gender, ipa, etymon, note. */
const row = (lemma: string, pos: string, tgt: string, tgt2: string, gender: string, etymon = '', note = '') =>
  [lemma, pos, tgt, tgt2, gender, '', etymon, note].join('\t');
const lexicon = (...rows: string[]) =>
  ['# lemma | pos | tgt | tgt2 | gender | ipa | etymon | note', ...rows].join('\n') + '\n';
const claim = (lemma: string, kind: string, value: string, sources: string) =>
  [lemma, kind, value, sources].join('\t');
const cousins = (...claims: string[]) => ['# lemma <TAB> kind <TAB> value <TAB> sources', ...claims].join('\n') + '\n';

// Each claim cites the entry for every word it names, written out by hand
// rather than derived, so a fixture cannot agree with the rule by construction.
const FOREST = claim('forest', 'descent', 'forest', 'etym:forest wikt:fr:forêt');
const LOVE = claim('love', 'cousin', AMOROUS, 'etym:amorous wikt:fr:amour wikt:fr:aimer');

// Five fields rather than eight, the way a hand edit leaves a row. Nothing
// claims `fear`, so a merge has no business rewriting it.
const FEAR = ['fear', 'noun', 'peur', 'peurs', 'f'].join('\t');

// Line 1 is the header, so love is on lines 2 and 3 and forest on 4.
const UNMERGED = lexicon(
  row('love', 'noun', 'amour', 'amours', 'm'),
  row('love', 'verb', 'aimer', 'aimant', ''),
  row('forest', 'noun', 'forêt', 'forêts', 'f'),
  FEAR,
);
const CLAIMS = cousins(FOREST, LOVE);
/** CLAIMS merged into UNMERGED, written out by hand. */
const MERGED = lexicon(
  row('love', 'noun', 'amour', 'amours', 'm', '', AMOROUS),
  row('love', 'verb', 'aimer', 'aimant', '', '', AMOROUS),
  row('forest', 'noun', 'forêt', 'forêts', 'f', 'forest'),
  FEAR,
);

/** Somebody checked the `love` claim and corrected it. */
const CORRECTED_CLAIMS = cousins(FOREST, claim('love', 'cousin', AMIABLE, 'etym:amiable wikt:fr:amour wikt:fr:aimer'));
const CORRECTED = lexicon(
  row('love', 'noun', 'amour', 'amours', 'm', '', AMIABLE),
  row('love', 'verb', 'aimer', 'aimant', '', '', AMIABLE),
  row('forest', 'noun', 'forêt', 'forêts', 'f', 'forest'),
  FEAR,
);

/** Somebody found the `forest` claim false and deleted its line. */
const RETRACTED_CLAIMS = cousins(LOVE);
const RETRACTED = lexicon(
  row('love', 'noun', 'amour', 'amours', 'm', '', AMOROUS),
  row('love', 'verb', 'aimer', 'aimant', '', '', AMOROUS),
  row('forest', 'noun', 'forêt', 'forêts', 'f'),
  FEAR,
);

const where = (drifts: Drift[]) => drifts.map((d) => [d.lemma, d.kind, d.line, d.lexicon, d.claim]);

describe('merge-cousins says which claims did not land', () => {
  test('an empty field takes its claim, on every row its lemma has', () => {
    const result = mergeCousins(UNMERGED, CLAIMS);
    assert.equal(result.text, MERGED);
    assert.deepEqual(where(result.added), [
      ['love', 'cousin', 2, '', AMOROUS],
      ['love', 'cousin', 3, '', AMOROUS],
      ['forest', 'descent', 4, '', 'forest'],
    ]);
  });

  test('a field already holding its claim is in step, and no line is rewritten', () => {
    const result = mergeCousins(MERGED, CLAIMS);
    assert.equal(result.text, MERGED, 'a merge with nothing to do changed the file');
    assert.equal(result.inStep, 3);
    assert.deepEqual(
      [result.added, result.disagree, result.unclaimed, result.unmatched, result.malformed],
      [[], [], [], [], []],
    );
  });

  test('a corrected claim is a disagreement, not a field in step', () => {
    const result = mergeCousins(MERGED, CORRECTED_CLAIMS);
    assert.deepEqual(where(result.disagree), [
      ['love', 'cousin', 2, AMOROUS, AMIABLE],
      ['love', 'cousin', 3, AMOROUS, AMIABLE],
    ]);
    assert.equal(result.inStep, 1, 'only forest still says what fr-cousins.tsv says');
    assert.equal(result.text, MERGED, 'without --force a disagreement is left for a human to settle');
  });

  test('--force makes a corrected claim land', () => {
    assert.equal(mergeCousins(MERGED, CORRECTED_CLAIMS, { force: true }).text, CORRECTED);
  });

  test('a value fr-cousins.tsv no longer claims is reported, not kept in silence', () => {
    const result = mergeCousins(MERGED, RETRACTED_CLAIMS);
    assert.deepEqual(where(result.unclaimed), [['forest', 'descent', 4, 'forest', '']]);
    assert.equal(result.text, MERGED, 'without --force a value was removed');
  });

  test('--force clears a retracted claim', () => {
    assert.equal(mergeCousins(MERGED, RETRACTED_CLAIMS, { force: true }).text, RETRACTED);
  });

  test('a claim whose lemma matches no row is reported, not dropped', () => {
    const result = mergeCousins(MERGED, cousins(FOREST, LOVE, claim('lion', 'descent', 'lion', 'etym:lion')));
    assert.deepEqual(result.unmatched.map((c) => [c.lemma, c.kind, c.line]), [['lion', 'descent', 4]]);
  });

  test('a line that cannot ship as written is reported, not skipped', () => {
    const cases: Array<[string, string]> = [
      ['a space where a tab belongs', 'forest descent forest etym:forest wikt:fr:forêt'],
      ['a misspelt kind', claim('forest', 'decsent', 'forest', 'etym:forest wikt:fr:forêt')],
      ['a second claim for one word', claim('love', 'cousin', AMIABLE, 'etym:amiable wikt:fr:amour wikt:fr:aimer')],
    ];
    for (const [what, line] of cases) {
      const result = mergeCousins(MERGED, cousins(FOREST, LOVE, line));
      assert.deepEqual(result.malformed.map((m) => m.line), [4], `${what} was not reported`);
    }
  });

  test('the tool refuses a corrected claim out loud, and lands it with --force', () => {
    // The tool and its module copied beside a copy of the two files, so its
    // own ROOT resolves into a temporary directory and the tracked lexicon
    // is out of reach of every run below.
    const root = mkdtempSync(join(tmpdir(), 'weft-cousins-'));
    try {
      mkdirSync(join(root, 'tools/seed'), { recursive: true });
      for (const file of ['merge-cousins.mjs', 'cousins.ts']) {
        copyFileSync(join(ROOT, 'tools', file), join(root, 'tools', file));
      }
      const lex = join(root, 'tools/seed/lex-fr.tsv');
      writeFileSync(lex, MERGED);
      writeFileSync(join(root, 'tools/seed/fr-cousins.tsv'), CORRECTED_CLAIMS);
      const run = (...flags: string[]) =>
        spawnSync(process.execPath, [join(root, 'tools/merge-cousins.mjs'), ...flags], { encoding: 'utf8' });

      const dry = run('--dry');
      assert.equal(dry.status, 1, 'a dry run called a lexicon that disagrees with its claims in step');
      assert.match(dry.stdout + dry.stderr, /\blove\b/, 'the report does not name the word whose claim did not land');

      assert.equal(run().status, 1, 'a merge that left a corrected claim unapplied reported success');
      assert.equal(readFileSync(lex, 'utf8'), MERGED, 'without --force the lexicon changed');

      assert.equal(run('--force').status, 0);
      assert.equal(readFileSync(lex, 'utf8'), CORRECTED);
      assert.equal(run('--dry').status, 0, 'after --force the lexicon is still reported out of step');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/*
 * "Nothing here is a guess", the review file's header says, and
 * twenty-nine of its 116 claims turned out to be false — eighteen found on
 * 2026-09-30, eleven more when every line was checked on 2026-10-01. Every
 * one was a claim about a word nobody had looked up: eleven descents whose
 * English word came from somewhere else — `answer` is Old English, `gift`
 * Old Norse — and seven cousin notes naming the wrong Latin root for the
 * French word. So a claim now carries the entries it was checked against,
 * and the rule is derived from the claim itself: the etymonline entry for
 * every English word it names, and the Wiktionary entry for every French
 * word it is about. A claim that names a word with no entry cited cannot
 * ship, and `--force` does not change that, because force settles which of
 * two files is right and this is a question neither file can answer.
 */
describe('a claim cites the entry for every word it names', () => {
  const LOVE_ROWS = lexicon(row('love', 'noun', 'amour', 'amours', 'm'), row('love', 'verb', 'aimer', 'aimant', ''));
  const refused = (lexiconText: string, line: string) => {
    const result = mergeCousins(lexiconText, cousins(line), { force: true });
    assert.equal(result.text, lexiconText, 'a claim that cannot ship reached the lexicon anyway, under --force');
    return result.malformed.map((m) => [m.line, m.reason]);
  };

  test('a claim with no sources is refused, not shipped', () => {
    const result = refused(UNMERGED, ['forest', 'descent', 'forest'].join('\t'));
    assert.equal(result.length, 1, 'a claim citing nothing was accepted');
    assert.equal(result[0]?.[0], 2);
  });

  test('a descent cites the English word it says was borrowed', () => {
    const [[line, reason] = []] = refused(UNMERGED, claim('forest', 'descent', 'forest', 'wikt:fr:forêt'));
    assert.equal(line, 2);
    assert.match(String(reason), /etym:forest\b/);
  });

  test('a cousin note cites every English word it quotes, by its etymonline slug', () => {
    const LEX = lexicon(row('fish', 'noun', 'poisson', 'poissons', 'm'), row('find', 'verb', 'trouver', 'trouvant', ''));
    const cases: Array<[string, string, RegExp]> = [
      ['the second of two quoted words',
        claim('fish', 'cousin', 'shares a root with English “piscine” and “Pisces”', 'etym:piscine wikt:fr:poisson'),
        /etym:pisces\b/],
      ['a capitalised word, cited in capitals',
        claim('fish', 'cousin', 'shares a root with English “Pisces”', 'etym:Pisces wikt:fr:poisson'),
        /etym:pisces\b/],
      ['a quoted phrase, cited with a space',
        claim('find', 'cousin', 'shares a root with English “treasure trove”', 'etym:treasure wikt:fr:trouver'),
        /etym:treasure-trove\b/],
    ];
    for (const [what, line, missing] of cases) {
      const [[, reason] = []] = refused(LEX, line);
      assert.match(String(reason), missing, `${what}: not refused for the entry it lacks`);
    }
    // And the same three, cited properly, are accepted.
    const ok = mergeCousins(
      LEX,
      cousins(claim('fish', 'cousin', 'shares a root with English “piscine” and “Pisces”', 'etym:piscine etym:pisces wikt:fr:poisson'),
        claim('find', 'cousin', 'shares a root with English “treasure trove”', 'etym:treasure-trove wikt:fr:trouver')),
    );
    assert.deepEqual(ok.malformed, []);
  });

  test('a claim cites the French word on every row its lemma has', () => {
    // `love` is amour as a noun and aimer as a verb, and one claim lands on
    // both, so it has to be true of both. `work` is the case that makes this
    // matter: its note says travail and travailler are both the root of
    // English travel, which holds only because etymonline traces travel to
    // the noun as well as to the verb — a fact about the second French word
    // that nobody reading only the first would ever have checked.
    const [[line, reason] = []] = refused(LOVE_ROWS, claim('love', 'cousin', AMOROUS, 'etym:amorous wikt:fr:amour'));
    assert.equal(line, 2);
    assert.match(String(reason), /wikt:fr:aimer\b/);
    assert.doesNotMatch(String(reason), /wikt:fr:amour\b/, 'a source that was cited is reported missing');
  });

  test('a note that quotes no English word still cites the one it means', () => {
    // "the English word for a feeding trough comes from this verb" cannot
    // quote “manger” — tools/verify-packs.mjs refuses a note quoting the
    // French word back — so the word is named only by its entry.
    const EAT = lexicon(row('eat', 'verb', 'manger', 'mangeant', ''));
    const note = 'the English word for a feeding trough comes from this verb';
    const [[, reason] = []] = refused(EAT, claim('eat', 'cousin', note, 'wikt:fr:manger'));
    assert.match(String(reason), /\betym:/);
    assert.deepEqual(mergeCousins(EAT, cousins(claim('eat', 'cousin', note, 'etym:manger wikt:fr:manger'))).malformed, []);
  });

  test('a source that is not an entry reference is refused', () => {
    // The control: the same claim citing only what it needs is accepted, so
    // each refusal below is about the one token added to it.
    assert.deepEqual(mergeCousins(UNMERGED, cousins(FOREST)).malformed, []);
    for (const source of ['https://www.etymonline.com/word/forest', 'etymonline:forest', 'wikt:forêt', 'etym:']) {
      const result = refused(UNMERGED, claim('forest', 'descent', 'forest', `etym:forest wikt:fr:forêt ${source}`));
      assert.equal(result.length, 1, `"${source}" was accepted as a source`);
      assert.ok(String(result[0]?.[1]).includes(source), `the refusal does not name "${source}"`);
    }
  });
});

describe('the committed French lexicon is what fr-cousins.tsv says', () => {
  const result = mergeCousins(
    readFileSync(join(ROOT, 'tools/seed/lex-fr.tsv'), 'utf8'),
    readFileSync(join(ROOT, 'tools/seed/fr-cousins.tsv'), 'utf8'),
  );
  const column = (d: Drift) => (d.kind === 'descent' ? 'etymon' : 'note');
  const show = (d: Drift) =>
    `lex-fr.tsv:${d.line} ${d.lemma} (${column(d)}): lex-fr.tsv has "${d.lexicon}", fr-cousins.tsv says "${d.claim}"`;

  test('every claim in fr-cousins.tsv is what lex-fr.tsv ships', () => {
    const offenders = [
      ...result.added.map(show),
      ...result.disagree.map(show),
      ...result.unmatched.map((c) => `fr-cousins.tsv:${c.line} ${c.lemma}: no row in lex-fr.tsv carries this lemma`),
      ...result.malformed.map((m) => `fr-cousins.tsv:${m.line}: ${m.reason}`),
    ];
    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} claim(s) in fr-cousins.tsv are not what the French pack ships. ` +
        'Fix the line, or run `npm run cousins -- --force`, then `npm run packs`.',
    );
    // 116 claims on 2026-09-30, landing in 118 fields because `love` and
    // `work` each have a noun row and a verb row. The floor is what stops
    // this passing on a parse that found nothing.
    assert.ok(result.inStep >= 100, `only ${result.inStep} fields were found in step, so this is reading almost nothing`);
  });

  test('every etymon and note in lex-fr.tsv is claimed in fr-cousins.tsv', () => {
    assert.deepEqual(
      result.unclaimed.map(show),
      [],
      'A value fr-cousins.tsv does not claim is a retraction that never landed, or etymology written into ' +
        'the translation table where a review of fr-cousins.tsv will never see it. Move it into ' +
        'fr-cousins.tsv, or run `npm run cousins -- --force` to clear it, then `npm run packs`.',
    );
  });
});
