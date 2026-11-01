/**
 * The highlight renderer edits `nodeValue` in place and restructures nothing.
 * It is CLAUDE.md's first decision: Google Translate replaces text nodes, a
 * framework's fiber still holds the one it detached, and the next render
 * throws `NotFoundError`; assigning to `nodeValue` moves no node, so no
 * framework's reference is ever invalidated. Until 2026-11-01 one e2e page
 * held it, `tests/e2e/pages/reconciler.html`, in Chromium, and nothing
 * refused a `splitText()`, a `replaceWith()` or a `range.surroundContents()`
 * typed into `src/content/render-highlight.ts`: each passes `tsc`, the unit
 * suites and every e2e test but that one.
 *
 * So the checker is asked where every name the renderer uses is declared, in
 * the renderer and every module it imports for a value, up to `src/core/`,
 * which core-purity.test.ts holds to no DOM at all. A member or a global the
 * platform declares — a TypeScript library that is not ECMAScript's, a
 * package's types, or a project `.d.ts` such as `dom-types.d.ts` — must be
 * named in `TOUCHES` with why it restructures nothing, and may be written
 * only where `TOUCHES` says so. The set is closed rather than a list of the
 * dangerous members, because a list holds only what its author remembered: a
 * mutation nobody listed, `moveBefore()` the year TypeScript's library gains
 * it, fails because nobody named it. `RESTRUCTURES` is such a list, and it
 * guards `TOUCHES` instead, so a member that restructures cannot be allowed
 * by anyone who wrote a reason for it.
 *
 * A member is keyed by the interface that declares it, as the checker
 * resolves it: TypeScript 5.9's library redeclares `textContent` on
 * `Element`, `CharacterData` and `DocumentFragment`, so an element's
 * `textContent = ''`, which replaces its children, is `Element.textContent`,
 * and a text node's, which edits its data in place, is
 * `CharacterData.textContent`.
 *
 * `render-wrapped.ts` replaces the text node by design, for screen-reader
 * users who need a real `lang`, and the renderer imports nothing of it. The
 * tooltip, the styles and the live region append elements of their own,
 * which are not page text, and it imports none of those either.
 *
 * The check reads names, as core-purity's does: it is a guard against
 * reaching for a mutation by habit, not against hiding one.
 * `node['split' + 'Text']` and `Object.assign(node, { textContent })` name
 * no member it can resolve; a member read off an `any`, the commonest way a
 * name escapes the checker, is refused as unresolved.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const CORE = join(SRC, 'core');
const RENDERER = join(SRC, 'content/render-highlight.ts');

/**
 * Every member and global the platform declares that the renderer touches,
 * and why each restructures nothing. Any use but a write is allowed; a write
 * only where `write` says so.
 */
const TOUCHES: Record<string, { why: string; write?: true }> = {
  'Node.nodeValue': { write: true, why: 'the decision itself: assigning nodeValue edits the text node in place and moves none' },
  document: { why: 'the page’s document, read to make a range and to ask where the caret is' },
  'Document.createRange': { why: 'makes a range, the renderer’s own object, which marks characters without moving a node' },
  'Range.setStart': { why: 'sets where one of the renderer’s ranges begins; the tree is untouched' },
  'Range.setEnd': { why: 'sets where one of the renderer’s ranges ends; the tree is untouched' },
  'Range.getBoundingClientRect': { why: 'reads where a woven word is drawn, to place the tooltip' },
  'AbstractRange.collapsed': { why: 'reads whether the page’s own rewrite emptied a range' },
  'DOMRect.width': { why: 'reads a drawn size' },
  'DOMRect.height': { why: 'reads a drawn size' },
  Highlight: { why: 'the CSS Custom Highlight API, which styles character ranges with no element at all' },
  'Highlight.priority': { write: true, why: 'orders the renderer’s own three highlights, so the revealed word paints over the rest' },
  CSS: { why: 'the namespace the highlight registry hangs from' },
  'CSS.highlights': { why: 'the registry the renderer names its highlights in, which the stylesheet styles by name' },
  'Document.caretPositionFromPoint': { why: 'reads which character is under the pointer, the standard way' },
  'Document.caretRangeFromPoint': { why: 'reads which character is under the pointer, the legacy way' },
  'CaretPosition.offsetNode': { why: 'reads the node under the pointer' },
  'CaretPosition.offset': { why: 'reads the offset under the pointer' },
  'AbstractRange.startContainer': { why: 'reads the node under the pointer, from the legacy caret range' },
  'AbstractRange.startOffset': { why: 'reads the offset under the pointer, from the legacy caret range' },
  'Node.nodeType': { why: 'reads whether the pointer is over a text node' },
  Node: { why: 'read for its node-type constants' },
  'Node.TEXT_NODE': { why: 'the constant the pointer’s node is compared with' },
};

