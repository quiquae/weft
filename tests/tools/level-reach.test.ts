/**
 * Every level a reader can choose weaves something, from every pack that ships.
 *
 * Settings → Level offers six, A1 to C2, and the selector admits a word only
 * if its band lies in a window around the level (`bandWindow()` in
 * `src/core/selector.ts`). Every pack shipped tops out at band 4, and until
 * 2026-11-08 the window was one band either side of the level whatever the
 * pack held, so it slid past every band a pack has: C2 looked for bands 5
 * and 6, which no pack carries, C1 for band 4 and above, 4 lemmas of 356, and
 * B2 for bands 3 to 5, 23 of them. Measured with the French pack at the
 * default ceiling, 35%, B2, C1 and C2 each wove **nothing** on the README, on
 * `docs/PEDAGOGY.md` and on the e2e article page, while the popup went on
 * printing a density over the unwoven page. And raising the level is judged
 * harder, so it applied at once: the one control that set C2 was a way to make
 * Weft disappear with no cooldown.
 *
 * So, read from the shipped packs rather than typed here:
 *
 * - **At the ceiling, every level weaves a word of every pack** on ordinary
 *   prose (the README) and on the page the end-to-end suite weaves.
 * - **Every caller hands the selector the pack's own top band**, through
 *   `topBandOf()`, so a page cannot quietly go back to a window that runs past
 *   the pack. The field is required, so `tsc` refuses a caller that forgets
 *   it; this refuses one that types a number.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectSwaps, topBandOf } from '../../src/core/selector.ts';
import { tokenize } from '../../src/core/tokenize.ts';
import { defaultSettings } from '../../src/core/settings.ts';
import type { LexPack } from '../../src/core/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** Settings → Level's chips, by the number each sets. */
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** The text of a page, its markup and scripts left out. */
const pageText = (html: string): string =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ');

const PAGES: Record<string, string> = {
  'README.md': read('README.md'),
  'tests/e2e/pages/article.html': pageText(read('tests/e2e/pages/article.html')),
};

const index = JSON.parse(read('src/lexicon/packs/index.json')) as {
  packs: Array<{ target: string; file: string }>;
};

describe('every level weaves', () => {
  test('there are packs to read', () => {
    assert.ok(index.packs.length >= 7, `only ${index.packs.length} packs were read from index.json`);
  });

  for (const { target, file } of index.packs) {
    test(`from en-${target}, at the ceiling, at every level`, () => {
      const pack = JSON.parse(read(`src/lexicon/packs/${file}`)) as LexPack;
      const settings = defaultSettings(Date.UTC(2026, 10, 8), 'level-reach');
      const lookup = (surface: string) => pack.entries[surface];
      const faults: string[] = [];
      for (const [path, text] of Object.entries(PAGES)) {
        const tokens = tokenize(text);
        for (let level = 1; level <= LEVELS.length; level++) {
          const result = selectSwaps({
            tokens,
            lookup,
            cards: new Map(),
            now: Date.UTC(2026, 10, 8),
            target: pack.meta.target,
            ratio: settings.weave.ceilingRatio,
            settings,
            effectiveLevel: level,
            topBand: topBandOf(pack.meta),
            introducedToday: new Set<string>(),
            pageLemmaCounts: new Map(),
            seed: 1,
          });
          if (!result.swaps.length) {
            faults.push(`${path} at ${LEVELS[level - 1]}: ${result.eligible} eligible, nothing woven`);
          }
        }
      }
      assert.deepEqual(faults, [], `en-${target} weaves nothing at some level:\n${faults.join('\n')}`);
    });
  }
});

describe('every caller hands the selector the pack’s own top band', () => {
  const callers = execFileSync('git', ['grep', '-l', 'selectSwaps(', '--', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path && path !== 'src/core/selector.ts');

  test('there are callers to read', () => {
    assert.ok(callers.length >= 2, `only ${callers.length} callers of selectSwaps() were found under src/`);
  });

  for (const path of callers) {
    test(path, () => {
      const source = read(path);
      const calls = source.split('selectSwaps(').slice(1).map((rest) => rest.slice(0, rest.indexOf('});')));
      assert.ok(calls.length > 0, `${path} names selectSwaps but no call was read`);
      for (const call of calls) {
        assert.match(call, /\btopBand:\s*topBandOf\(/, `${path} calls selectSwaps() without topBand: topBandOf(…)`);
      }
    });
  }
});
