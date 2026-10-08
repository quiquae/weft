#!/usr/bin/env node
/**
 * Build lexicon packs from the curated seed lexicons.
 *
 * Joins tools/seed/english-core.tsv (the source side: frequency, band, sense
 * count, irregular inflections) with tools/seed/lex-<lang>.tsv (translations)
 * and emits src/lexicon/packs/en-<lang>.json in the shape the content script
 * reads: pre-grouped by lowercased source surface form, so a page can start
 * weaving in the same tick the pack lands with zero post-parse index building.
 *
 * Usage:
 *   node tools/build-pack.mjs --all
 *   node tools/build-pack.mjs --lang=fr --lang=la
 *   node tools/build-pack.mjs --all --strict     # fail on any warning
 *   node tools/build-pack.mjs --all --out=/tmp/p  # build somewhere else
 *
 * A rebuild that produces the same content rewrites the same bytes: each
 * pack's `builtAt` is kept unless something else about that pack changed. See
 * writeStamped() for why that matters.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spelling } from '../src/core/lexicon.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'tools/seed');

const PACK_FORMAT = 1;
const PACK_VERSION = '2026.09.1';

const args = process.argv.slice(2);
const wantAll = args.includes('--all');
const strict = args.includes('--strict');
const wantLangs = args
  .filter((a) => a.startsWith('--lang='))
  .map((a) => a.slice('--lang='.length));
const outArg = args.find((a) => a.startsWith('--out='));

// Where the packs land. Overridable so a test can build into a temporary
// directory instead of the tracked src/lexicon/packs/.
const OUT = outArg ? resolve(outArg.slice('--out='.length)) : join(ROOT, 'src/lexicon/packs');

const ATTRIBUTION = [
  'Curated core lexicon: Weft contributors, CC BY-SA 4.0.',
  'English frequency bands derived from SUBTLEX-US via the wordfreq project (Brysbaert et al.); SUBTLEX is distributed under terms equivalent to CC BY-SA.',
  'Latin glosses checked against Lewis & Short, A Latin Dictionary (1879, public domain) and Whitaker’s Words (public domain).',
  'Old English glosses checked against Bosworth–Toller, An Anglo-Saxon Dictionary (1898, public domain) and Clark Hall, A Concise Anglo-Saxon Dictionary (1894, public domain).',
];
const LICENSE = 'CC-BY-SA-4.0';

/* ------------------------------------------------------------------- input */

function parseTsv(text, columns, file) {
  const rows = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === undefined) continue;
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length > columns.length) {
      throw new Error(`${file}:${i + 1}: ${parts.length} columns, expected at most ${columns.length}\n  ${line}`);
    }
    const row = { __line: i + 1 };
    for (let c = 0; c < columns.length; c++) {
      row[columns[c]] = (parts[c] ?? '').trim();
    }
    rows.push(row);
  }
  return rows;
}

const CORE_COLUMNS = ['lemma', 'pos', 'zipf', 'band', 'senses', 'plural', 'gerund'];
// ipa2 is the transcription of tgt2, and last so that every reader of the
// first eight columns by position reads them where they always were.
const LEX_COLUMNS = ['lemma', 'pos', 'tgt', 'tgt2', 'gender', 'ipa', 'etymon', 'note', 'ipa2'];

const VALID_POS = new Set(['noun', 'verb', 'adj', 'adv', 'num', 'intj']);
const VALID_GENDER = new Set(['m', 'f', 'n', 'c', '']);

/* ------------------------------------------------- English inflection rules */

/**
 * Irregular English forms the rules below would get wrong. The seed files can
 * override any of these, but having them here means a contributor who forgets
 * the `plural` column for "child" gets "children" rather than "childs".
 */
const IRREGULAR_PLURALS = {
  child: 'children', man: 'men', woman: 'women', person: 'people', tooth: 'teeth',
  foot: 'feet', goose: 'geese', mouse: 'mice', louse: 'lice', ox: 'oxen',
  life: 'lives', wife: 'wives', knife: 'knives', leaf: 'leaves', loaf: 'loaves',
  thief: 'thieves', wolf: 'wolves', shelf: 'shelves', half: 'halves', calf: 'calves',
  self: 'selves', elf: 'elves', sheep: 'sheep', fish: 'fish', deer: 'deer',
  series: 'series', species: 'species', means: 'means',
};