/**
 * Members that restructure a tree — insert, remove, replace, move, split or
 * merge a node, or replace an element's children — keyed by the interface
 * TypeScript's library declares each on. `written` marks a property that
 * restructures only when written; reading one is harmless.
 */
const RESTRUCTURES: Record<string, { how: string; written?: true }> = {
  'Node.appendChild': { how: 'inserts a node' },
  'Node.insertBefore': { how: 'inserts a node' },
  'Node.removeChild': { how: 'removes a node' },
  'Node.replaceChild': { how: 'replaces a node, which is what Google Translate does' },
  'Node.normalize': { how: 'merges adjacent text nodes and removes the rest' },
  'Node.textContent': { how: 'replaces the children', written: true },
  'ChildNode.after': { how: 'inserts nodes' },
  'ChildNode.before': { how: 'inserts nodes' },
  'ChildNode.remove': { how: 'removes the node' },
  'ChildNode.replaceWith': { how: 'replaces the node' },
  'ParentNode.append': { how: 'inserts nodes' },
  'ParentNode.prepend': { how: 'inserts nodes' },
  'ParentNode.replaceChildren': { how: 'replaces the children' },
  'Element.attachShadow': { how: 'stops rendering the children, which the shadow root replaces' },
  'Element.innerHTML': { how: 'replaces the children', written: true },
  'Element.outerHTML': { how: 'replaces the element', written: true },
  'Element.textContent': { how: 'replaces the children', written: true },
  'Element.insertAdjacentElement': { how: 'inserts an element' },
  'Element.insertAdjacentHTML': { how: 'inserts parsed nodes' },
  'Element.insertAdjacentText': { how: 'inserts a text node' },
  'Element.setHTMLUnsafe': { how: 'replaces the children' },
  'HTMLElement.innerText': { how: 'replaces the children', written: true },
  'HTMLElement.outerText': { how: 'replaces the element', written: true },
  'DocumentFragment.textContent': { how: 'replaces the children, of a page’s shadow root too', written: true },
  'ShadowRoot.innerHTML': { how: 'replaces the children', written: true },
  'ShadowRoot.setHTMLUnsafe': { how: 'replaces the children' },
  'Text.splitText': { how: 'splits the node in two and inserts the second' },
  'Range.deleteContents': { how: 'removes what the range spans, splitting text nodes at its ends' },
  'Range.extractContents': { how: 'moves what the range spans into a fragment, splitting text nodes at its ends' },
  'Range.insertNode': { how: 'inserts a node, splitting a text node at the start' },
  'Range.surroundContents': { how: 'wraps what the range spans in an element: the usual way to highlight, and the wrong one here' },
  'Selection.deleteFromDocument': { how: 'removes what the selection spans' },
  'Document.adoptNode': { how: 'removes the node from its parent' },
  'Document.execCommand': { how: 'edits the page’s editable content' },
  'Document.open': { how: 'replaces the document' },
  'Document.write': { how: 'inserts parsed markup, or replaces the document' },
  'Document.writeln': { how: 'inserts parsed markup, or replaces the document' },
};

/* ------------------------------------------------------------ the reader */

type Use = 'read' | 'write' | 'call';

interface Touch {
  /** Where, as `src/<file>:<line>`. */
  at: string;
  /** `Interface.member`, or a global's own name. */
  key: string;
  use: Use;
}

