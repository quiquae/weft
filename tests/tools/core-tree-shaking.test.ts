/**
 * A module in `src/core/` imported for one name brings nothing else with it.
 *
 * esbuild drops a top-level statement nobody reads only when it can prove the
 * statement does nothing, and it cannot prove that of a call, of a `new` it
 * does not know (`new Set([...])` of literals and `new Map()` it does), of a
 * property read, which could be a getter, of a template that interpolates a
 * name, of a spread, or of a `\p{…}` regular expression, which it writes as
 * `new RegExp(…)` for every engine the build targets. Each of those rides
 * into every bundle that imports its module, read or not: a frozen
 * `SENDING_PATHS` put 490 bytes each into `options.js` and `onboarding.js` on
 * 2026-11-03, and the `flatMap` deriving `DEFAULT_EXCLUSIONS` put 1 246 into
 * `options.js` on 2026-11-07, and both were found only because a printed size
 * crossed a kilobyte. A size that does not cross one moves nothing.
 *
 * So esbuild is asked, not a reading of its rules: each core module is bundled
 * as `build.mjs` bundles it, imported for nothing, and whatever is left is what
 * every bundle importing that module carries whether it reads it or not. It
 * must be nothing, unless `MUST_RUN` names the statement with why it has to run
 * wherever its module is imported. A reading of the source for unmarked calls,
 * which this was first queued as, could not see three of the eleven modules
 * this found on 2026-11-07 — a property read, two templates, five regular
 * expressions — and would have asked for a mark on a spread, where a mark does
 * nothing.
 *
 * The cures, in the order to try them: `/* @__PURE__ *\/` before a call or a
 * `new`, which lets esbuild drop it when its value is unread, its arguments
 * being droppable too; `/* @__NO_SIDE_EFFECTS__ *\/` on a helper every call to
 * which is pure; and for what no mark reaches, an arrow called at once with
 * that call marked. A mark is a promise that the call does nothing but return
 * its value, so a mark on a call whose value is thrown away deletes it, and the
 * second suite refuses one.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CORE = join(ROOT, 'src/core');
const BUILD = readFileSync(join(ROOT, 'build.mjs'), 'utf8');

/**
 * What may be left behind, by `src/core/<file>.ts <name>`, and why it must run
 * wherever its module is imported. Empty: nothing in core needs to.
 */
const MUST_RUN: Record<string, string> = {};

