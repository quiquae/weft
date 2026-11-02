/**
 * Nothing is synced, as the privacy page says.
 *
 * Until 2026-11-02 `docs/PRIVACY.md`, which the site publishes as `/privacy`
 * and every store's form links to, described a settings sync: "Turning it on
 * uses `chrome.storage.sync`". `src/` has never had one — no call, and no
 * control that reads `privacy.syncSettings`. The page says now that Weft never
 * uses `chrome.storage.sync`, and this holds the sentence to the code.
 *
 * Every file under `src/` is parsed, and an identifier or a string `sync`
 * anywhere in its tree is refused, because that is how each spelling of the
 * call is written: `api.storage.sync`, `api.storage['sync']`,
 * `api.storage?.sync` and `const { sync } = api.storage`. A comment is not
 * part of the tree, and `syncSettings` is another identifier. Building sync
 * means rewriting the page in the same change, with `LOCAL_ONLY_PATHS` left
 * behind as `src/core/settings.ts` says, and the failure says so.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'src');
const PAGE = 'docs/PRIVACY.md';
const CLAIM = 'Weft never uses `chrome.storage.sync`';

/** Each place `text` names `sync` in code, as `file:line`. */
function syncReferences(file: string, text: string): string[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const named =
      (ts.isIdentifier(node) && node.text === 'sync') ||
      (ts.isStringLiteralLike(node) && node.text === 'sync');
    if (named) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      found.push(`${file}:${line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.tsx?$/.test(name))
  .map((name) => join(SRC, name));

describe('the privacy page’s word on sync', () => {
  test('the page says nothing is synced', () => {
    const page = readFileSync(join(ROOT, PAGE), 'utf8').replace(/\s+/g, ' ');
    assert.ok(
      page.includes(CLAIM),
      `${PAGE} no longer says "${CLAIM}": if sync was built on purpose, this test goes with the sentence`,
    );
  });

  test('no file under src/ reaches chrome.storage.sync', () => {
    assert.ok(files.length >= 50, `only ${files.length} source files were read`);
    const found = files.flatMap((file) =>
      syncReferences(relative(ROOT, file), readFileSync(file, 'utf8')),
    );
    assert.deepEqual(
      found,
      [],
      `${PAGE} says "${CLAIM}". Build sync and that page together, leaving LOCAL_ONLY_PATHS behind`,
    );
  });
});

describe('the reader', () => {
  test('sees each way the call is written, and nothing else', () => {
    const probe = [
      "api.storage.sync.get('weft:settings');",
      "const area = api.storage['sync'];",
      'const { sync } = api.storage;',
      'const later = api.storage?.sync;',
      '// chrome.storage.sync, in a comment',
      "const words = 'synced';",
      'const flag = settings.privacy.syncSettings;',
      'async function load(): Promise<void> {}',
    ].join('\n');
    assert.deepEqual(syncReferences('probe.ts', probe), [
      'probe.ts:1',
      'probe.ts:2',
      'probe.ts:3',
      'probe.ts:4',
    ]);
  });
});