/** Whose declarations a file holds: ECMAScript's, the platform's, or the project's own code. */
function libraryOf(fileName: string): 'ECMAScript' | 'platform' | 'project' {
  const lib = /\/node_modules\/typescript\/lib\/(lib\.[^/]+\.d\.ts)$/.exec(fileName);
  if (lib) return /^lib\.(es|decorators)/.test(lib[1] ?? '') ? 'ECMAScript' : 'platform';
  // A package's types, and a project .d.ts, which declares what the browser
  // has and TypeScript's library lacked, as dom-types.d.ts does.
  if (fileName.includes('/node_modules/') || fileName.endsWith('.d.ts')) return 'platform';
  return 'project';
}

/** The interface, class, namespace or `declare var` a declaration is a member of, or null for a global. */
function ownerOf(decl: ts.Declaration): string | null {
  for (let n: ts.Node = decl.parent; n && !ts.isSourceFile(n); n = n.parent) {
    if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n) || ts.isModuleDeclaration(n)) && n.name) {
      return n.name.text;
    }
    // `declare var Node: { readonly TEXT_NODE: 3; … }` holds the constants.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
  }
  return null;
}

/** The key a platform symbol is held by, or null when ECMAScript or the project declares it. */
function keyOf(symbol: ts.Symbol | undefined, name: string): string | null {
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declarations = symbol?.declarations ?? [];
  const libraries = declarations.map((d) => libraryOf(d.getSourceFile().fileName));
  if (libraries.includes('ECMAScript') || !libraries.includes('platform')) return null;
  const owners = declarations
    .filter((d) => libraryOf(d.getSourceFile().fileName) === 'platform')
    .map(ownerOf)
    .filter((o): o is string => o !== null);
  const owner = [...new Set(owners)].sort()[0];
  return owner ? `${owner}.${name}` : name;
}

/** Whether an access is called, written or only read. */
function useOf(access: ts.Node): Use {
  let n = access;
  while (ts.isParenthesizedExpression(n.parent) || ts.isNonNullExpression(n.parent)) n = n.parent;
  const p = n.parent;
  if (ts.isCallExpression(p) && p.expression === n) return 'call';
  if (
    ts.isBinaryExpression(p) &&
    p.left === n &&
    p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    p.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return 'write';
  }
  if (
    (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) &&
    (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return 'write';
  }
  return 'read';
}

/** Whether the build erases a node: inside a type, but not a class's `extends`, which runs. */
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

/** Every platform member and global a file touches, every member it reads off an `any`, and how many names it read. */
function scan(file: ts.SourceFile): { touches: Touch[]; unresolved: string[]; names: number } {
  const touches: Touch[] = [];
  const unresolved: string[] = [];
  let names = 0;
  const at = (node: ts.Node): string =>
    `${relative(ROOT, file.fileName)}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && !erased(node)) {
      names++;
      const key = keyOf(checker.getSymbolAtLocation(node), node.text);
      if (key) {
        const access = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node ? node.parent : node;
        touches.push({ at: at(node), key, use: useOf(access) });
      }
    } else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && !erased(node)) {
      const key = keyOf(checker.getSymbolAtLocation(node.argumentExpression), node.argumentExpression.text);
      if (key) touches.push({ at: at(node), key, use: useOf(node) });
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      !erased(node) &&
      checker.getTypeAtLocation(node.expression).flags & ts.TypeFlags.Any
    ) {
      unresolved.push(`${at(node)} ${node.name.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { touches, unresolved, names };
}

/** Whether a touch restructures the tree. */
function restructuring(touch: Touch): boolean {
  const entry = RESTRUCTURES[touch.key];
  return entry !== undefined && (!entry.written || touch.use === 'write');
}

interface Edge {
  line: number;
  name: string;
  /** True where only types are named, which the build erases with the import. */
  types: boolean;
}

/** Every module a file names, as written, with whether only its types are. */
function importsOf(file: ts.SourceFile): Edge[] {
  const edges: Edge[] = [];
  const add = (node: ts.Node, spec: ts.Node | undefined, types: boolean): void => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    edges.push({ line, name: spec && ts.isStringLiteralLike(spec) ? spec.text : 'a computed name', types });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const onlyTypes =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (!clause.name &&
            named !== undefined &&
            ts.isNamedImports(named) &&
            named.elements.length > 0 &&
            named.elements.every((e) => e.isTypeOnly)));
      add(node, node.moduleSpecifier, onlyTypes);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const named = node.exportClause;
      const onlyTypes =
        node.isTypeOnly ||
        (named !== undefined && ts.isNamedExports(named) && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly));
      add(node, node.moduleSpecifier, onlyTypes);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node, node.arguments[0], false);
    } else if (ts.isImportTypeNode(node)) {
      add(node, ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return edges;
}

/**
 * What the walk does with a module a file imports for a value: reads it,
 * stops at `src/core/`, which core-purity.test.ts holds to no DOM, or refuses
 * it, with why, where it cannot read what the module does.
 */
function verdict(name: string, from: string): { read: string } | 'core' | { refused: string } {
  if (name === 'a computed name') return { refused: 'a computed module, which the check cannot follow' };
  const resolved = ts.resolveModuleName(name, from, options, ts.sys).resolvedModule;
  if (!resolved) return { refused: 'it does not resolve' };
  const file = resolved.resolvedFileName;
  if (resolved.isExternalLibraryImport || !file.startsWith(`${SRC}/`)) {
    return { refused: 'it is outside src/, where the check cannot read what it does' };
  }
  return file.startsWith(`${CORE}/`) ? 'core' : { read: file };
}

/** The renderer and every module it imports for a value, and the imports the walk refused. */
function graphOf(root: string): { files: string[]; refused: string[] } {
  const files: string[] = [];
  const refused: string[] = [];
  const queue = [root];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const name = queue.shift() as string;
    files.push(name);
    for (const edge of importsOf(source(name))) {
      if (edge.types) continue;
      const v = verdict(edge.name, name);
      if (v === 'core') continue;
      if ('refused' in v) refused.push(`${relative(ROOT, name)}:${edge.line} ${edge.name}: ${v.refused}`);
      else if (!seen.has(v.read)) {
        seen.add(v.read);
        queue.push(v.read);
      }
    }
  }
  return { files, refused };
}

