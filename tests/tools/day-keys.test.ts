/**
 * A day key is stepped by the calendar, never by 86 400 000. A day is 25
 * hours long on the night the clocks go back and 23 on the night they go
 * forward, so `dayKey(now - i * 86_400_000)` lands twice in one day or skips
 * one, at the 4 a.m. rollover, for an hour of every day the changed day is
 * still in the span being stepped. `attentionSummary` did exactly that until
 * 2026-10-25, and `tests/core/day-arithmetic.test.ts` holds it there, under
 * `TZ=Europe/London`; `shiftDay()`, which steps a key on the calendar in UTC,
 * says the rest in a sentence of its doc comment. Until 2026-11-01 nothing
 * refused the same call typed into a new function, which passes every check
 * but at the hour of a clock change.
 *
 * So the checker is asked for every call that runs `src/core/escalation.ts`'s
 * `dayKey`, in every file under `src/`, however it was reached — by its own
 * name, an alias, a re-export or a namespace — and a call whose instant does
 * arithmetic is refused: a numeric `+` or `-` in its first argument, or in
 * the value of a `const` that argument names. `dayKey` takes the instant as
 * read; stepping the key it returns is `shiftDay()`'s. A reference to
 * `dayKey` that is neither called, imported nor exported is refused too,
 * because `stamps.map(dayKey)` calls it with arguments no check can read.
 *
 * Not refused: an index, `stamps[stamps.length - 1]`, which picks a stored
 * instant rather than stepping one; a `+` that joins strings; a property of
 * a `const` object, whose other properties are not the instant; and the
 * rollover hour, the second argument. `tests/` is left out:
 * `tests/core/stats.test.ts` steps by 24 hours from a fixed noon in
 * September, which no clock change reaches, and `day-arithmetic.test.ts`
 * subtracts a day on purpose, to show the hazard.
 *
 * The check reads calls, as core-purity's reads names: it is a guard against
 * reaching for the arithmetic by habit, not against hiding it. A `let`
 * assigned the step in a statement of its own, a wrapper `(t) => dayKey(t)`,
 * or a `new Date(now - n * DAY)` formatted by hand escapes it. The durations
 * `fsrs.ts`, `prune.ts`, `licence.ts` and the providers' cache measure in
 * milliseconds are right as they are: a change of the clocks lengthens no
 * duration, only a day.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const ESCALATION = join(SRC, 'core/escalation.ts');

interface Refusal {
  /** Where, as `src/<file>:<line>`. */
  at: string;
  what: string;
}

/** A numeric `+` or `-`, or its compound assignment: what stepping an instant takes. */
const STEPS = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
]);

function at(node: ts.Node): string {
  const file = node.getSourceFile();
  const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  return `${relative(ROOT, file.fileName)}:${line}`;
}

const written = (node: ts.Node): string => node.getText().replace(/\s+/g, ' ');

/** Whether a call runs escalation.ts's `dayKey`, however its callee was reached. */
function isDayKeyCall(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && checker.getResolvedSignature(node)?.declaration === DAY_KEY;
}

/** What a name refers to, through any alias or re-export. */
function resolved(node: ts.Identifier): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  return symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** The name and value of the project's own `const` a name refers to, or null. */
function constValue(node: ts.Identifier): { name: string; value: ts.Expression } | null {
  const decl = resolved(node)?.valueDeclaration;
  if (!decl || !ts.isVariableDeclaration(decl) || !ts.isIdentifier(decl.name) || !decl.initializer) return null;
  // A `const` has one value, its initializer; a `let`'s is wherever it was last assigned.
  if (!(ts.getCombinedNodeFlags(decl) & ts.NodeFlags.Const)) return null;
  if (!decl.getSourceFile().fileName.startsWith(`${SRC}/`)) return null;
  return { name: decl.name.text, value: decl.initializer };
}

/** Whether a name stands for its own value, rather than an object something is read off or a function called. */
function standsForValue(node: ts.Identifier): boolean {
  const p = node.parent;
  if ((ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p)) && p.expression === node) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return false;
  return !(ts.isCallExpression(p) && p.expression === node);
}

/** Whether a `+` or `-` is arithmetic: a `+` that joins strings writes text. */
function numeric(node: ts.Expression): boolean {
  return (checker.getTypeAtLocation(node).flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.Any)) !== 0;
}

interface Step {
  step: ts.BinaryExpression;
  /** The `const` the step was found in the value of, when it was not written in the call. */
  through?: string;
}