const NO_PLURAL = new Set([
  'water', 'bread', 'milk', 'wine', 'gold', 'silver', 'iron', 'sand', 'snow', 'ice',
  'rain', 'air', 'fire', 'blood', 'music', 'money', 'love', 'peace', 'truth',
  'knowledge', 'advice', 'news', 'work', 'weather', 'furniture', 'luggage',
  'information', 'health', 'wealth', 'darkness', 'light', 'salt', 'sugar', 'rice',
  'cheese', 'butter', 'meat', 'grass', 'wood', 'dust', 'smoke', 'time', 'death',
  'life', 'hunger', 'thirst', 'sleep', 'youth', 'age', 'freedom', 'courage', 'wisdom',
]);

function englishPlural(lemma, explicit) {
  if (explicit) return explicit;
  if (NO_PLURAL.has(lemma)) return null;
  if (IRREGULAR_PLURALS[lemma]) return IRREGULAR_PLURALS[lemma];
  if (/(?:s|x|z|ch|sh)$/.test(lemma)) return `${lemma}es`;
  if (/[^aeiou]y$/.test(lemma)) return `${lemma.slice(0, -1)}ies`;
  return `${lemma}s`;
}

const IRREGULAR_GERUNDS = {
  lie: 'lying', die: 'dying', tie: 'tying', be: 'being', see: 'seeing', flee: 'fleeing',
  run: 'running', sit: 'sitting', get: 'getting', put: 'putting', cut: 'cutting',
  set: 'setting', let: 'letting', hit: 'hitting', shut: 'shutting', stop: 'stopping',
  drop: 'dropping', swim: 'swimming', begin: 'beginning', win: 'winning', spin: 'spinning',
  plan: 'planning', travel: 'travelling', forget: 'forgetting', permit: 'permitting',
  refer: 'referring', prefer: 'preferring', occur: 'occurring', control: 'controlling',
};

function englishGerund(lemma, explicit) {
  if (explicit) return explicit;
  if (IRREGULAR_GERUNDS[lemma]) return IRREGULAR_GERUNDS[lemma];
  if (/ie$/.test(lemma)) return `${lemma.slice(0, -2)}ying`;
  if (/[^aeiou]e$/.test(lemma)) return `${lemma.slice(0, -1)}ing`;
  // Consonant-vowel-consonant in a short word doubles the final consonant.
  // Restricted to <= 4 letters so multisyllabic verbs must be listed explicitly
  // rather than silently mangled ("visit" must not become "visitting").
  if (lemma.length <= 4 && /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(lemma)) {
    return `${lemma}${lemma.slice(-1)}ing`;
  }
  return `${lemma}ing`;
}

/* ------------------------------------------------------------ confidence */

/**
 * Confidence that this mapping is right for this surface form in arbitrary
 * context. Curated rows start high; polysemy and imperfect grammatical fit
 * pull it down. The selector treats confidence as a multiplicative gate, so a
 * low value here cannot be rescued by the word being a nice cognate.
 */
function confidenceFor(pos, senses, formKind) {
  let conf = 0.96;
  conf -= 0.04 * Math.max(0, senses - 1);
  // A verb woven as a bare infinitive inside an English clause is understood
  // but not grammatical; a participle for "-ing" fits better.
  if (pos === 'verb' && formKind === 'base') conf -= 0.06;
  if (pos === 'verb' && formKind === 'gerund') conf -= 0.02;
  return Math.max(0.55, Math.round(conf * 100) / 100);
}

/* ------------------------------------------------------------------ build */

const warnings = [];
const warn = (msg) => warnings.push(msg);

async function loadCore() {
  const file = join(SEED, 'english-core.tsv');
  const rows = parseTsv(await readFile(file, 'utf8'), CORE_COLUMNS, 'english-core.tsv');
  const byLemma = new Map();

  for (const row of rows) {
    if (!row.lemma) throw new Error(`english-core.tsv:${row.__line}: empty lemma`);
    // Keyed on lemma AND part of speech: "work" the noun and "work" the verb
    // are different words with different translations, and conflating them
    // would weave "travail" where "travailler" belongs.
    const key = `${row.lemma}\t${row.pos}`;
    if (byLemma.has(key)) {
      throw new Error(`english-core.tsv:${row.__line}: duplicate "${row.lemma}" (${row.pos})`);
    }
    if (!VALID_POS.has(row.pos)) {
      throw new Error(`english-core.tsv:${row.__line}: bad pos "${row.pos}" for "${row.lemma}"`);
    }
    const zipf = Number(row.zipf);
    const band = Number(row.band);
    const senses = Number(row.senses || '1');
    if (!(zipf >= 1 && zipf <= 7.5)) {
      throw new Error(`english-core.tsv:${row.__line}: zipf ${row.zipf} out of range for "${row.lemma}"`);
    }
    if (!Number.isInteger(band) || band < 1 || band > 6) {
      throw new Error(`english-core.tsv:${row.__line}: band ${row.band} out of range for "${row.lemma}"`);
    }
    if (!Number.isInteger(senses) || senses < 1) {
      throw new Error(`english-core.tsv:${row.__line}: senses ${row.senses} invalid for "${row.lemma}"`);
    }
    byLemma.set(key, { ...row, zipf, band, senses });
  }
  return byLemma;
}

