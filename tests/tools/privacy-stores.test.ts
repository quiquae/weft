/**
 * What the privacy page says Weft stores.
 *
 * `docs/PRIVACY.md` is `/privacy`, the URL every store's form takes, and its
 * table headed "What Weft stores, and where" listed six kinds of what `KEYS`
 * in `src/background/storage.ts` writes nine stores of. The licence was one
 * of the three it never mentioned, and a licence carries the name it was
 * issued to and an id, while "What Weft never stores" said "No identifiers
 * beyond a random install id": until 2026-11-06 that was false for every Pro
 * user.
 *
 * So every store is named by a row of the table — the stores read off `KEYS`
 * rather than typed here, `STORES` saying which rows describe each, and no
 * file but the storage layer touching `storage.local`, so a store cannot be
 * written past `KEYS`. The licence's row names every field `LicencePayload`
 * holds, read off the interface; a paragraph saying Weft stores no identifier
 * names what a licence carries; and the table's numbers are the code's. A
 * store or a licence field added later fails until the page says what it
 * keeps.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_TTL_DAYS, MAX_HOSTS } from '../../src/core/prune.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** Which rows of the table say what each store holds. */
const STORES: Record<string, string[]> = {
  'weft:meta': ['Install record'],
  'weft:settings': ['Settings'],
  'weft:lock': ['Pending changes', 'An audit log', 'Commitment record'],
  'weft:attention': ['Attention'],
  'weft:cards': ['Vocabulary'],
  'weft:introduced': ['Words introduced today'],
  'weft:provider-cache': ['Provider cache'],
  'weft:licence': ['Licence'],
  'weft:network': ['Network log'],
};

/** The words the licence's row uses for each field of a licence. */
const LICENCE_FIELDS: Record<string, string> = {
  v: 'format version',
  id: 'its id',
  tier: 'tier',
  name: 'the name it was issued to',
  issued: 'when it was issued',
  expires: 'when it expires',
};

/** Every store Weft writes, read off `KEYS` in the storage layer. */
function storesIn(source: string): string[] {
  const block = /const KEYS = \{([\s\S]*?)\} as const;/.exec(source);
  if (!block) throw new Error('src/background/storage.ts has no `const KEYS = { … } as const`');
  return [...block[1]!.matchAll(/^\s*\w+:\s*'([^']+)',?\s*$/gm)].map((m) => m[1]!);
}

/** Every field of `LicencePayload`, read off the interface. */
function licenceFields(source: string): string[] {
  const block = /export interface LicencePayload \{([\s\S]*?)\n\}/.exec(source);
  if (!block) throw new Error('src/core/licence.ts has no `export interface LicencePayload`');
  return [...block[1]!.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]!);
}