/* ------------------------------------------------------------ the program */

/**
 * Two renderer-like files that are never on disk, so the check is shown to
 * fire every time it runs rather than once on the day it was written. The
 * first holds what only looks like a restructuring; the second, one use of
 * every member `RESTRUCTURES` names.
 */
const LOOKALIKES = join(SRC, 'content/__in-place-probe__.ts');
const LOOKALIKES_TEXT = [
  '// text.splitText(1) and el.remove() are named in this comment, and in a string below.',
  'declare const text: Text;',
  'declare const el: HTMLElement;',
  "text.nodeValue = 'woven';",
  "text.nodeValue += '!';",
  "text.data = 'woven';",
  "text.appendData('!');",
  "text.textContent = 'woven';",
  'export const was = el.textContent;',
  'export const range = document.createRange();',
  'range.setStart(text, 0);',
  "el.classList.remove('weft');",
  'const local = { splitText: (n: number) => n };',
  'local.splitText(1);',
  "export const spelt = 'text.splitText(1) and el.remove()';",
  'export const kept = [1, 2].splice(0, 1);',
  "new Map<string, number>().set('a', 1);",
  'export let typed: Text | undefined;',
  'export const hidden = (text as any).splitText(1);',
].join('\n');

const MUTATIONS = join(SRC, 'content/__restructure-probe__.ts');
const MUTATIONS_TEXT = [
  'declare const node: Node;',
  'declare const text: Text;',
  'declare const el: HTMLElement;',
  'declare const fragment: DocumentFragment;',
  'declare const shadow: ShadowRoot;',
  'declare const range: Range;',
  'declare const selection: Selection;',
  'node.appendChild(text);',
  'node.insertBefore(text, null);',
  'node.removeChild(text);',
  'node.replaceChild(text, text);',
  'node.normalize();',
  "node.textContent = '';",
  "text.after('');",
  "text.before('');",
  'text.remove();',
  "text.replaceWith('');",
  "el.append('');",
  "el.prepend('');",
  'el.replaceChildren();',
  "el.attachShadow({ mode: 'open' });",
  "el.innerHTML = '';",
  "el.outerHTML = '';",
  "el.textContent = '';",
  "el.insertAdjacentElement('afterend', el);",
  "el.insertAdjacentHTML('afterend', '');",
  "el.insertAdjacentText('afterend', '');",
  "el.setHTMLUnsafe('');",
  "el.innerText = '';",
  "el.outerText = '';",
  "fragment.textContent = '';",
  "shadow.innerHTML = '';",
  "shadow.setHTMLUnsafe('');",
  'text.splitText(1);',
  'range.deleteContents();',
  'range.extractContents();',
  'range.insertNode(text);',
  'range.surroundContents(el);',
  'selection.deleteFromDocument();',
  'document.adoptNode(text);',
  "document.execCommand('insertText');",
  'document.open();',
  "document.write('');",
  "document.writeln('');",
  'export {};',
].join('\n');