async function buildPack(lang, core) {
  const file = join(SEED, `lex-${lang}.tsv`);
  if (!existsSync(file)) throw new Error(`no seed file for "${lang}" at ${file}`);

  const rows = parseTsv(await readFile(file, 'utf8'), LEX_COLUMNS, `lex-${lang}.tsv`);
  const entries = Object.create(null);
  const seenLemmas = new Set();
  let entryCount = 0;
  let translated = 0;

  for (const row of rows) {
    if (!VALID_POS.has(row.pos)) {
      warn(`lex-${lang}.tsv:${row.__line}: bad pos "${row.pos}" for "${row.lemma}"`);
      continue;
    }
    const key = `${row.lemma}\t${row.pos}`;
    const spec = core.get(key);
    if (!spec) {
      warn(`lex-${lang}.tsv:${row.__line}: "${row.lemma}" (${row.pos}) is not in english-core.tsv`);
      continue;
    }
    if (seenLemmas.has(key)) {
      warn(`lex-${lang}.tsv:${row.__line}: duplicate "${row.lemma}" (${row.pos})`);
      continue;
    }
    seenLemmas.add(key);
    if (!row.tgt) continue; // a deliberate "this language has no such word"
    // `hund²` is the second of two words spelled hund. The number is the
    // card's identity and goes into `tgtLemma` as written; the form a reader
    // is shown is the spelling, without it. See `spelling()`.
    const written = spelling(row.tgt);
    if (!VALID_GENDER.has(row.gender)) {
      warn(`lex-${lang}.tsv:${row.__line}: bad gender "${row.gender}" for "${row.lemma}"`);
    }
    if (written === row.lemma) {
      warn(`lex-${lang}.tsv:${row.__line}: "${row.lemma}" maps to itself, will be skipped at runtime`);
    }
    translated++;

    // A transcription is of one spelling: the tooltip prints it under the form
    // a row wove, so the headword's goes on the headword's row and the second
    // form's, ipa2, on the second form's. A second form with no ipa2 prints no
    // sound, which is silence, where the headword's would be a false claim —
    // unless it is spelled as its headword is, Latin diēs beside diēs.
    const ipa2 = row.ipa2 || (row.tgt2 === written ? row.ipa : '');
    const shared = (ipa) => ({
      lemma: row.lemma,
      pos: spec.pos,
      tgtLemma: row.tgt,
      zipf: spec.zipf,
      senses: spec.senses,
      band: spec.band,
      ...(row.gender ? { gender: row.gender } : {}),
      ...(ipa ? { ipa } : {}),
      ...(row.etymon ? { etymonOf: row.etymon } : {}),
      ...(row.note ? { note: row.note } : {}),
    });

    const push = (surface, tgt, ipa, extra) => {
      const key = surface.toLowerCase();
      const entry = { src: key, ...shared(ipa), tgt, ...extra };
      if (!entries[key]) entries[key] = [];
      // Two lemmas can share a surface form ("light" noun and adjective).
      // Keep both; the selector scores them and picks one.
      entries[key].push(entry);
      entryCount++;
    };

    // Citation / base form.
    push(row.lemma, written, row.ipa, {
      conf: confidenceFor(spec.pos, spec.senses, spec.pos === 'verb' ? 'base' : 'base'),
      ...(spec.pos === 'noun' ? { num: 'sg' } : {}),
    });

    // Second form: plural for nouns; for verbs the present participle
    // (French, German) or the gerund (Spanish, Portuguese, Italian).
    if (spec.pos === 'noun') {
      const plural = englishPlural(row.lemma, spec.plural);
      if (plural && row.tgt2) {
        push(plural, row.tgt2, ipa2, {
          conf: confidenceFor('noun', spec.senses, 'plural'),
          num: 'pl',
        });
      } else if (plural && !row.tgt2) {
        // No authored plural: skip rather than invent one. Weaving a singular
        // target under an English plural teaches a wrong form.
        warn(`lex-${lang}.tsv:${row.__line}: no plural for "${row.lemma}" (English "${plural}" will not be woven)`);
      }
    } else if (spec.pos === 'verb' && row.tgt2) {
      const gerund = englishGerund(row.lemma, spec.gerund);
      push(gerund, row.tgt2, ipa2, { conf: confidenceFor('verb', spec.senses, 'gerund') });
    }
  }

  // Report source lemmas this language has not covered, so gaps are visible.
  const missing = [...core.keys()].filter((k) => !seenLemmas.has(k));
  if (missing.length) {
    const names = missing.slice(0, 6).map((k) => k.split('\t').join(' '));
    warn(`lex-${lang}.tsv: ${missing.length} core entries absent (first: ${names.join(', ')})`);
  }

  const bands = [...new Set(Object.values(entries).flat().map((e) => e.band))].sort();

  const pack = {
    meta: {
      source: 'en',
      target: lang,
      format: PACK_FORMAT,
      version: PACK_VERSION,
      entryCount,
      lemmaCount: translated,
      attribution: ATTRIBUTION,
      license: LICENSE,
      bands,
      builtAt: new Date().toISOString().slice(0, 10),
    },
    entries,
  };

  await mkdir(OUT, { recursive: true });
  const path = join(OUT, `en-${lang}.json`);
  await writeStamped(path, pack, (p) => p.meta);
  return { lang, path, entryCount, lemmaCount: translated, bands };
}