/** The engines `build.mjs` targets, which decide what esbuild rewrites. */
const TARGET = [...(/\btarget:\s*\[([^\]]*)\]/.exec(BUILD)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');

/** The names `build.mjs` defines, read off its `define` block. */
const DEFINED = [...(/\bdefine:\s*\{([\s\S]*?)\n\s*\},/.exec(BUILD)?.[1] ?? '').matchAll(/^\s*'?([\w.]+)'?:/gm)].map(
  (m) => m[1] ?? '',
);

/** The production build's value for each build-time name core reads. */
const PRODUCTION: Record<string, string> = {
  __WEFT_LICENCE_KEY__: 'undefined',
};

const files = readdirSync(CORE)
  .filter((f) => f.endsWith('.ts'))
  .sort();

/**
 * A core module that is never on disk, so the check is shown to fire every
 * time it runs, and to agree with esbuild about what it cannot drop.
 */
const PROBE = '__tree-shaking-probe__.ts';
const PROBE_TEXT = `
const LIST = ['a', 'b'];
const KEY = { x: 'abc' };
const BASE = 'https://example.com';
const same = /* @__NO_SIDE_EFFECTS__ */ (m: object) => m;
export const called = LIST.filter((s) => s !== 'a');
export const frozen = Object.freeze([1, 2]);
export const encoder = new TextEncoder();
export const read = KEY.x;
export const url = \`\${BASE}/buy\`;
export const spread = new Set([...LIST, 'c']);
export const letter = /^\\p{Lu}/u;
export const markedCall = /* @__PURE__ */ LIST.filter((s) => s !== 'a');
export const markedFreeze = /* @__PURE__ */ Object.freeze([[/a$/, LIST]]);
export const literalSet = new Set(['a', 'b']);
export const emptyMap = new Map<string, number>();
export const plainPattern = /^[a-z]+$/;
export const helped = { en: same({ a: 1 }) };
export const wrapped = /* @__PURE__ */ (() => new Set([...LIST, /^\\p{Lu}/u.source, KEY.x, \`\${BASE}/buy\`]))();
`;

interface Leftover {
  /** `src/core/<file>.ts <name>`, or the statement's opening if it declares nothing. */
  key: string;
  /** The statement as esbuild left it, on one line. */
  text: string;
}

/** What importing a core module for nothing leaves behind, by the module that declares each statement. */
async function leftBehind(file: string): Promise<Leftover[]> {
  const result = await esbuild.build({
    stdin: { contents: `import './${file}';`, resolveDir: CORE, loader: 'ts', sourcefile: 'entry.ts' },
    // The comment heading each module's code names its file from here.
    absWorkingDir: ROOT,
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: TARGET,
    // The build minifies; the syntax half is the one that decides what is
    // dropped, and readable names make a failure say what was kept.
    minifySyntax: true,
    minifyWhitespace: false,
    minifyIdentifiers: false,
    legalComments: 'none',
    logLevel: 'silent',
    define: PRODUCTION,
    plugins: [
      {
        name: 'probe',
        setup(build) {
          build.onResolve({ filter: /__tree-shaking-probe__\.ts$/ }, () => ({ path: join(CORE, PROBE), namespace: 'probe' }));
          build.onLoad({ filter: /.*/, namespace: 'probe' }, () => ({ contents: PROBE_TEXT, loader: 'ts' }));
        },
      },
    ],
  });
  const js = result.outputFiles[0]?.text ?? '';
  const out = ts.createSourceFile('out.js', js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const found: Leftover[] = [];
  let from = '?';
  for (const statement of out.statements) {
    // esbuild heads each module's code with a comment naming its file.
    const named = [...js.slice(statement.getFullStart(), statement.getStart(out)).matchAll(/\/\/ (?:probe:)?(\S+\.ts)\b/g)].pop();
    if (named?.[1]) from = relative(ROOT, named[1].startsWith('/') ? named[1] : join(ROOT, named[1]));
    const oneLine = (node: ts.Node): string => {
      const text = node.getText(out).replace(/\s+/g, ' ');
      return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    };
    // esbuild joins neighbouring declarations into one `var`; each is its own finding.
    const parts: [string, ts.Node][] = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map((d) => [d.name.getText(out), d])
      : (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name
        ? [[statement.name.text, statement]]
        : [[oneLine(statement).slice(0, 60), statement]];
    for (const [name, node] of parts) found.push({ key: `${from} ${name}`, text: oneLine(node) });
  }
  return found;
}

after(() => esbuild.stop());

/* ------------------------------------------------------------ the check */

describe('the tree-shaking check', () => {
  test('reads the targets and defines build.mjs bundles with', () => {
    assert.ok(TARGET.length >= 3, `only ${TARGET.length} targets were read off build.mjs: ${TARGET.join(', ')}`);
    assert.ok(TARGET.some((t) => t.startsWith('safari')), `no Safari target among ${TARGET.join(', ')}`);
    for (const name of Object.keys(PRODUCTION)) {
      assert.ok(DEFINED.includes(name), `${name} is defined here and not in build.mjs's define block, which names ${DEFINED.join(', ')}`);
    }
    // Every build-time name core reads has its production value here, so the
    // check folds what the build folds.
    const read = new Set(files.flatMap((f) => readFileSync(join(CORE, f), 'utf8').match(/\b__WEFT_[A-Z_]+__\b/g) ?? []));
    assert.deepEqual([...read].filter((name) => !Object.hasOwn(PRODUCTION, name)), []);
  });

  test('finds what esbuild keeps, and nothing it drops', async () => {
    // Not the marked call or freeze, the Set of literals, the empty Map, the
    // plain pattern, the helper's call or the wrapped arrow, which esbuild
    // drops; LIST, KEY and BASE stay because what reads them stays.
    const kept = (await leftBehind(PROBE)).map((l) => l.key.replace(/^\S+ /, '')).sort();
    assert.deepEqual(kept, ['BASE', 'KEY', 'LIST', 'called', 'encoder', 'frozen', 'letter', 'read', 'spread', 'url']);
  });

  test('says which module left each statement', async () => {
    const leftover = await leftBehind(PROBE);
    assert.ok(leftover.length > 0);
    for (const { key } of leftover) assert.match(key, /^src\/core\/__tree-shaking-probe__\.ts /);
  });
});

describe('src/core/', () => {
  test('leaves nothing behind in a bundle that imports a module and reads none of it', async () => {
    assert.ok(files.length >= 25, `only ${files.length} files were found in src/core/`);
    const leftover = (await Promise.all(files.map((f) => leftBehind(f)))).flat();
    const seen = new Map(leftover.map((l) => [l.key, l.text]));
    assert.deepEqual(
      [...seen].filter(([key]) => !Object.hasOwn(MUST_RUN, key)).map(([key, text]) => `${key}: ${text}`),
      [],
      'esbuild keeps each of these in every bundle that imports its module, read or not. Mark a call or a `new` ' +
        '`/* @__PURE__ */`; mark a helper whose every call is pure `/* @__NO_SIDE_EFFECTS__ */`; wrap what no mark ' +
        'reaches (a property read, a spread, a template that interpolates a name, a `\\p{…}` regular expression) in an ' +
        'arrow called at once, and mark that call; or name it in MUST_RUN with why it must run wherever its module is imported',
    );
    assert.deepEqual(
      Object.keys(MUST_RUN).filter((key) => !seen.has(key)),
      [],
      'MUST_RUN names a statement esbuild no longer keeps',
    );
  });
});

/* ------------------------------------------------------------ the marks */

/** Where a call or `new` marked pure throws its value away, which deletes it from every bundle. */
function discardedMarks(file: ts.SourceFile): string[] {
  const text = file.getFullText();
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      /[@#]__PURE__/.test(text.slice(node.getFullStart(), node.getStart(file)))
    ) {
      let at: ts.Node = node;
      while (ts.isParenthesizedExpression(at.parent) || ts.isAsExpression(at.parent) || ts.isSatisfiesExpression(at.parent)) {
        at = at.parent;
      }
      const thrownAway =
        ts.isExpressionStatement(at.parent) ||
        (ts.isBinaryExpression(at.parent) && at.parent.operatorToken.kind === ts.SyntaxKind.CommaToken && at.parent.left === at) ||
        (ts.isVoidExpression(at.parent));
      if (thrownAway) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        found.push(`${relative(ROOT, file.fileName)}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('a pure mark', () => {
  test('is found wherever it throws its call away', () => {
    const probe = ts.createSourceFile(
      join(CORE, 'marks.ts'),
      [
        'export const kept = /* @__PURE__ */ make();',
        '/* @__PURE__ */ register();',
        '(/* @__PURE__ */ register());',
        'void /* @__PURE__ */ register();',
        'export const both = (/* @__PURE__ */ register(), 1);',
        'export const wrapped = /* @__PURE__ */ (() => register())();',
        'register();',
        'function make() { return 1; } function register() { return 2; }',
      ].join('\n'),
      ts.ScriptTarget.ES2022,
      true,
    );
    assert.deepEqual(discardedMarks(probe), ['src/core/marks.ts:2', 'src/core/marks.ts:3', 'src/core/marks.ts:4', 'src/core/marks.ts:5']);
  });

  test('never throws its call away in src/core/', () => {
    assert.deepEqual(
      files.flatMap((f) => discardedMarks(ts.createSourceFile(join(CORE, f), readFileSync(join(CORE, f), 'utf8'), ts.ScriptTarget.ES2022, true))),
      [],
      'a call marked pure whose value nobody keeps is deleted from every bundle: if it has to run, it has to run unmarked, ' +
        'and the statement it is in belongs in MUST_RUN',
    );
  });
});