const PROBES: Record<string, string> = { [LOOKALIKES]: LOOKALIKES_TEXT, [MUTATIONS]: MUTATIONS_TEXT };

const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  },
});
if (!config) throw new Error('tsconfig.json did not parse');
const options = config.options;

const host = ts.createCompilerHost(options, true);
const readSource = host.getSourceFile.bind(host);
host.getSourceFile = (name, version, ...rest) => {
  const probe = PROBES[name];
  return probe !== undefined ? ts.createSourceFile(name, probe, version, true) : readSource(name, version, ...rest);
};

// The project's own declarations, which the build reads and the renderer
// imports nothing of: dom-types.d.ts gives `CSS` the interface it is cast to.
const ambient = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => f.endsWith('.d.ts'))
  .map((f) => join(SRC, f));
const program = ts.createProgram([RENDERER, ...ambient, ...Object.keys(PROBES)], options, host);
const checker = program.getTypeChecker();

function source(name: string): ts.SourceFile {
  const file = program.getSourceFile(name);
  if (!file) throw new Error(`${relative(ROOT, name)} is not in the program`);
  return file;
}

const graph = graphOf(RENDERER);
const scanned = graph.files.map((f) => scan(source(f)));
const touches = scanned.flatMap((s) => s.touches);
const unresolved = scanned.flatMap((s) => s.unresolved);
const namesRead = scanned.reduce((n, s) => n + s.names, 0);

/* ------------------------------------------------------------ the tests */

describe('the in-place check', () => {
  test('finds every platform member a file touches, and how, and nothing that only looks like one', () => {
    // Not the comment, the string, the local `splitText`, the array's
    // `splice`, the map's `set` or the type, which are ECMAScript's or the
    // file's own; and a member read off an `any`, which nothing resolves, is
    // reported apart.
    const { touches: found, unresolved: blind } = scan(source(LOOKALIKES));
    assert.deepEqual(
      found.map((t) => [t.key, t.use]),
      [
        ['Node.nodeValue', 'write'],
        ['Node.nodeValue', 'write'],
        ['CharacterData.data', 'write'],
        ['CharacterData.appendData', 'call'],
        ['CharacterData.textContent', 'write'],
        ['Element.textContent', 'read'],
        ['document', 'read'],
        ['Document.createRange', 'call'],
        ['Range.setStart', 'call'],
        ['Element.classList', 'read'],
        ['DOMTokenList.remove', 'call'],
      ],
    );
    assert.deepEqual(blind, ['src/content/__in-place-probe__.ts:19 splitText']);
  });

  test('calls none of those a restructuring: each edits in place, reads, or touches an object of its own', () => {
    assert.deepEqual(scan(source(LOOKALIKES)).touches.filter(restructuring), []);
  });

  test('calls every member RESTRUCTURES names a restructuring, keyed as the checker keys it', () => {
    // So a misspelt key, or one TypeScript's library declares on another
    // interface, fails here rather than leaving a gap in the guard on TOUCHES.
    const found = [...new Set(scan(source(MUTATIONS)).touches.filter(restructuring).map((t) => t.key))].sort();
    assert.deepEqual(found, Object.keys(RESTRUCTURES).sort());
  });

  test('reads a module imported for a value, and not one whose types alone are named', () => {
    const text = [
      "import { swapAtOffset, type WovenRecord } from './weave.ts';",
      "import type { Renderer } from './renderer.ts';",
      "import { type Hit } from './weave.ts';",
      "import { WEFT_ATTR } from './walker.ts';",
      "import './styles.ts';",
      "export { Tooltip } from './tooltip.ts';",
      "export type { Settings } from '../core/types.ts';",
      "export * from './announce.ts';",
      "const lazy = await import('./attention.ts');",
      "const name = 'x'; const later = await import(name);",
      "type Tip = import('./tooltip.ts').Tooltip;",
    ].join('\n');
    const file = ts.createSourceFile(join(SRC, 'content/imports.ts'), text, ts.ScriptTarget.ES2022, true);
    assert.deepEqual(
      importsOf(file).map((e) => [e.line, e.name, e.types]),
      [
        [1, './weave.ts', false],
        [2, './renderer.ts', true],
        [3, './weave.ts', true],
        [4, './walker.ts', false],
        [5, './styles.ts', false],
        [6, './tooltip.ts', false],
        [7, '../core/types.ts', true],
        [8, './announce.ts', false],
        [9, './attention.ts', false],
        [10, 'a computed name', false],
        [11, './tooltip.ts', true],
      ],
    );
  });

  test('follows a module in src/, stops at src/core/, and refuses what it cannot read', () => {
    assert.deepEqual(verdict('./weave.ts', RENDERER), { read: join(SRC, 'content/weave.ts') });
    assert.equal(verdict('../core/types.ts', RENDERER), 'core');
    assert.deepEqual(verdict('preact', RENDERER), { refused: 'it is outside src/, where the check cannot read what it does' });
    assert.deepEqual(verdict('./nowhere.ts', RENDERER), { refused: 'it does not resolve' });
    assert.deepEqual(verdict('a computed name', RENDERER), { refused: 'a computed module, which the check cannot follow' });
  });
});

