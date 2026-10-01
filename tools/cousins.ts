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
 * And a claim that does not cite the entry for every word it names cannot
 * ship at all — not as an addition, and not under `force`. Twenty-nine of
 * the 116 claims this file once held were false, and every one was about a
 * word nobody had looked up; see `sourcesNeeded`.
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
const TGT = 2;

/**
 * A reference to a dictionary entry, short enough to read in a review file:
 *
 *   etym:<english>      https://www.etymonline.com/word/<english>
 *   wikt:fr:<french>    https://en.wiktionary.org/wiki/<french>#French
 *   wikt:en:<english>   https://en.wiktionary.org/wiki/<english>#English
 *   frwikt:<french>     https://fr.wiktionary.org/wiki/<french>
 */
const SOURCE = /^(?:etym|wikt:(?:fr|en)|frwikt):[^\s:]+$/;

/** One line of `fr-cousins.tsv`. `line` is 1-based. */
export interface Claim {
  lemma: string;
  kind: Kind;
  value: string;
  /** The entries the claim was checked against, each matching `SOURCE`. */
  sources: string[];
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
    if (fields.length === 3) {
      const reason = 'cites no sources; add a fourth field naming the entries it was checked against';
      malformed.push({ line, reason });
      return;
    }
    if (fields.length !== 4) {
      const reason = `expected 4 tab-separated fields (lemma, kind, value, sources), found ${fields.length}`;
      malformed.push({ line, reason });
      return;
    }
    const [lemma = '', kind = '', value = '', cited = ''] = fields;
    if (!lemma || !value || !cited) {
      malformed.push({ line, reason: 'a field is empty' });
      return;
    }
    if (!(KINDS as string[]).includes(kind)) {
      malformed.push({ line, reason: `"${kind}" is not a kind; expected ${KINDS.join(' or ')}` });
      return;
    }
    const sources = cited.split(/\s+/);
    const unreadable = sources.filter((s) => !SOURCE.test(s));
    if (unreadable.length) {
      const named = unreadable.map((s) => `"${s}"`).join(', ');
      const kinds = 'etym:<english>, wikt:fr:<french>, wikt:en:<english> or frwikt:<french>';
      malformed.push({ line, reason: `${named} is not an entry reference; expected ${kinds}` });
      return;
    }
    const key = `${lemma}\t${kind}`;
    if (seen.has(key)) {
      malformed.push({ line, reason: `a second ${kind} claim for "${lemma}"; only the first can ship` });
      return;
    }
    seen.add(key);
    claims.push({ lemma, kind: kind as Kind, value, sources, line });
  });
  return { claims, malformed };
}

/** etymonline's address for an English word: lower case, a hyphen for a space. */
const slug = (english: string) => english.toLowerCase().replace(/\s+/g, '-');

/** A descent names its English word in full; a cousin note quotes its English words. */
const englishNamed = (claim: Pick<Claim, 'kind' | 'value'>): string[] =>
  claim.kind === 'descent' ? [claim.value] : [...claim.value.matchAll(/“([^”]+)”/g)].map((m) => m[1] ?? '');

/**
 * The entries a claim has to cite: etymonline for every English word it
 * names, and Wiktionary for every French word it is about — one per row its
 * lemma has, because a claim lands on all of them and has to be true of all
 * of them.
 *
 * Derived from the claim, not listed beside it, because the false claims
 * failed on both sides and in no pattern a list would have predicted:
 * twelve descents whose English word came from somewhere else (`answer` is
 * Old English, `gift` Old Norse), and notes naming the wrong root for the
 * French word (`tête` is *testa*, not *caput*). Looking up both words is
 * the check each of them skipped.
 */
export function sourcesNeeded(claim: Pick<Claim, 'kind' | 'value'>, french: string[]): string[] {
  return [...englishNamed(claim).map((w) => `etym:${slug(w)}`), ...french.map((w) => `wikt:fr:${w}`)];
}

export function mergeCousins(lexicon: string, cousins: string, { force = false } = {}): MergeResult {
  const french = new Map<string, string[]>();
  for (const raw of lexicon.split('\n')) {
    if (!isData(raw)) continue;
    const cols = raw.split('\t');
    const lemma = (cols[0] ?? '').trim();
    const tgt = (cols[TGT] ?? '').trim();
    if (tgt) french.set(lemma, [...(french.get(lemma) ?? []), tgt]);
  }

  // A claim missing an entry is refused before anything is applied, so no
  // flag can carry it into the lexicon.
  const parsed = parseCousins(cousins);
  const malformed = [...parsed.malformed];
  const claims = parsed.claims.filter((c) => {
    const missing = sourcesNeeded(c, french.get(c.lemma) ?? []).filter((s) => !c.sources.includes(s));
    // A note that quotes no English word — it cannot quote “manger” back at
    // a reader of manger — still means one, and names it only by its entry.
    if (!missing.some((s) => s.startsWith('etym:')) && !c.sources.some((s) => s.startsWith('etym:'))) {
      missing.push('etym:<the English word it means>');
    }
    if (missing.length) malformed.push({ line: c.line, reason: `cites no ${missing.join(', ')}` });
    return !missing.length;
  });
  malformed.sort((a, b) => a.line - b.line);

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
