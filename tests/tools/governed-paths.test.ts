/**
 * Every settings path a page writes is judged by the lock, or says why not.
 *
 * `assessPatch` judges the paths `GOVERNED_PATHS` names and calls every other
 * one neutral, and `requestChange` applies a neutral change at once. Until
 * 2026-11-08 nine controls on the settings page made Weft easier that way —
 * a taxed rule edited in place, "Recovery while you are away", the tamper
 * response and six more — and the list that would have caught them was the
 * list that had left them out. A hand-typed list of controls cannot police
 * the control nobody thought of, so this one is derived from the pages:
 *
 *  - every call to the options controller's `set` or `setMany`, found by
 *    asking the checker which declaration the call resolves to, so a
 *    controller passed under another name is still read;
 *  - every patch a page sends in a `request-change` or `complete-onboarding`
 *    message, which is how the popup and the first-run page write;
 *  - a template path expanded through its substitution's literal type, so
 *    `weave.letterforms.${id}` is the seven letterforms `LetterformId` names.
 *
 * Each path must be in `GOVERNED_PATHS`, or in `NEUTRAL` here with why it is
 * not difficulty. A write the reader cannot see through — a path held in a
 * variable, a patch built elsewhere — is named in `DYNAMIC` with the paths it
 * can be. Every table is held both ways, so an entry nothing writes fails.
 *
 * Deriving it found a tenth control the first time it ran: the Letterforms
 * row, whose own copy says "Orthography is a difficulty axis of its own.
 * Turning thorn and macrons off makes the same vocabulary far easier to
 * read", applied a letterform switched off at once. So did "Retire words you
 * know" switched off, which spends the budget on words already learned.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { GOVERNED_PATHS } from '../../src/core/lock.ts';
import { DIFFICULTY_PRESETS } from '../../src/core/settings.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const UI = join(SRC, 'ui');
const CONTROLLER = join(UI, 'options/controller.ts');

/* ------------------------------------------------------------ the tables */

const PRIVACY =
  'What leaves the machine, not how hard the page is. Sending less must land at once — a ' +
  'cooldown on turning lookups off would hold a reader’s words on their way out — and an import ' +
  'may narrow it but never widen it (`sendNoMoreThan`). Turning lookups off may weave fewer ' +
  'words a pack does not cover, and still lands at once: privacy is not difficulty.';
const SHOWN = 'What the tooltip shows when the reader asks, not what is woven. Pronunciation and the etymologies are never gated.';
const ACCESS = 'Accessibility, which is never gated at any price.';

/** Paths a page writes that are not difficulty, each with why. */
const NEUTRAL: Record<string, string> = {
  'a11y.highContrast': ACCESS,
  'a11y.keyboardCursor': ACCESS,
  'a11y.minTooltipFontPx': ACCESS,
  'a11y.preferWrappedForAT': ACCESS,
  'learning.targetLangs':
    'Written beside `learning.activeTarget`, which is governed; nothing reads it but the free clamp.',
  'providers.enabled': PRIVACY,
  'providers.sendContext': PRIVACY,
  'providers.cacheDays': PRIVACY,
  'providers.dailyLookupCap': PRIVACY,
  'providers.deepl.free': PRIVACY,
  'providers.deepl.key': PRIVACY,
  'providers.google.key': PRIVACY,
  'providers.openai.key': PRIVACY,
  'providers.openai.baseUrl': PRIVACY,
  'providers.openai.model': PRIVACY,
  'reveal.grading': SHOWN,
  'reveal.hoverDelayMs': SHOWN,
  'reveal.showBand': SHOWN,
  'reveal.showEtymon': SHOWN,
  'reveal.showGender': SHOWN,
  'reveal.showIpa': SHOWN,
  'reveal.showPos': SHOWN,
  'reveal.trigger': SHOWN,
  'reveal.tts': SHOWN,
  'weave.renderMode':
    'How a woven word is drawn — highlighted, or real elements for a screen reader — not how many are woven.',
  'weave.style.tint': 'How a woven word looks.',
  'weave.style.underline': 'How a woven word looks.',
};

const PRESET_PATHS = [...new Set(DIFFICULTY_PRESETS.flatMap((p) => Object.keys(p.patch)))].sort();

/**
 * Writes the reader cannot see through, keyed by file and the expression as
 * written, with every path each can be.
 */
const DYNAMIC: Array<{ file: string; text: string; paths: string[]; why: string }> = [
  {
    file: 'src/ui/options/controller.ts',
    text: 'patch',
    paths: [],
    why: 'The controller forwards `set` and `setMany`, whose calls are read above.',
  },
  {
    file: 'src/ui/options/sections.tsx',
    text: 'preset.patch',
    paths: PRESET_PATHS,
    why: 'A difficulty preset, read from DIFFICULTY_PRESETS.',
  },
  {
    file: 'src/ui/onboarding/index.tsx',
    text: '(preset?.patch ?? {})',
    paths: PRESET_PATHS,
    why: 'The first-run page’s difficulty preset, read from DIFFICULTY_PRESETS.',
  },
  {
    file: 'src/ui/options/data.tsx',
    text: 'path',
    paths: ['providers.deepl.key', 'providers.google.key', 'providers.openai.key'],
    why: 'The three key fields, each called with its path as a literal in this file.',
  },
];