/** The storage table: each row's name and what it says, emphasis and code marks dropped. */
function tableRows(doc: string): Map<string, string> {
  const [, section = ''] = doc.split('## What Weft stores, and where');
  const table = section.split(/\n## /)[0]!;
  const rows = new Map<string, string>();
  for (const line of table.split('\n')) {
    const m = /^\|\s*([^|\s][^|]*?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m && !/^-+$/.test(m[1]!)) rows.set(m[1]!, m[2]!.replace(/[*`]/g, ''));
  }
  return rows;
}

/** A number the code holds in a `const`, read off its source. */
function constIn(file: string, name: string): number {
  const m = new RegExp(`const ${name} = (\\d+);`).exec(read(file));
  if (!m) throw new Error(`${file} has no \`const ${name} = <number>;\``);
  return Number(m[1]);
}

const PRIVACY = read('docs/PRIVACY.md');
const STORAGE = read('src/background/storage.ts');
const KEYS = storesIn(STORAGE);
const FIELDS = licenceFields(read('src/core/licence.ts'));
const ROWS = tableRows(PRIVACY);

describe('what the privacy page says Weft stores', () => {
  test('the stores, the licence and the table are read', () => {
    assert.ok(KEYS.length >= 9, `only ${KEYS.length} stores were read off KEYS: ${KEYS.join(', ')}`);
    assert.ok(FIELDS.includes('name') && FIELDS.includes('id'), `LicencePayload was read as ${FIELDS.join(', ')}`);
    assert.ok(ROWS.size >= 9, `only ${ROWS.size} rows were read off the storage table`);
  });

  test('nothing but the storage layer touches storage, and it writes only what KEYS names', () => {
    const files = execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.tsx?$/.test(f) && f !== 'src/background/storage.ts');
    assert.ok(files.length > 50, `only ${files.length} source files were read`);
    assert.deepEqual(
      files.filter((f) => /\bstorage\s*\.\s*(local|session|sync)\b/.test(read(f))),
      [],
      'a store written outside src/background/storage.ts is a store KEYS, and so this page, cannot see',
    );
    const calls = [...STORAGE.matchAll(/\b(raw(?:<[^>]*>)?|put|remove)\(([^)]*)/g)].filter(
      (m) => !/\bkey: string\b/.test(m[2]!),
    );
    assert.ok(calls.length >= 9, `only ${calls.length} reads and writes were found in the storage layer`);
    assert.deepEqual(
      calls.filter((m) => !m[2]!.trim().startsWith('KEYS.')).map((m) => m[0]),
      [],
      'a read or write the storage layer makes under a key KEYS does not name',
    );
  });

  test('every store Weft writes is named in STORES, and no other', () => {
    assert.deepEqual(
      KEYS.filter((key) => !(key in STORES)),
      [],
      'a store with no row: say in docs/PRIVACY.md what it holds, then name the row in STORES',
    );
    assert.deepEqual(
      Object.keys(STORES).filter((key) => !KEYS.includes(key)),
      [],
      'STORES names a store Weft no longer writes',
    );
  });

  test('every row STORES names is in the table, and every row says what a store holds', () => {
    const named = Object.values(STORES).flat();
    assert.deepEqual(
      named.filter((row) => !ROWS.has(row)),
      [],
      'STORES names a row the storage table does not have',
    );
    assert.deepEqual(
      [...ROWS.keys()].filter((row) => !named.includes(row)),
      [],
      'a row of the storage table that no store answers to',
    );
  });

  test('the licence’s row names everything a licence holds', () => {
    const row = ROWS.get('Licence') ?? '';
    assert.deepEqual(
      FIELDS.filter((field) => !(field in LICENCE_FIELDS)),
      [],
      'LicencePayload has a field LICENCE_FIELDS does not name: say it in the licence’s row',
    );
    assert.deepEqual(
      Object.entries(LICENCE_FIELDS)
        .filter(([field, words]) => FIELDS.includes(field) && !row.includes(words))
        .map(([field, words]) => `${field}: “${words}”`),
      [],
      `the licence’s row does not say so: ${row}`,
    );
    assert.match(row, /sent nowhere/, 'the licence’s row does not say where a licence goes');
  });

  test('a paragraph that says Weft stores no identifier names what a licence carries', () => {
    const paragraphs = PRIVACY.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim());
    const denials = paragraphs.filter((p) => /\bno identifiers?\b/i.test(p));
    assert.ok(denials.length >= 1, 'the privacy page no longer says which identifiers Weft keeps');
    assert.deepEqual(
      denials.filter((p) => !/\blicen[cs]e\b/.test(p) || !p.includes(LICENCE_FIELDS.name!)),
      [],
      'a licence carries the name it was issued to and its id',
    );
  });

  test('the table’s numbers are the code’s', () => {
    const want: Array<[string, number]> = [
      ['Attention', constIn('src/core/escalation.ts', 'MAX_HISTORY')],
      ['Attention', MAX_HOSTS],
      ['Attention', HOST_TTL_DAYS],
      ['An audit log', constIn('src/core/lock.ts', 'LOG_CAP')],
    ];
    assert.deepEqual(
      want
        .filter(([row, n]) => !new RegExp(`\\b${n}\\b`).test(ROWS.get(row) ?? ''))
        .map(([row, n]) => `${row}: ${n}`),
      [],
      'a number the storage table states is not the number the code keeps',
    );
  });
});

describe('the readers', () => {
  test('read a store list, an interface and a table as written', () => {
    assert.deepEqual(storesIn("const KEYS = {\n  a: 'weft:a',\n  b: 'weft:b',\n} as const;"), ['weft:a', 'weft:b']);
    assert.deepEqual(
      licenceFields('export interface LicencePayload {\n  /** x */\n  v: 1;\n  name: string;\n  expires?: number;\n}'),
      ['v', 'name', 'expires'],
    );
    const rows = tableRows('## What Weft stores, and where\n\n| | |\n|---|---|\n| A | `one` **thing** |\n\n## Next\n\n| B | not this |');
    assert.deepEqual([...rows], [['A', 'one thing']]);
  });
});

/**
 * The words the privacy page's account of an export uses for each store an
 * export carries. Until 2026-11-07 it named the settings, the vocabulary and
 * the reading history, and an export also carries the words introduced today
 * and the commitment record, which an import then never reads: a file that
 * is attached to bug reports held two stores the page did not mention.
 */
const EXPORTED: Record<string, string> = {
  'weft:settings': 'settings',
  'weft:cards': 'vocabulary',
  'weft:attention': 'reading history',
  'weft:introduced': 'words introduced today',
  'weft:lock': 'commitment record',
};

/** `KEYS` as written: each property's name and the store it is. */
function keyNames(source: string): Map<string, string> {
  const block = /const KEYS = \{([\s\S]*?)\} as const;/.exec(source);
  if (!block) throw new Error('src/background/storage.ts has no `const KEYS = { … } as const`');
  return new Map([...block[1]!.matchAll(/^\s*(\w+):\s*'([^']+)',?\s*$/gm)].map((m) => [m[1]!, m[2]!]));
}

/** The body of one top-level function in the storage layer. */
function body(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  if (start < 0) throw new Error(`src/background/storage.ts has no \`export async function ${name}\``);
  return source.slice(start, source.indexOf('\n}\n', start));
}

/** Every store `exportAll` writes into the file, by the property it writes it under. */
function exportedStores(source: string): string[] {
  const names = keyNames(source);
  const returned = /return \{([\s\S]*)\};/.exec(body(source, 'exportAll'))?.[1] ?? '';
  return [...returned.matchAll(/^ {4}(\w+)[:,]/gm)].map((m) => names.get(m[1]!)).filter((s): s is string => !!s);
}

/** Every store `importAll` takes from a file, rather than only asking whether it is there. */
function importedStores(source: string): string[] {
  const names = keyNames(source);
  return [...body(source, 'importAll').matchAll(/(?<!carries\w*\()data\['(\w+)'\]/g)]
    .map((m) => names.get(m[1]!))
    .filter((s): s is string => !!s);
}

/** The privacy page's "Your data is yours", as sentences, emphasis and code marks dropped. */
function yourData(doc: string): string {
  const [, section = ''] = doc.split('## Your data is yours');
  return section.split(/\n## /)[0]!.replace(/[*`]/g, '').replace(/\s+/g, ' ');
}

describe('what the privacy page says an export carries', () => {
  const exported = exportedStores(STORAGE);
  const imported = importedStores(STORAGE);
  const section = yourData(PRIVACY);

  test('every store an export carries is named in EXPORTED, and no other', () => {
    assert.ok(exported.length >= 4, `only ${exported.length} stores were read off exportAll`);
    assert.ok(imported.length >= 3, `only ${imported.length} stores were read off importAll`);
    const unnamed = exported.filter((s) => !(s in EXPORTED));
    const stale = Object.keys(EXPORTED).filter((s) => !exported.includes(s));
    assert.deepEqual(unnamed, [], `an export carries ${unnamed.join(', ')}, which EXPORTED gives no words`);
    assert.deepEqual(stale, [], `EXPORTED names ${stale.join(', ')}, which no export carries`);
  });

  test('the sentence that says what an export writes names every store it carries', () => {
    const sentence = /Export writes [^.]*\./.exec(section)?.[0] ?? '';
    assert.ok(sentence, 'no sentence of “Your data is yours” begins “Export writes”');
    const missing = exported.filter((s) => !sentence.toLowerCase().includes(EXPORTED[s]!.toLowerCase()));
    assert.deepEqual(
      missing.map((s) => `${s} (“${EXPORTED[s]}”)`),
      [],
      'the export sentence leaves out stores the file carries',
    );
  });

  test('a store an export carries and an import never reads is said to stay where it is', () => {
    const sentences = section.split(/(?<=[.:;])\s+/);
    const unsaid = exported
      .filter((s) => !imported.includes(s))
      .filter((s) => !sentences.some((t) => t.toLowerCase().includes(EXPORTED[s]!.toLowerCase()) && /\bnever\b/i.test(t)));
    assert.deepEqual(unsaid, [], `nothing says an import never brings back ${unsaid.join(', ')}`);
  });
});