/**
 * Write a generated JSON file, keeping the `builtAt` the previous one carried
 * when nothing else about it has changed.
 *
 * `builtAt` is meant to say when the *content* was built. Stamping today on
 * every run made it say when the command last ran, so `npm run packs`
 * rewrote all eight files whether or not a seed lexicon had moved: the setup
 * step in CLAUDE.md left a fresh clone dirty, and `npm run release`, which
 * refuses a dirty tree, refused. Comparing everything except the stamp keeps
 * the date honest and makes a rebuild that changes nothing change nothing —
 * which is also what lets CI assert the committed packs still match the seeds.
 *
 * `stampHolder` returns the object carrying `builtAt`: the pack's `meta`, or
 * the index itself.
 */
async function writeStamped(path, value, stampHolder, indent) {
  const withoutStamp = (obj) => {
    const copy = structuredClone(obj);
    const holder = stampHolder(copy);
    if (holder && typeof holder === 'object') delete holder.builtAt;
    return JSON.stringify(copy);
  };

  let previous = null;
  try {
    previous = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    // No previous file, or one this build cannot read: stamp today.
  }

  if (previous && withoutStamp(previous) === withoutStamp(value)) {
    const kept = stampHolder(previous)?.builtAt;
    if (typeof kept === 'string') stampHolder(value).builtAt = kept;
  }

  await writeFile(path, JSON.stringify(value, null, indent) + '\n');
}

async function writeIndex(results) {
  const index = {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    builtAt: new Date().toISOString().slice(0, 10),
    packs: results
      .map((r) => ({
        source: 'en',
        target: r.lang,
        file: `en-${r.lang}.json`,
        entryCount: r.entryCount,
        lemmaCount: r.lemmaCount,
        bands: r.bands,
      }))
      .sort((a, b) => a.target.localeCompare(b.target)),
  };
  await writeStamped(join(OUT, 'index.json'), index, (i) => i, 2);
}

async function discoverLangs() {
  const files = await readdir(SEED);
  return files
    .filter((f) => /^lex-[a-z]{2,3}\.tsv$/.test(f))
    .map((f) => f.slice('lex-'.length, -'.tsv'.length))
    .sort();
}

async function main() {
  const core = await loadCore();
  const langs = wantLangs.length ? wantLangs : wantAll ? await discoverLangs() : [];
  if (!langs.length) {
    console.error('nothing to do: pass --all or --lang=<code>');
    process.exit(1);
  }

  console.log(`core: ${core.size} English lemmas`);
  const results = [];
  for (const lang of langs) {
    results.push(await buildPack(lang, core));
  }
  await writeIndex(results);

  for (const r of results) {
    const coverage = ((r.lemmaCount / core.size) * 100).toFixed(0);
    console.log(
      `  en-${r.lang.padEnd(4)} ${String(r.lemmaCount).padStart(5)} lemmas  ` +
        `${String(r.entryCount).padStart(5)} surface forms  ${coverage.padStart(3)}% of core  bands ${r.bands.join('')}`,
    );
  }

  if (warnings.length) {
    console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
    for (const w of warnings.slice(0, 40)) console.log(`  ! ${w}`);
    if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`);
    if (strict) {
      console.error('\n--strict: failing on warnings');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(String(err.message ?? err));
  process.exit(1);
});