/* ------------------------------------------------------------ the reader */

interface Write {
  /** Where, as `src/<file>:<line>`. */
  at: string;
  path: string;
}

interface Unread {
  at: string;
  file: string;
  text: string;
}

function at(node: ts.Node): string {
  const file = node.getSourceFile();
  const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  return `${relative(ROOT, file.fileName)}:${line}`;
}

const written = (node: ts.Node): string => node.getText().replace(/\s+/g, ' ');

const PROBE = join(UI, 'options/__governed-probe.ts');
const PROBE_TEXT = `import type { Controller } from './controller.ts';
export function probe(ctl: Controller, x: string): void {
  void ctl.set('weave.somethingNobodyNamed', 1);
  void ctl.setMany({ 'friction.alsoUnnamed': 2 });
  void ctl.set(x, 3);
}
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
const exists = host.fileExists.bind(host);
host.fileExists = (name) => name === PROBE || exists(name);
const read = host.readFile.bind(host);
host.readFile = (name) => (name === PROBE ? PROBE_TEXT : read(name));

const everything = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => join(SRC, f))
  .sort();
const program = ts.createProgram([...everything, PROBE], config.options, host);
const checker = program.getTypeChecker();

/** The controller's `set` and `setMany`, as the interface declares them. */
const METHODS: Map<ts.Declaration, 'set' | 'setMany'> = ((): Map<ts.Declaration, 'set' | 'setMany'> => {
  const file = program.getSourceFile(CONTROLLER);
  if (!file) throw new Error('src/ui/options/controller.ts is not in the program');
  const found = new Map<ts.Declaration, 'set' | 'setMany'>();
  file.forEachChild(function visit(node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'Controller') {
      for (const member of node.members) {
        if (ts.isMethodSignature(member) && ts.isIdentifier(member.name)) {
          const name = member.name.text;
          if (name === 'set' || name === 'setMany') found.set(member, name);
        }
      }
    }
  });
  if (found.size !== 2) throw new Error(`Controller declares ${found.size} of set and setMany`);
  return found;
})();

/** Every value a template's substitution can take, when its type is a finite union of strings. */
function literals(expr: ts.Expression): string[] | null {
  const type = checker.getTypeAtLocation(expr);
  const parts = type.isUnion() ? type.types : [type];
  const out: string[] = [];
  for (const part of parts) {
    if (!part.isStringLiteral()) return null;
    out.push(part.value);
  }
  return out;
}

/** The paths a path argument names, or null where it cannot be read. */
function pathsOf(expr: ts.Expression): string[] | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
  if (ts.isTemplateExpression(expr)) {
    let out = [expr.head.text];
    for (const span of expr.templateSpans) {
      const values = literals(span.expression);
      if (!values) return null;
      out = out.flatMap((prefix) => values.map((v) => prefix + v + span.literal.text));
    }
    return out;
  }
  return null;
}

/** The keys of a patch, reading object literals; what cannot be read is reported. */
function keysOf(expr: ts.Expression, unread: Unread[], file: string): Array<{ node: ts.Node; path: string }> {
  if (!ts.isObjectLiteralExpression(expr)) {
    unread.push({ at: at(expr), file, text: written(expr) });
    return [];
  }
  const out: Array<{ node: ts.Node; path: string }> = [];
  for (const prop of expr.properties) {
    if (ts.isSpreadAssignment(prop)) {
      unread.push({ at: at(prop), file, text: written(prop.expression) });
      continue;
    }
    const name = prop.name;
    if (name && (ts.isStringLiteral(name) || ts.isIdentifier(name) || ts.isNoSubstitutionTemplateLiteral(name))) {
      out.push({ node: prop, path: name.text });
    } else if (name && ts.isComputedPropertyName(name)) {
      const paths = pathsOf(name.expression);
      if (paths) for (const path of paths) out.push({ node: prop, path });
      else unread.push({ at: at(prop), file, text: written(name.expression) });
    } else {
      unread.push({ at: at(prop), file, text: written(prop) });
    }
  }
  return out;
}

/** What one file writes. */
function scan(source: ts.SourceFile): { writes: Write[]; unread: Unread[]; calls: number; messages: number } {
  const file = relative(ROOT, source.fileName);
  const writes: Write[] = [];
  const unread: Unread[] = [];
  let calls = 0;
  let messages = 0;

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const declaration = checker.getResolvedSignature(node)?.declaration;
      const method = declaration ? METHODS.get(declaration) : undefined;
      const [arg] = node.arguments;
      if (method && arg) {
        calls++;
        if (method === 'set') {
          const paths = pathsOf(arg);
          if (paths) for (const path of paths) writes.push({ at: at(node), path });
          else unread.push({ at: at(arg), file, text: written(arg) });
        } else {
          for (const k of keysOf(arg, unread, file)) writes.push({ at: at(k.node), path: k.path });
        }
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const prop = (name: string): ts.PropertyAssignment | ts.ShorthandPropertyAssignment | undefined =>
        node.properties.find(
          (p): p is ts.PropertyAssignment | ts.ShorthandPropertyAssignment =>
            (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
            ts.isIdentifier(p.name) &&
            p.name.text === name,
        );
      const type = prop('type');
      const patch = prop('patch');
      if (
        type &&
        ts.isPropertyAssignment(type) &&
        ts.isStringLiteral(type.initializer) &&
        (type.initializer.text === 'request-change' || type.initializer.text === 'complete-onboarding') &&
        patch
      ) {
        messages++;
        const value = ts.isPropertyAssignment(patch) ? patch.initializer : patch.name;
        for (const k of keysOf(value, unread, file)) writes.push({ at: at(k.node), path: k.path });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { writes, unread, calls, messages };
}

function scanAll(names: string[]) {
  const writes: Write[] = [];
  const unread: Unread[] = [];
  let calls = 0;
  let messages = 0;
  for (const name of names) {
    const source = program.getSourceFile(name);
    if (!source) throw new Error(`${relative(ROOT, name)} is not in the program`);
    const found = scan(source);
    writes.push(...found.writes);
    unread.push(...found.unread);
    calls += found.calls;
    messages += found.messages;
  }
  return { writes, unread, calls, messages };
}

/** What every page writes, the dynamic writes resolved through `DYNAMIC`. */
const pages = everything.filter((f) => f.startsWith(UI) && !f.endsWith('.d.ts'));
const PAGES = scanAll(pages);
const RESOLVED: Write[] = [
  ...PAGES.writes,
  ...PAGES.unread.flatMap((u) => {
    const entry = DYNAMIC.find((d) => d.file === u.file && d.text === u.text);
    return entry ? entry.paths.map((path) => ({ at: u.at, path })) : [];
  }),
];

const GOVERNED = new Set(GOVERNED_PATHS.map((g) => g.path));
const judged = (path: string) => GOVERNED.has(path) || Object.hasOwn(NEUTRAL, path);

/* ------------------------------------------------------------ the checks */

describe('the reader of what a page writes', () => {
  test('refuses a write nobody named, and one it cannot see through, on every run', () => {
    const probe = scanAll([PROBE]);
    assert.deepEqual(
      probe.writes.map((w) => w.path).filter((p) => !judged(p)),
      ['weave.somethingNobodyNamed', 'friction.alsoUnnamed'],
    );
    assert.deepEqual(probe.unread.map((u) => u.text), ['x']);
  });

  test('reads enough of the pages to mean something', () => {
    const paths = new Set(RESOLVED.map((w) => w.path));
    assert.ok(PAGES.calls >= 45, `only ${PAGES.calls} calls to the controller's set and setMany were read`);
    assert.ok(PAGES.messages >= 2, `only ${PAGES.messages} request-change or complete-onboarding patches were read`);
    assert.ok(paths.size >= 50, `only ${paths.size} distinct paths were read`);
    // The template is expanded, not skipped: all seven letterforms are written.
    assert.equal([...paths].filter((p) => p.startsWith('weave.letterforms.')).length, 7);
  });
});

