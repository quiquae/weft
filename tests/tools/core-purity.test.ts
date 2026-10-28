/**
 * `src/core/` is pure: no DOM, no `chrome.*`, no I/O. `CLAUDE.md` lists it
 * among the things never touched, because it is why the unit suite runs
 * without a browser and why the site builder, the pack builder and the
 * package validator can import core under plain Node. Until 2026-10-26
 * nothing held it, and `tsc` cannot: `tsconfig.json` gives every file the
 * DOM library and the chrome types, so `document.title` typed into
 * `src/core/selector.ts` type-checks, builds and ships.
 *
 * So the checker is asked where each name core uses is declared. A global
 * ECMAScript defines passes. One that only a browser's library, the chrome
 * types or Node's types declare fails, unless `PLATFORM` names it with why;
 * and a name `PLATFORM` allows must be declared by a browser's library, since
 * core runs in one, and — where core uses it as a value rather than a type,
 * which the build erases — by Node's too, since core is tested there. Imports
 * are held to `src/core/` itself, so purity cannot be borrowed from a module
 * that does not have it.
 *
 * The clock and the dice are refused too, though ECMAScript has both: every
 * interesting decision in core is a function of its arguments, so `Date.now()`,
 * an argument-less `new Date()`, `Date()` and `Math.random()` are the caller's
 * to read. A timer or `performance` is a platform global, which the name check
 * already refuses; `crypto.getRandomValues` is `PLATFORM`'s, for an install id.
 *
 * The check reads names, so it is a guard against reaching for the browser by
 * habit, not against hiding it: `globalThis['chrome']` names no identifier.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CORE = join(ROOT, 'src/core');

/**
 * The platform APIs core may use, and what it uses each for. A licence is
 * verified locally and the state is sealed in core, so the unit suite can
 * verify a real one; that needs WebCrypto and the bytes it signs.
 */
const PLATFORM: Record<string, string> = {
  crypto: 'WebCrypto: a licence’s ECDSA signature, the state’s HMAC seal, a random install id',
  CryptoKey: 'a WebCrypto key, as a type',
  JsonWebKey: 'the publisher key’s form, as a type',
  TextEncoder: 'the Encoding API: text to the bytes WebCrypto signs',
  TextDecoder: 'the Encoding API: a licence’s payload back to text',
  atob: 'base64: a licence file’s fields',
  btoa: 'base64: a licence file’s fields and the state’s seal',
  URL: 'the WHATWG URL parser: a site rule is matched against a page’s address',
};

type Origin = 'ECMAScript' | 'a browser' | 'chrome' | 'Node' | 'core' | 'elsewhere';

interface Use {
  /** Where, as `src/core/<file>:<line>`. */
  at: string;
  name: string;
  /** Every library that declares the name as a global. */
  from: Origin[];
  /** False where the build erases it: inside a type. */
  value: boolean;
}

function originOf(fileName: string): Origin {
  const lib = /\/node_modules\/typescript\/lib\/(lib\.[^/]+\.d\.ts)$/.exec(fileName);
  if (lib) return /^lib\.(es|decorators)/.test(lib[1] ?? '') ? 'ECMAScript' : 'a browser';
  if (fileName.includes('/node_modules/@types/chrome/')) return 'chrome';
  if (fileName.includes('/node_modules/@types/node/')) return 'Node';
  if (fileName.startsWith(`${CORE}/`)) return 'core';
  return 'elsewhere';
}

/**
 * Whether a declaration puts its name in the global scope: at the top of a
 * script, in a namespace there (`chrome.runtime`), or in `declare global`. Not
 * a member of an interface, class, type or object, and not inside
 * `declare module 'crypto'`, which is a module's.
 */
function isGlobal(decl: ts.Declaration): boolean {
  for (let n: ts.Node | undefined = decl.parent; n; n = n.parent) {
    if (ts.isModuleDeclaration(n)) {
      if (n.flags & ts.NodeFlags.GlobalAugmentation) return true;
      if (ts.isStringLiteral(n.name)) return false;
    } else if (ts.isSourceFile(n)) {
      return !ts.isExternalModule(n);
    } else if (
      ts.isInterfaceDeclaration(n) ||
      ts.isClassLike(n) ||
      ts.isTypeLiteralNode(n) ||
      ts.isEnumDeclaration(n) ||
      ts.isObjectLiteralExpression(n) ||
      ts.isFunctionLike(n) ||
      ts.isBlock(n)
    ) {
      return false;
    }
  }
  return false;
}