describe('src/content/render-highlight.ts', () => {
  test('imports for a value only modules in src/, which the check reads', () => {
    // A floor, so a walk that reads nothing cannot pass for a renderer that
    // touches nothing.
    assert.ok(graph.files.includes(RENDERER) && graph.files.length >= 2, `only ${graph.files.map((f) => relative(ROOT, f)).join(', ')} were read`);
    assert.deepEqual(graph.refused, []);
  });

  test('touches no platform member TOUCHES does not name, and writes only what TOUCHES lets it', () => {
    // Floors, set from the count on 2026-11-01 (407 names, 45 touches), so a
    // checker that resolves nothing cannot pass for a renderer that touches nothing.
    assert.ok(namesRead >= 300, `only ${namesRead} names were read in the renderer`);
    assert.ok(touches.length >= 30, `only ${touches.length} platform touches were found in the renderer`);
    assert.deepEqual(
      touches
        .filter((t) => {
          const entry = TOUCHES[t.key];
          return entry === undefined || (t.use === 'write' && !entry.write);
        })
        .map((t) => `${t.at} ${t.key}, ${t.use === 'write' ? 'written' : t.use === 'call' ? 'called' : 'read'}${restructuring(t) ? `, which ${RESTRUCTURES[t.key]?.how}` : ''}`),
      [],
      'the highlight renderer edits nodeValue in place and never replaces a text node (CLAUDE.md): ' +
        'edit nodeValue instead; or, for a member that restructures nothing, name it in TOUCHES with why',
    );
  });

  test('reads no member off an any, where the check cannot say what it touches', () => {
    assert.deepEqual(unresolved, [], 'give the receiver a type, so the checker can resolve the member');
  });

  test('TOUCHES names only what the renderer touches, and nothing that restructures', () => {
    const problems: string[] = [];
    for (const [key, entry] of Object.entries(TOUCHES)) {
      const mine = touches.filter((t) => t.key === key);
      const structural = RESTRUCTURES[key];
      if (structural && (!structural.written || entry.write)) {
        problems.push(`${key}: it ${structural.how}, so no reason can allow it`);
      } else if (mine.length === 0) {
        problems.push(`${key}: the renderer no longer touches it, so TOUCHES should not name it`);
      } else if (entry.write && !mine.some((t) => t.use === 'write')) {
        problems.push(`${key}: the renderer no longer writes it, so TOUCHES should not let it`);
      }
    }
    assert.deepEqual(problems, []);
  });
});
