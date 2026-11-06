/**
 * What Pro is sold as, held to what Pro does.
 *
 * Until 2026-11-06 the options page's Pro section, the site's `/pricing`, its
 * pitch, the README and the landing page sold eight features, and four of
 * them could not be had at any price. "Every language at once": both rows of
 * language chips write `learning.targetLangs` as one language whatever the
 * tier, and nothing but the free tier's clamp reads it. "A different language
 * per site": no control sets a site rule's `target`. "Phrases, not just
 * words": the switch and the selector's three-word windows exist, and not one
 * pack has an English phrase to match, so turning it on weaves nothing more.
 * "Your own word lists": nothing imports a lexicon. And the options page told
 * a free reader "Pro is for using several at once".
 *
 * So each feature says whether the product has it, `shipped`, the pages read
 * `SOLD` rather than `FEATURES`, and three rules hold the flag to the code.
 * Every feature sold names, in `DELIVERED`, the file and the code that
 * delivers it, and a line for a feature not sold fails. Nothing under
 * `src/ui/` names a feature not sold, because a locked row is an
 * advertisement. And no public copy promises one, by the words `PROMISES`
 * gives each. To sell a feature again, build it, set `shipped`, and write
 * its line here.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, type Feature } from '../../src/core/entitlements.ts';
import { PITCH } from '../../src/core/pricing.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Each Pro feature on sale, the file that delivers it, and code that must be
 * there: the control a buyer turns it on with, or the call that gives a
 * buyer more.
 */
const DELIVERED: Partial<Record<Feature, { file: string; code: string; why: string }>> = {
  'hard-mode': {
    file: 'src/ui/options/commitment.tsx',
    code: "c.set('friction.hardMode'",
    why: 'the switch that turns Hard Mode on, beside the policy it generates',
  },
  providers: {
    file: 'src/ui/options/data.tsx',
    code: "c.set('providers.enabled'",
    why: 'the switch that turns a translation service on',
  },
  'unlock-quiz': {
    file: 'src/ui/options/commitment.tsx',
    code: "c.set('friction.requireQuizToUnlock'",
    why: 'the switch that puts a vocabulary check before an easier setting',
  },
  'extended-history': {
    file: 'src/ui/dashboard/index.tsx',
    code: 'historyDays(tier)',
    why: 'the dashboard asks for sixty days of attention for a Pro reader',
  },
};

/** What a page says when it promises each feature, so copy promising one not sold fails. */
const PROMISES: Record<Feature, RegExp | null> = {
  'multi-language': /\bevery language at once\b|\bseveral at once\b|\b(?:all|several) (?:of the )?languages at once\b/i,
  'per-site-language': /\bdifferent (?:language|one) per site\b|\blanguage per site\b|\bper-site language\b/i,
  phrases: /\bphrases as (?:units|well as words)\b|\bphrases, not just words\b|as well as[”"] and [“"]at the same time|\badds\b[^.]*\bphrases\b/i,
  'custom-lexicon': /\b(?:custom|your own) word lists?\b|\bimport a lexicon\b/i,
  'hard-mode': null,
  providers: null,
  'extended-history': null,
  'unlock-quiz': null,
};

const pro = FEATURES.filter((f) => f.tier === 'pro');
/** Read as sold unless it says otherwise, so a feature added without a word is held. */
const sold = pro.filter((f) => (f as { shipped?: boolean }).shipped !== false);

function tracked(...specs: string[]): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', ...specs], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** Where a page a buyer or a stranger reads gets its words. Records of what was said are not. */
const COPY = [
  ...tracked('README.md', 'docs/*.md', 'site/*.html', 'src/ui'),
  'src/core/pricing.ts',
  'tools/build-site.mjs',
  'tools/release.mjs',
];

describe('Pro sells what Pro does', () => {
  test('every Pro feature sold names what delivers it', () => {
    const missing = sold.filter((f) => !DELIVERED[f.id]).map((f) => `${f.id} (${f.label})`);
    assert.deepEqual(missing, [], `sold with nothing delivering it: ${missing.join('; ')}`);
  });

  test('a delivery line names a feature on sale', () => {
    const stale = Object.keys(DELIVERED).filter((id) => !sold.some((f) => f.id === id));
    assert.deepEqual(stale, [], `DELIVERED names features not sold: ${stale.join(', ')}`);
  });

  test("each delivery's code is in its file", () => {
    for (const [id, line] of Object.entries(DELIVERED)) {
      assert.ok(read(line!.file).includes(line!.code), `${id}: ${line!.file} has no ${line!.code}`);
    }
  });

  test('no page reads the whole feature list, which holds features not sold', () => {
    const readers = tracked('src/ui', 'tools')
      .filter((file) => /\bFEATURES\b/.test(read(file)));
    assert.deepEqual(readers, [], `render SOLD, not FEATURES: ${readers.join(', ')}`);
  });

  test('nothing under src/ui names a feature not sold, a lock being an advertisement', () => {
    const named: string[] = [];
    for (const file of tracked('src/ui')) {
      const source = read(file);
      for (const f of pro) {
        if (DELIVERED[f.id]) continue;
        if (source.includes(`'${f.id}'`) || source.includes(`"${f.id}"`)) named.push(`${file}: ${f.id}`);
      }
    }
    assert.deepEqual(named, [], `offered on a page and not sold: ${named.join('; ')}`);
  });

  test('no copy promises a feature not sold', () => {
    const promised: string[] = [];
    const check = (where: string, text: string) => {
      for (const [id, words] of Object.entries(PROMISES) as Array<[Feature, RegExp | null]>) {
        if (!words || DELIVERED[id]) continue;
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          // A promise wrapped across two lines is read with the next one.
          const pair = `${line} ${lines[i + 1] ?? ''}`;
          if (words.test(line) || (words.test(pair) && !words.test(lines[i + 1] ?? ''))) {
            promised.push(`${where}:${i + 1} promises ${id}`);
          }
        });
      }
    };
    check('PITCH', PITCH);
    for (const file of COPY) check(file, read(file));
    assert.deepEqual(promised, [], promised.join('\n'));
  });

  test('every feature has words, and the rules read something', () => {
    assert.equal(Object.keys(PROMISES).length, FEATURES.length, 'a feature with no entry in PROMISES');
    assert.ok(sold.length >= 3, `only ${sold.length} Pro features sold`);
    assert.ok(COPY.length >= 15, `only ${COPY.length} files of copy were read`);
  });
});