/** The libraries that declare what a name resolves to, or null for ECMAScript's or a file's own. */
function libraryOrigins(node: ts.Identifier): Origin[] | null {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const globals = (symbol?.declarations ?? []).filter(isGlobal);
  if (globals.length === 0) return null;
  const from = [...new Set(globals.map((d) => originOf(d.getSourceFile().fileName)))].sort();
  return from.includes('ECMAScript') || from.includes('core') ? null : from;
}

/** A property's name is its object's business, unless the object is the global one. */
function reportable(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return ts.isIdentifier(parent.expression) && parent.expression.text === 'globalThis';
  }
  return !(ts.isQualifiedName(parent) && parent.right === node);
}

/** Whether the build erases a name: inside a type, but not a class's `extends`, which runs. */
function erased(node: ts.Node): boolean {
  for (let n = node; n.parent; n = n.parent) {
    const p = n.parent;
    if (
      ts.isExpressionWithTypeArguments(p) &&
      ts.isHeritageClause(p.parent) &&
      p.parent.token === ts.SyntaxKind.ExtendsKeyword &&
      ts.isClassLike(p.parent.parent)
    ) {
      return false;
    }
    if (ts.isTypeNode(p)) return true;
  }
  return false;
}

let identifiersRead = 0;

/** Every name a file uses that no ECMAScript library declares as a global. */
function libraryUses(file: ts.SourceFile): Use[] {
  const found: Use[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      identifiersRead++;
      const from = reportable(node) ? libraryOrigins(node) : null;
      if (from) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        found.push({ at: `${relative(ROOT, file.fileName)}:${line}`, name: node.text, from, value: !erased(node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Every module a file names, as written, with its line. */
function modulesNamed(file: ts.SourceFile): { line: number; name: string }[] {
  const named: { line: number; name: string }[] = [];
  const add = (node: ts.Node, spec: ts.Node | undefined): void => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    named.push({ line, name: spec && ts.isStringLiteralLike(spec) ? spec.text : 'a computed name' });
  };
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      add(node, node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node, node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      add(node, node.arguments[0]);
    } else if (ts.isImportTypeNode(node)) {
      add(node, ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return named;
}

/** The modules a core file names that are not core's own. */
function outsideCore(file: ts.SourceFile): string[] {
  return modulesNamed(file)
    .filter(({ name }) => !/^\.\.?\//.test(name) || !join(dirname(file.fileName), name).startsWith(`${CORE}/`))
    .map(({ line, name }) => `${relative(ROOT, file.fileName)}:${line} ${name}`);
}

/** Whether an expression is ECMAScript's own global of that name, not a local that shadows it. */
function isEcmaGlobal(node: ts.Expression, name: string): boolean {
  if (!ts.isIdentifier(node) || node.text !== name) return false;
  const declarations = checker.getSymbolAtLocation(node)?.declarations ?? [];
  return declarations.some((d) => originOf(d.getSourceFile().fileName) === 'ECMAScript');
}

/** The member a property access names, `Date.now` or `Date['now']`, or null. */
function member(node: ts.Node): { object: ts.Expression; name: string } | null {
  if (ts.isPropertyAccessExpression(node)) return { object: node.expression, name: node.name.text };
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    return { object: node.expression, name: node.argumentExpression.text };
  }
  return null;
}

/** Where core reads the clock or the dice, as `src/core/<file>:<line>` and what it wrote. */
function clockReads(file: ts.SourceFile): { at: string; what: string }[] {
  const found: { at: string; what: string }[] = [];
  const add = (node: ts.Node, what: string): void => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    found.push({ at: `${relative(ROOT, file.fileName)}:${line}`, what });
  };
  const visit = (node: ts.Node): void => {
    const m = member(node);
    // A reference counts as well as a call: `clock = Date.now` reads the clock
    // the moment anyone calls it, which is no later than core's own code would.
    const called = (): string => (ts.isCallExpression(node.parent) && node.parent.expression === node ? '()' : '');
    if (m && m.name === 'now' && isEcmaGlobal(m.object, 'Date')) add(node, `Date.now${called()}`);
    else if (m && m.name === 'random' && isEcmaGlobal(m.object, 'Math')) add(node, `Math.random${called()}`);
    else if (ts.isNewExpression(node) && isEcmaGlobal(node.expression, 'Date') && !node.arguments?.length) {
      add(node, node.arguments ? 'new Date()' : 'new Date');
    } else if (ts.isCallExpression(node) && isEcmaGlobal(node.expression, 'Date')) {
      // Called without `new`, Date ignores its arguments and returns the time now, as a string.
      add(node, 'Date()');
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/* ------------------------------------------------------------ the program */

/**
 * A core file that is never on disk, so the check is shown to fire every time
 * it runs rather than once on the day it was written.
 */
const PROBE = join(CORE, '__purity-probe__.ts');
const PROBE_TEXT = `
// chrome.storage.sync is named in this comment, and in a string below.
export const title = document.title;
export const id = chrome.runtime.id;
export const home = process.env.HOME;
export const bytes = Buffer.from('x');
export const later = setTimeout(() => undefined, 1);
export const page = fetch('/');
export const store = globalThis.localStorage;
export let element: HTMLElement | undefined;
export class Bus extends EventTarget {}
export const seal = crypto.randomUUID();
export const noise = crypto.getRandomValues(new Uint8Array(4));
export const larger = Math.max(1, 2);
// Date.now() and Math.random() are named in this comment, and in a string below.
export const stamp = Date.now();
export const today = new Date();
export const bare = new Date;
export const told = Date();
export const dice = Math.random();
export const clock = Date.now;
export const epoch = new Date(0);
export const utc = Date.UTC(2026, 9, 26);
export const spelt = 'Date.now() and Math.random()';
export const held = (Date: { now(): number }) => Date.now();
export const quoted = 'chrome.storage.sync';
const window = { document: 1 };
export const shadowed = window.document;
`;

const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  },
});
if (!config) throw new Error('tsconfig.json did not parse');

const host = ts.createCompilerHost(config.options, true);
const readSource = host.getSourceFile.bind(host);
host.getSourceFile = (name, version, ...rest) =>
  name === PROBE ? ts.createSourceFile(name, PROBE_TEXT, version, true) : readSource(name, version, ...rest);

const files = (readdirSync(CORE, { recursive: true }) as string[])
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(CORE, f))
  .sort();
const program = ts.createProgram([...files, PROBE], config.options, host);
const checker = program.getTypeChecker();

function source(name: string): ts.SourceFile {
  const file = program.getSourceFile(name);
  if (!file) throw new Error(`${relative(ROOT, name)} is not in the program`);
  return file;
}

const uses = files.flatMap((f) => libraryUses(source(f)));

/* ------------------------------------------------------------ the tests */

describe('the purity check', () => {
  test('finds a browser, chrome or Node global wherever a core file reaches for one', () => {
    // Not `runtime` or `id` after `chrome`, which are chrome's business; not
    // `Math`, which is ECMAScript's; not the comment, the string, or the local
    // `window` and its property, which are the file's own.
    assert.deepEqual(
      libraryUses(source(PROBE)).map((u) => [u.name, u.value]),
      [
        ['document', true],
        ['chrome', true],
        ['process', true],
        ['Buffer', true],
        ['setTimeout', true],
        ['fetch', true],
        ['localStorage', true],
        ['HTMLElement', false],
        ['EventTarget', true],
        ['crypto', true],
        ['crypto', true],
      ],
    );
  });

  test('says which library declares each', () => {
    const from = Object.fromEntries(libraryUses(source(PROBE)).map((u) => [u.name, u.from]));
    assert.deepEqual(from.document, ['a browser']);
    assert.deepEqual(from.chrome, ['chrome']);
    assert.deepEqual(from.process, ['Node']);
    assert.deepEqual(from.fetch, ['Node', 'a browser']);
  });

  test('refuses a module from outside src/core/, and only those', () => {
    const text = [
      "import { spelling } from './lexicon.ts';",
      "import { loadCards } from '../background/storage.ts';",
      "import type { Message } from '../shared/messages.ts';",
      "import { readFileSync } from 'node:fs';",
      "export * from 'preact';",
      "export { review } from './fsrs.ts';",
      "const theme = await import('../ui/theme.ts');",
      "const name = 'x'; const later = await import(name);",
      "type Tip = import('../content/tooltip.ts').Tip;",
      "import packs = require('../lexicon/packs/index.json');",
      "import './../background/index.ts';",
    ].join('\n');
    const file = ts.createSourceFile(join(CORE, 'imports.ts'), text, ts.ScriptTarget.ES2022, true);
    assert.deepEqual(outsideCore(file), [
      'src/core/imports.ts:2 ../background/storage.ts',
      'src/core/imports.ts:3 ../shared/messages.ts',
      'src/core/imports.ts:4 node:fs',
      'src/core/imports.ts:5 preact',
      'src/core/imports.ts:7 ../ui/theme.ts',
      'src/core/imports.ts:8 a computed name',
      'src/core/imports.ts:9 ../content/tooltip.ts',
      'src/core/imports.ts:10 ../lexicon/packs/index.json',
      'src/core/imports.ts:11 ./../background/index.ts',
    ]);
  });

  test('finds every read of the clock and the dice, and nothing that only looks like one', () => {
    // Not `new Date(0)` or `Date.UTC`, which are arithmetic on an instant the
    // caller gave; not `crypto.getRandomValues`, which PLATFORM allows; not the
    // comment, the string, or a parameter named `Date`, which is the file's own.
    assert.deepEqual(
      clockReads(source(PROBE)).map((r) => r.what),
      ['Date.now()', 'new Date()', 'new Date', 'Date()', 'Math.random()', 'Date.now'],
    );
  });
});

describe('src/core/', () => {
  test('imports nothing from outside itself', () => {
    assert.deepEqual(
      files.flatMap((f) => outsideCore(source(f))),
      [],
      'src/core/ is pure, so it may import only from src/core/: a module from anywhere else brings what it reaches for with it',
    );
  });

  test('names no global ECMAScript lacks but the platform APIs PLATFORM allows', () => {
    // A floor, so an empty directory or a checker that resolves nothing cannot
    // pass for a pure one.
    assert.ok(files.length >= 25, `only ${files.length} files were found in src/core/`);
    assert.ok(identifiersRead >= 5_000, `only ${identifiersRead} names were read in src/core/`);
    assert.deepEqual(
      uses.filter((u) => !Object.hasOwn(PLATFORM, u.name)).map((u) => `${u.at} ${u.name}, from ${u.from.join(' and ')}`),
      [],
      'src/core/ is pure: no DOM, no chrome.*, no I/O (CLAUDE.md). Have the caller pass the value in; ' +
        'or, for an API in every browser Weft ships to and in Node, name it in PLATFORM with why',
    );
  });

  test('may use a platform API only where a browser has it, and Node too for a value', () => {
    const problems: string[] = [];
    for (const name of Object.keys(PLATFORM)) {
      const mine = uses.filter((u) => u.name === name);
      const from = new Set(mine.flatMap((u) => u.from));
      const value = mine.find((u) => u.value);
      if (mine.length === 0) problems.push(`${name}: core no longer uses it, so PLATFORM should not allow it`);
      else if (!from.has('a browser')) problems.push(`${name}: no browser's library declares it, and core runs in a browser`);
      else if (value && !from.has('Node')) {
        problems.push(`${name}: used as a value at ${value.at}, and Node declares no ${name}, so the unit suite could not run it`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('reads neither the clock nor the dice: the instant is an argument', () => {
    assert.deepEqual(
      files.flatMap((f) => clockReads(source(f))).map((r) => `${r.at} ${r.what}`),
      [],
      'every interesting decision in src/core/ is a function of its arguments (CLAUDE.md): ' +
        'take the instant as `now` from the caller, who reads the clock once; and randomness ' +
        'from crypto.getRandomValues, which PLATFORM allows',
    );
  });
});