describe('every settings path a page writes', () => {
  test('is governed by the lock, or named neutral with why', () => {
    const loose = RESOLVED.filter((w) => !judged(w.path)).map((w) => `${w.at} writes ${w.path}`);
    assert.deepEqual(loose, [], 'paths the lock calls neutral without anyone saying so');
  });

  test('is read, or named in DYNAMIC with every path it can be', () => {
    const blind = PAGES.unread
      .filter((u) => !DYNAMIC.some((d) => d.file === u.file && d.text === u.text))
      .map((u) => `${u.at} writes through \`${u.text}\``);
    assert.deepEqual(blind, []);
  });

  test('is never both governed and neutral', () => {
    assert.deepEqual(Object.keys(NEUTRAL).filter((p) => GOVERNED.has(p)), []);
  });
});

describe('the tables', () => {
  test('name nothing no page writes', () => {
    const paths = new Set(RESOLVED.map((w) => w.path));
    assert.deepEqual(Object.keys(NEUTRAL).filter((p) => !paths.has(p)), [], 'NEUTRAL names a path no page writes');
    const stale = DYNAMIC.filter((d) => !PAGES.unread.some((u) => u.file === d.file && u.text === d.text));
    assert.deepEqual(stale.map((d) => `${d.file}: ${d.text}`), [], 'DYNAMIC names a write no page makes');
  });

  test('list each dynamic path as the page itself writes it', () => {
    for (const d of DYNAMIC) {
      if (d.text.includes('preset')) {
        assert.deepEqual(d.paths, PRESET_PATHS);
        continue;
      }
      const text = readFileSync(join(ROOT, d.file), 'utf8');
      for (const path of d.paths) {
        assert.ok(text.includes(`'${path}'`), `${d.file} does not write ${path} as a literal`);
      }
    }
  });
});
