/**
 * Fold `tools/seed/fr-cousins.tsv` into the `etymon` and `note` columns of
 * `tools/seed/lex-fr.tsv`, and say exactly what did not fold.
 *
 * The two files are kept apart on purpose — the reasoning is at the top of
 * `tools/merge-cousins.mjs` — which makes those two columns of `lex-fr.tsv`
 * *generated*. Measured on 2026-09-30, all 118 values in them came from
 * `fr-cousins.tsv` and none was written by hand. A generated file needs the
 * one property the packs have: merging again changes nothing, so a
 * committed lexicon that is not a fixed point of this function has an edit
 * to the review file that never reached the product.
 *
 * Every field a claim could touch lands in exactly one bucket:
 *
 *   - **in step** — the lexicon already says what the claim says;
 *   - **added** — the field was empty and takes the claim. Always applied;
 *   - **disagree** — the field holds something else. That is a corrected
 *     claim, or a hand edit to a generated column, and which of the two is
 *     right is a question for a person — so it is applied only with `force`;
 *   - **unclaimed** — the field holds a value `fr-cousins.tsv` does not
 *     claim at all. That is a retracted claim still shipping, or etymology
 *     written into the translation table where a review of `fr-cousins.tsv`
 *     will never see it. Cleared only with `force`.
 *
 * The old merge counted *in step* and *disagree* together, as "left alone
 * (already had a value)", and never looked for *unclaimed* at all. So a
 * correction printed what an untouched tree prints, and a retraction
 * printed nothing.
 *
 * Only a line that changes is rewritten; every other line comes back byte
 * for byte, so a merge with nothing to do leaves `git status` clean.
 *
 * TypeScript rather than more `tools/*.mjs`, for the reason `tools/
 * sitemap.ts` records: `tsc` rejects a `.mjs` import from a `.ts` test with
 * TS7016, so a `.mjs` module could only be tested through the CLI.
 */

export type Kind = 'descent' | 'cousin';

/** `lex-fr.tsv` columns, 0-based: lemma pos tgt tgt2 gender ipa etymon note. */
const COLUMN: Record<Kind, number> = { descent: 6, cousin: 7 };
const KINDS = Object.keys(COLUMN) as Kind[];
const FIELDS = 8;

/** One line of `fr-cousins.tsv`. `line` is 1-based. */
export interface Claim {
  lemma: string;
  kind: Kind;
  value: string;
  line: number;
}

/** A line of `fr-cousins.tsv` that cannot ship as written. */
export interface Malformed {
  line: number;
  reason: string;
}

/** One field of one `lex-fr.tsv` row that is not what `fr-cousins.tsv` says. */
export interface Drift {
  lemma: string;
  kind: Kind;
  /** 1-based line in `lex-fr.tsv`. */
  line: number;
  /** What the lexicon carries; `''` when the field is empty. */
  lexicon: string;
  /** What `fr-cousins.tsv` says; `''` when it claims nothing. */
  claim: string;
}

export interface MergeResult {
  /** The lexicon with every change this mode allows applied. */
  text: string;
  /** Fields that already say what their claim says. */
  inStep: number;
  added: Drift[];
  disagree: Drift[];
  unclaimed: Drift[];
  /** Claims whose lemma is on no row, so there is nowhere to put them. */
  unmatched: Claim[];
  malformed: Malformed[];
}

const isData = (line: string) => line.trim() !== '' && !line.startsWith('#');

/**
 * Every claim, and every line that cannot be one. A line is refused rather
 * than skipped, because a skipped claim is one that looks present in the
 * review file and never ships — the failure this module exists to name.
 */
export function parseCousins(text: string): { claims: Claim[]; malformed: Malformed[] } {
  const claims: Claim[] = [];
  const malformed: Malformed[] = [];
  const seen = new Set<string>();
  text.split('\n').forEach((raw, i) => {
    if (!isData(raw)) return;
    const line = i + 1;
    const fields = raw.split('\t').map((f) => f.trim());
    if (fields.length !== 3) {
      malformed.push({ line, reason: `expected 3 tab-separated fields, found ${fields.length}` });
      return;
    }
    const [lemma = '', kind = '', value = ''] = fields;
    if (!lemma || !value) {
      malformed.push({ line, reason: 'a field is empty' });
      return;
    }
    if (!(KINDS as string[]).includes(kind)) {
      malformed.push({ line, reason: `"${kind}" is not a kind; expected ${KINDS.join(' or ')}` });
      return;
    }
    const key = `${lemma}\t${kind}`;
    if (seen.has(key)) {
      malformed.push({ line, reason: `a second ${kind} claim for "${lemma}"; only the first can ship` });
      return;
    }
    seen.add(key);
    claims.push({ lemma, kind: kind as Kind, value, line });
  });
  return { claims, malformed };
}

export function mergeCousins(lexicon: string, cousins: string, { force = false } = {}): MergeResult {
  const { claims, malformed } = parseCousins(cousins);
  const wanted = new Map(claims.map((c) => [`${c.lemma}\t${c.kind}`, c]));
  const lemmas = new Set<string>();
  const result: MergeResult = { text: '', inStep: 0, added: [], disagree: [], unclaimed: [], unmatched: [], malformed };

  const lines = lexicon.split('\n').map((raw, i) => {
    if (!isData(raw)) return raw;
    const cols = raw.split('\t');
    const lemma = (cols[0] ?? '').trim();
    lemmas.add(lemma);

    const writes: Array<[number, string]> = [];
    for (const kind of KINDS) {
      const have = cols[COLUMN[kind]] ?? '';
      const want = wanted.get(`${lemma}\t${kind}`)?.value ?? '';
      if (have === want) {
        if (want) result.inStep++;
        continue;
      }
      const drift: Drift = { lemma, kind, line: i + 1, lexicon: have, claim: want };
      if (!have) result.added.push(drift);
      else if (want) result.disagree.push(drift);
      else result.unclaimed.push(drift);
      if (!have || force) writes.push([COLUMN[kind], want]);
    }

    if (!writes.length) return raw;
    while (cols.length < FIELDS) cols.push('');
    for (const [col, value] of writes) cols[col] = value;
    return cols.join('\t');
  });

  result.text = lines.join('\n');
  result.unmatched = claims.filter((c) => !lemmas.has(c.lemma));
  return result;
}