/** The arithmetic an instant's expression does, following each `const` it names to its value. */
function stepsIn(expression: ts.Node, through?: string, seen = new Set<ts.Node>()): Step[] {
  const found: Step[] = [];
  const visit = (node: ts.Node): void => {
    // An index picks which stored instant is read; it steps none.
    if (ts.isElementAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isBinaryExpression(node) && STEPS.has(node.operatorToken.kind) && numeric(node)) {
      found.push({ step: node, through });
    }
    if (ts.isIdentifier(node) && standsForValue(node)) {
      const constant = constValue(node);
      if (constant && !seen.has(constant.value)) {
        seen.add(constant.value);
        found.push(...stepsIn(constant.value, through ?? constant.name, seen));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

/** Every call that steps the instant it hands `dayKey`, and the step. */
function steppedCalls(file: ts.SourceFile): Refusal[] {
  const found: Refusal[] = [];
  const visit = (node: ts.Node): void => {
    if (isDayKeyCall(node)) {
      const instant = node.arguments[0];
      const [first] = instant ? stepsIn(instant) : [];
      if (first) {
        const via = first.through ? `, the value of ${first.through}` : '';
        found.push({ at: at(node), what: `${written(node)} steps ${written(first.step)}${via}` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Whether a reference to `dayKey` only names it: declares, imports, exports or calls it, or reads its type. */
function onlyNames(node: ts.Identifier): boolean {
  const p = node.parent;
  if (ts.isFunctionDeclaration(p) && p.name === node) return true;
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) return true;
  if (ts.isCallExpression(p) && p.expression === node) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === node && ts.isCallExpression(p.parent) && p.parent.expression === p) {
    return true;
  }
  // `typeof dayKey`, which the build erases.
  for (let n: ts.Node = node; n.parent; n = n.parent) if (ts.isTypeNode(n.parent)) return true;
  return false;
}

/** Every reference to `dayKey` that is neither called, imported nor exported. */
function handedOn(file: ts.SourceFile): Refusal[] {
  const found: Refusal[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && resolved(node)?.declarations?.includes(DAY_KEY) && !onlyNames(node)) {
      found.push({ at: at(node), what: `${node.text}, handed on in ${written(node.parent)}` });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** How many calls a file makes to `dayKey`, so a blind resolver cannot pass for a clean tree. */
function callsTo(file: ts.SourceFile): number {
  let calls = 0;
  const visit = (node: ts.Node): void => {
    if (isDayKeyCall(node)) calls++;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return calls;
}

/* ------------------------------------------------------------ the probes */

/**
 * Two files that are never on disk, so the check is shown to fire every time
 * it runs rather than once on the day it was written. The relay re-exports
 * `dayKey` under another name, as a barrel would.
 */
const RELAY = join(SRC, 'background/__day-key-relay__.ts');
const RELAY_TEXT = "export { dayKey as relayed } from '../core/escalation.ts';\n";

const PROBE = join(SRC, 'background/__day-key-probe__.ts');
const PROBE_TEXT = [
  "import { dayKey, dayKey as key, shiftDay } from '../core/escalation.ts';",
  "import * as escalation from '../core/escalation.ts';",
  "import { relayed } from './__day-key-relay__.ts';",
  'declare const now: number;',
  'declare const i: number;',
  'declare const stamps: number[];',
  'declare const day: string;',
  'const DAY = 86_400_000;',
  '// dayKey(now - 86_400_000) is named in this comment, and in a string below.',
  'export const today = dayKey(now, 4);',
  'export const yesterday = dayKey(now - 86_400_000, 4);',
  'export const stepped = dayKey(now - i * DAY);',
  'export const ahead = dayKey(now + DAY);',
  'export const aliased = key(now - DAY);',
  'export const named = escalation.dayKey(now - DAY);',
  'export const relayedCall = relayed(now - DAY);',
  'const before = now - DAY;',
  'export const hoisted = dayKey(before);',
  'let moved = now;',
  'export const compound = dayKey((moved -= DAY));',
  'export const days = stamps.map(dayKey);',
  'export const bound = dayKey.bind(null);',
  'export const last = dayKey(stamps[stamps.length - 1] ?? now);',
  "export const noon = dayKey(Date.parse(day + 'T12:00'));",
  'const span = { at: now, back: now - DAY };',
  'export const read = dayKey(span.at);',
  'export const rolled = dayKey(now, 4 - 1);',
  'export const shifted = shiftDay(dayKey(now), -1);',
  "export const spelt = 'dayKey(now - 86_400_000)';",
  'export type Keyer = typeof dayKey;',
  'export const own = ((dayKey: (t: number) => string) => dayKey(now - DAY))(String);',
].join('\n');

const PROBES: Record<string, string> = { [RELAY]: RELAY_TEXT, [PROBE]: PROBE_TEXT };

/* ------------------------------------------------------------ the program */

const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  },
});
if (!config) throw new Error('tsconfig.json did not parse');

const host = ts.createCompilerHost(config.options, true);
const readSource = host.getSourceFile.bind(host);
host.getSourceFile = (name, version, ...rest) => {
  const probe = PROBES[name];
  return probe !== undefined ? ts.createSourceFile(name, probe, version, true) : readSource(name, version, ...rest);
};
// Module resolution asks whether a file exists, not for its source, so the
// probe's import of the relay resolves only if the host says it is there.
const exists = host.fileExists.bind(host);
host.fileExists = (name) => Object.hasOwn(PROBES, name) || exists(name);
const read = host.readFile.bind(host);
host.readFile = (name) => PROBES[name] ?? read(name);

// Every file the build compiles, and the project's own declarations beside them.
const everything = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => join(SRC, f))
  .sort();
const files = everything.filter((f) => !f.endsWith('.d.ts'));
const program = ts.createProgram([...everything, ...Object.keys(PROBES)], config.options, host);
const checker = program.getTypeChecker();

function source(name: string): ts.SourceFile {
  const file = program.getSourceFile(name);
  if (!file) throw new Error(`${relative(ROOT, name)} is not in the program`);
  return file;
}

// Read once, so a renamed or moved dayKey fails here rather than every test
// below passing on a resolver that matches nothing.
const DAY_KEY: ts.FunctionDeclaration = ((): ts.FunctionDeclaration => {
  const found = source(ESCALATION).statements.find(
    (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'dayKey',
  );
  if (!found) throw new Error('src/core/escalation.ts declares no function dayKey');
  return found;
})();

/* ------------------------------------------------------------ the tests */

describe('the day-key check', () => {
  test('compiles its probes, so each call in them resolves as the build would resolve it', () => {
    const problems = Object.keys(PROBES).flatMap((name) =>
      [...program.getSyntacticDiagnostics(source(name)), ...program.getSemanticDiagnostics(source(name))].map(
        (d) => `${relative(ROOT, name)}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`,
      ),
    );
    assert.deepEqual(problems, []);
  });

  test('finds every call that steps the instant it hands dayKey, however dayKey was reached', () => {
    // Not `today`, the index, the joined string, the object's other property,
    // the rollover hour or `shiftDay`, which take the instant as read; not the
    // comment, the string or the type; and not a parameter named `dayKey`,
    // which is the function's own.
    assert.deepEqual(
      steppedCalls(source(PROBE)).map((r) => r.what),
      [
        'dayKey(now - 86_400_000, 4) steps now - 86_400_000',
        'dayKey(now - i * DAY) steps now - i * DAY',
        'dayKey(now + DAY) steps now + DAY',
        'key(now - DAY) steps now - DAY',
        'escalation.dayKey(now - DAY) steps now - DAY',
        'relayed(now - DAY) steps now - DAY',
        'dayKey(before) steps now - DAY, the value of before',
        'dayKey((moved -= DAY)) steps moved -= DAY',
      ],
    );
  });

  test('says where each is, by file and line', () => {
    const at = steppedCalls(source(PROBE)).map((r) => r.at);
    assert.equal(at[0], 'src/background/__day-key-probe__.ts:11');
    assert.equal(at.at(-1), 'src/background/__day-key-probe__.ts:20');
  });

  test('finds every reference to dayKey that is neither called, imported nor exported', () => {
    assert.deepEqual(
      handedOn(source(PROBE)).map((r) => `${r.at} ${r.what}`),
      [
        'src/background/__day-key-probe__.ts:21 dayKey, handed on in stamps.map(dayKey)',
        'src/background/__day-key-probe__.ts:22 dayKey, handed on in dayKey.bind',
      ],
    );
    assert.deepEqual(handedOn(source(RELAY)), [], 'a re-export only names dayKey');
  });
});

describe('src/', () => {
  test('hands dayKey the instant as read, and steps a key only with shiftDay()', () => {
    // A floor, so a checker that resolves no call cannot pass for a tree that
    // makes none.
    const calls = files.reduce((n, f) => n + callsTo(source(f)), 0);
    assert.ok(files.length >= 50, `only ${files.length} files were found in src/`);
    assert.ok(calls >= 7, `only ${calls} calls to dayKey were found in src/`);
    assert.deepEqual(
      files.flatMap((f) => steppedCalls(source(f))).map((r) => `${r.at} ${r.what}`),
      [],
      'a day is 25 hours long on the night the clocks go back and 23 on the night they go ' +
        'forward, so a day key is stepped by the calendar, never by 86 400 000 (CLAUDE.md): ' +
        'hand dayKey the instant as read, and step the key it returns with shiftDay()',
    );
  });

  test('calls dayKey wherever it names it, so every instant it is given can be read', () => {
    assert.deepEqual(
      files.flatMap((f) => handedOn(source(f))).map((r) => `${r.at} ${r.what}`),
      [],
      'a reference to dayKey handed to another function is called with arguments this check ' +
        'cannot read: call it with the instant, (t) => dayKey(t), where the instant is in sight',
    );
  });
});
