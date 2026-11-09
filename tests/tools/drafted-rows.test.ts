/**
 * A row a machine drafted is woven, and says so.
 *
 * `tools/seed/wiktionary/draft.py` appends rows read off English Wiktionary
 * with `decided_by` wiktionary and `status` proposed: nobody has read them
 * yet. The owner chose on 2026-11-09 to weave them, labelled. So every entry
 * a proposed row builds carries `drafted`, which the tooltip prints as
 * "Wiktionary, unreviewed", no checked entry carries it, and each pack counts
 * its drafted lemmas in `meta.draftedCount`. A person confirming a row sets
 * its status, and the label goes with the next `npm run packs`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const LANGS = ['fr', 'es', 'de', 'it', 'pt', 'la', 'ang'];

/** The lemma and part of speech of each proposed row, read from the seed's status column. */
function proposed(lang: string): Set<string> {
  const rows = readFileSync(join(ROOT, `tools/seed/lex-${lang}.tsv`), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.split('\t'));
  return new Set(rows.filter((c) => c[10] === 'proposed' && c[2]).map((c) => `${c[0]}\t${c[1]}`));
}

interface Entry {
  src: string;
  lemma: string;
  pos: string;
  drafted?: boolean;
}

describe('a drafted row is woven, flagged and counted', () => {
  test('every entry a proposed row builds says drafted, and no checked entry does', () => {
    let read = 0;
    for (const lang of LANGS) {
      const pack = JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8'));
      const want = proposed(lang);
      const wrong: string[] = [];
      for (const list of Object.values(pack.entries) as Entry[][]) {
        for (const e of list) {
          read++;
          if (want.has(`${e.lemma}\t${e.pos}`) !== Boolean(e.drafted)) wrong.push(`${lang} ${e.src} (${e.lemma}, ${e.pos})`);
        }
      }
      assert.deepEqual(wrong, [], `${lang}: an entry whose drafted flag disagrees with its seed row`);
      assert.equal(pack.meta.draftedCount ?? 0, want.size, `${lang}: meta.draftedCount is not the seed's proposed rows`);
    }
    assert.ok(read > 4000, `only ${read} entries were read`);
  });
});
