/**
 * Every feature Weft has is free, and nothing unbuilt is offered.
 *
 * Until 2026-11-06 Pro sold eight features and four could not be had at any
 * price: every language at once, a language per site, phrases and your own
 * word lists. Since 2026-11-09 nothing is sold: every shipped feature is free,
 * and the buy buttons, `/pricing` and the checkout links are gone.
 *
 * So each feature says whether the product has it, `shipped`, and four rules
 * hold the flag to the code. Every shipped feature is free. Every shipped
 * feature names, in `DELIVERED`, the file and the code that delivers it.
 * Nothing under `src/ui/` names a feature not shipped, because a locked row is
 * an advertisement. And no public copy promises one, by the words `PROMISES`
 * gives each, or names a price or a checkout.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, type Feature } from '../../src/core/entitlements.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Each shipped feature, the file that delivers it, and code that must be there. */
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
    why: 'the dashboard asks for sixty days of attention',
  },
};

/** What a page says when it promises each feature, so copy promising one not shipped fails. */
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

/** A sale: a checkout, the pricing page, a paid tier named, or a structured-data price. */
const SALE = /lemonsqueezy|\/pricing\b(?!\.ts)|pricing\.html|\bWeft Pro\b|\bPart of Pro\b|\bupgrade to Pro\b|"price":\s*"(?!0")[^"]*"/i;

/** Read as shipped unless it says otherwise, so a feature added without a word is held. */
const shipped = FEATURES.filter((f) => (f as { shipped?: boolean }).shipped !== false);
const unshipped = FEATURES.filter((f) => !shipped.includes(f));

function tracked(...specs: string[]): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', ...specs], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** Dated records of what a run measured, which keep the words of their day. */
const RECORDS = new Set(['docs/SUBMIT-STATUS.md']);

/** Where a page a stranger reads gets its words. Records of what was said are not. */
const COPY = [
  ...tracked('README.md', 'docs/*.md', 'site/*.html', 'src/ui').filter((f) => !RECORDS.has(f)),
  'tools/build-site.mjs',
  'tools/release.mjs',
];

describe('every feature Weft has is free', () => {
  test('no shipped feature is paid', () => {
    const paid = shipped.filter((f) => f.tier !== 'free').map((f) => f.id);
    assert.deepEqual(paid, [], `shipped behind a paywall: ${paid.join(', ')}`);
  });

  test('every shipped feature names what delivers it', () => {
    const missing = shipped.filter((f) => !DELIVERED[f.id]).map((f) => `${f.id} (${f.label})`);
    assert.deepEqual(missing, [], `shipped with nothing delivering it: ${missing.join('; ')}`);
  });

  test('a delivery line names a shipped feature', () => {
    const stale = Object.keys(DELIVERED).filter((id) => !shipped.some((f) => f.id === id));
    assert.deepEqual(stale, [], `DELIVERED names features not shipped: ${stale.join(', ')}`);
  });

  test("each delivery's code is in its file", () => {
    for (const [id, line] of Object.entries(DELIVERED)) {
      assert.ok(read(line!.file).includes(line!.code), `${id}: ${line!.file} has no ${line!.code}`);
    }
  });

  test('no page reads the whole feature list, which holds features not shipped', () => {
    const readers = tracked('src/ui', 'tools').filter((file) => /\bFEATURES\b/.test(read(file)));
    assert.deepEqual(readers, [], `pages read FEATURES: ${readers.join(', ')}`);
  });

  test('nothing under src/ui names a feature not shipped, a lock being an advertisement', () => {
    const named: string[] = [];
    for (const file of tracked('src/ui')) {
      const source = read(file);
      for (const f of unshipped) {
        if (source.includes(`'${f.id}'`) || source.includes(`"${f.id}"`)) named.push(`${file}: ${f.id}`);
      }
    }
    assert.deepEqual(named, [], `offered on a page and not shipped: ${named.join('; ')}`);
  });

  test('no copy promises a feature not shipped, or offers a sale', () => {
    const found: string[] = [];
    for (const file of COPY) {
      const lines = read(file).split('\n');
      lines.forEach((line, i) => {
        if (SALE.test(line)) found.push(`${file}:${i + 1} offers a sale`);
        for (const [id, words] of Object.entries(PROMISES) as Array<[Feature, RegExp | null]>) {
          if (!words || DELIVERED[id]) continue;
          // A promise wrapped across two lines is read with the next one.
          const pair = `${line} ${lines[i + 1] ?? ''}`;
          if (words.test(line) || (words.test(pair) && !words.test(lines[i + 1] ?? ''))) {
            found.push(`${file}:${i + 1} promises ${id}`);
          }
        }
      });
    }
    assert.deepEqual(found, [], found.join('\n'));
  });

  test('every feature has words, and the rules read something', () => {
    assert.equal(Object.keys(PROMISES).length, FEATURES.length, 'a feature with no entry in PROMISES');
    assert.ok(shipped.length >= 3, `only ${shipped.length} features shipped`);
    assert.ok(COPY.length >= 15, `only ${COPY.length} files of copy were read`);
    assert.ok(SALE.test('"price": "24"') && !SALE.test('"price": "0"'), 'the sale pattern reads prices');
  });
});
