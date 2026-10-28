/**
 * The Node floor `package.json` states is the toolchain's. `engines.node`
 * said `>=20` until 2026-10-28, and nothing in the tree ran there: the test
 * scripts pass `--experimental-strip-types`, which Node added in 22.6.0, and
 * `build.mjs` and most tools import TypeScript with no flag, which Node does
 * by default only from 22.18.0 on the 22 line and from 23.6.0 on the 23.
 * Measured on 2026-10-28 in a copy of the tree, `npm run build:all` and
 * `npm test`: 20.20.2 refuses the flag; 22.17.1 builds nothing, and passes
 * 447 of the 481 tool tests, four failing and thirty cancelled where a test
 * spawns a tool with no flag; 23.5.0 the same; 22.18.0 and 23.6.1 pass both.
 *
 * So the range is derived, not typed. Each script's `node` commands are
 * read, each entry file's imports are followed through the tree, and a
 * command needs what the first TypeScript file it reaches needs: the flag if
 * it passes the flag, Node's default if it does not. A test file that spawns
 * this Node again needs the same of its child, which does not inherit its
 * parent's flags. Every package the lockfile installs adds its own range. A
 * version runs the toolchain when it meets all of them, and `engines.node`
 * must admit exactly the versions in `PROBES` that do: none that cannot, so
 * the floor is never a promise, and every one that can, so it is never
 * raised without a reason written here.
 *
 * What the derivation cannot see is an API: a tool, or a dependency, calling
 * something newer than the floor passes here and wherever the newest 22
 * runs. So one job in CI runs on the floor itself, read from `engines.node`
 * rather than typed, and runs every command the other jobs run that needs no
 * browser, read from `ci.yml` and `package.json`'s scripts, so a step added
 * to `check` reaches the floor or fails this file by name.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

const STRIP_FLAG = '--experimental-strip-types';

/** What Node can do with TypeScript, by release, from its changelogs. */
const NODE = {
  /** v22.6.0 added the flag, and every 23 has it. */
  flagged: '^22.6.0 || >=23.0.0',
  /** v22.18.0 and v23.6.0 strip types with no flag. */
  unflagged: '^22.18.0 || >=23.6.0',
};

/**
 * Real releases either side of every line above, the five measured, and the
 * Node this repository's journal records its runs on.
 */
const PROBES = [
  '18.20.8', '20.19.0', '20.20.2', '21.7.3', '22.5.1', '22.6.0', '22.17.1',
  '22.18.0', '23.5.0', '23.6.1', '24.0.0', '26.7.0',
];

type Version = [number, number, number];

function version(text: string): Version {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(text);
  if (!m) throw new Error(`cannot read the version "${text}"`);
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

const compare = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Whether `v` meets `range`, for the shapes npm's ranges take here: `||`
 * between sets, spaces between comparators, and `>=`, `>`, `<=`, `<` or `^`
 * before a version, which only `>=` may write in part (`>=18`). Any other
 * shape throws, naming itself, so a new one fails this test rather than
 * being guessed at.
 */
function satisfies(v: string, range: string): boolean {
  const at = version(v);
  // Every set and comparator is read before any is believed, so an
  // unreadable one throws even beside one that matches.
  const sets = range.split('||').map((set) =>
    set
      .trim()
      .replace(/(>=|<=|>|<|\^)\s+/g, '$1')
      .split(/\s+/)
      .map((comparator) => {
        const m = /^(>=|<=|>|<|\^)(v?\d+(?:\.\d+){0,2})$/.exec(comparator);
        if (!m) throw new Error(`cannot read "${comparator}" in the range "${range}"`);
        const [, op = '', bound = ''] = m;
        const to = version(bound);
        if (op !== '>=' && !/^v?\d+\.\d+\.\d+$/.test(bound)) {
          throw new Error(`"${comparator}" in "${range}" names a partial version, which only >= reads here`);
        }
        if (op === '^' && to[0] === 0) throw new Error(`"${comparator}" in "${range}" is a caret on 0.x`);
        const d = compare(at, to);
        if (op === '>=') return d >= 0;
        if (op === '>') return d > 0;
        if (op === '<=') return d <= 0;
        if (op === '<') return d < 0;
        return d >= 0 && at[0] === to[0];
      }),
  );
  return sets.some((set) => set.every(Boolean));
}

const TYPESCRIPT = new Set(['.ts', '.tsx', '.mts', '.cts']);

/**
 * The first TypeScript file `entry` reaches through its relative imports,
 * static and literal dynamic alike, as the path there; null if none.
 */
function typescriptReached(entry: string, seen = new Set<string>()): string[] | null {
  if (TYPESCRIPT.has(extname(entry))) return [entry];
  if (seen.has(entry)) return null;
  seen.add(entry);
  for (const { fileName } of ts.preProcessFile(read(entry), true, true).importedFiles) {
    if (!fileName.startsWith('.')) continue;
    const next = relative(ROOT, join(ROOT, dirname(entry), fileName));
    if (!existsSync(join(ROOT, next))) throw new Error(`${entry} imports ${fileName}, which is not in the tree`);
    const path = typescriptReached(next, seen);
    if (path) return [entry, ...path];
  }
  return null;
}

/** The files a `node --test` argument names: a path, or a `*` within one directory. */
function testFiles(pattern: string): string[] {
  if (!pattern.includes('*')) return [pattern];
  const dir = dirname(pattern);
  const glob = pattern.slice(dir.length + 1).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const base = new RegExp(`^${glob}$`);
  return readdirSync(join(ROOT, dir)).filter((name) => base.test(name)).map((name) => join(dir, name));
}

/**
 * Each place a test file runs this Node again — `spawn`, `spawnSync`,
 * `execFile` or `execFileSync` on `process.execPath` — with the flags it
 * passes and the file it runs: a quoted path in the arguments, or the
 * `const` the arguments open with.
 */
function spawned(testFile: string): { flags: string[]; entry: string }[] {
  const text = read(testFile);
  return [...text.matchAll(/\b(?:spawn|spawnSync|execFile|execFileSync)\(\s*process\.execPath\s*,\s*\[([^\]]*)\]/g)].map(
    ([call, args = '']) => {
      const flags = args.includes(`'${STRIP_FLAG}'`) ? [STRIP_FLAG] : [];
      const name = /^\s*(?:'[^']*'\s*,\s*)*([A-Za-z_$][\w$]*)/.exec(args)?.[1];
      const entry =
        /'([^']+\.(?:m?js|ts))'/.exec(args)?.[1] ??
        (name ? new RegExp(`const ${name}\\s*=[^;]*'([^']+\\.(?:m?js|ts))'`).exec(text)?.[1] : undefined);
      if (!entry) throw new Error(`${testFile}: cannot tell what ${call.split('\n')[0]}… runs`);
      return { flags, entry };
    },
  );
}

interface Need {
  /** The script, and the test file when the need is a child it spawns. */
  where: string;
  /** The Node range it needs, and why. */
  range: string;
  why: string;
}

/** What one `node` command needs of the Node running it. */
function commandNeed(where: string, flags: string[], entry: string): Need | null {
  const path = typescriptReached(entry);
  if (!path) return null;
  const flagged = flags.includes(STRIP_FLAG);
  return {
    where,
    range: flagged ? NODE.flagged : NODE.unflagged,
    why: `${path.join(' → ')} is TypeScript, run ${flagged ? `with ${STRIP_FLAG}` : 'with no flag'}`,
  };
}

/** Every `node` command in a script: its flags and its first argument that is not one. */
function nodeCommands(script: string): { flags: string[]; entry: string }[] {
  return script.split(/&&|\|\||;|\|/).flatMap((command) => {
    const words = command.trim().split(/\s+/).map((w) => w.replace(/^"(.*)"$/, '$1'));
    if (words[0] !== 'node') return [];
    const at = words.findIndex((w, i) => i > 0 && !w.startsWith('-'));
    const entry = words[at];
    if (at === -1 || !entry) throw new Error(`"${command.trim()}" runs node on no file`);
    return [{ flags: words.slice(1, at), entry }];
  });
}

/** Everything the toolchain needs of Node: each script's commands, their tests' children, and each package. */
function needs(): Need[] {
  const out: Need[] = [];
  for (const [name, script] of Object.entries(pkg.scripts as Record<string, string>)) {
    for (const { flags, entry } of nodeCommands(script)) {
      const files = flags.includes('--test') ? testFiles(entry) : [entry];
      for (const file of files) {
        const need = commandNeed(`npm run ${name}`, flags, file);
        if (need) out.push(need);
        if (!flags.includes('--test')) continue;
        for (const child of spawned(file)) {
          const childNeed = commandNeed(`npm run ${name}, ${file}`, child.flags, child.entry);
          if (childNeed) out.push(childNeed);
        }
      }
    }
  }
  for (const [key, entry] of Object.entries(lock.packages as Record<string, { engines?: { node?: string } }>)) {
    const range = entry.engines?.node;
    if (key && range) out.push({ where: key.replace(/^.*node_modules\//, ''), range, why: 'its engines.node' });
  }
  return out;
}

/**
 * The lowest version `range` admits: the least of the versions it names
 * that it admits. A floor it does not name, as `>22.18.0` has, throws.
 */
function floorOf(range: string): string {
  const named = [...range.matchAll(/v?\d+(?:\.\d+){0,2}/g)].map(([text]) => version(text)).sort(compare);
  const lowest = named.find((v) => satisfies(v.join('.'), range));
  if (!lowest) throw new Error(`"${range}" admits none of the versions it names, so its floor cannot be read`);
  return lowest.join('.');
}

const WORKFLOW = '.github/workflows/ci.yml';

interface Job {
  name: string;
  /** What the job hands actions/setup-node as `node-version`, as written. */
  node: string | null;
  /** Each command its `run:` steps run, a line of a `|` block apiece. */
  commands: string[];
}

/**
 * A workflow's jobs, read for the shapes ci.yml writes: each job two spaces
 * in under `jobs:`, `node-version:` under a step's `with:`, and `run:` as a
 * plain value or a `|` block. Any other `run:` throws, naming its line, so a
 * new shape fails this test rather than being read as no command at all.
 */
function workflowJobs(path: string): Job[] {
  const lines = read(path).split('\n');
  const start = lines.indexOf('jobs:');
  if (start === -1) throw new Error(`${path} has no "jobs:" to read`);
  const jobs: Job[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^[^\s#]/.test(line)) break;
    const name = /^ {2}([\w-]+):\s*$/.exec(line)?.[1];
    if (name) {
      jobs.push({ name, node: null, commands: [] });
      continue;
    }
    const job = jobs.at(-1);
    if (!job || /^\s*(?:#.*)?$/.test(line)) continue;
    const node = /^\s+node-version:\s*(.*?)\s*$/.exec(line)?.[1];
    if (node !== undefined) {
      job.node = node.replace(/^(['"])(.*)\1$/, '$2');
      continue;
    }
    const run = /^(\s+(?:- )?)run:\s*(.*?)\s*$/.exec(line);
    if (!run) continue;
    const [, lead = '', value = ''] = run;
    if (value === '|' || value === '|-') {
      while (i + 1 < lines.length) {
        const next = lines[i + 1] ?? '';
        if (next.trim() && next.search(/\S/) <= lead.length) break;
        if (next.trim()) job.commands.push(next.trim());
        i++;
      }
    } else if (/^[^\s>|"'[{&*!#]/.test(value)) {
      job.commands.push(value.replace(/\s+#.*$/, ''));
    } else {
      throw new Error(`${path}:${i + 1}: cannot read "run: ${value}"`);
    }
  }
  return jobs;
}

/**
 * Whether a command starts Playwright, which needs a browser, itself or
 * through a script it runs: `npx playwright install` does, `npm run
 * test:e2e` does through its script, and `npm test` does not.
 */
function needsBrowser(command: string, seen = new Set<string>()): boolean {
  return command.split(/&&|\|\||;|\|/).some((part) => {
    const words = part.trim().split(/\s+/);
    if (words.includes('playwright')) return true;
    if (words[0] !== 'npm') return false;
    const script = words[1] === 'run' || words[1] === 'run-script' ? words[2] : words[1] === 'test' ? 'test' : undefined;
    if (!script || seen.has(script)) return false;
    seen.add(script);
    const body = (pkg.scripts as Record<string, string>)[script];
    if (body === undefined) throw new Error(`"${part.trim()}" runs the script "${script}", which package.json does not have`);
    return needsBrowser(body, seen);
  });
}

describe('the Node floor package.json states', () => {
  const all = needs();
  const unmet = (v: string): Need[] => all.filter((need) => !satisfies(v, need.range));

  test('admits no Node version the toolchain cannot run on', () => {
    const wrong = PROBES.flatMap((v) => {
      const [first, ...rest] = unmet(v);
      if (!first || !satisfies(v, pkg.engines.node)) return [];
      return [`${v}: ${first.where} needs ${first.range}, because ${first.why}${rest.length ? ` (and ${rest.length} more)` : ''}`];
    });
    assert.deepEqual(wrong, [], `engines.node is "${pkg.engines.node}", which admits:\n${wrong.join('\n')}`);
  });

  test('admits every Node version the toolchain runs on', () => {
    const refused = PROBES.filter((v) => !satisfies(v, pkg.engines.node) && !unmet(v).length);
    assert.deepEqual(refused, [], `engines.node is "${pkg.engines.node}", which refuses ${refused.join(', ')}, where every script and package runs`);
  });

  test('the lockfile carries the same engines as package.json', () => {
    // `npm install` rewrites the lockfile's root `engines` from package.json,
    // so an edit to one alone is a dirty tree after the next install, which
    // `npm run release` refuses. `npm ci` never compares them.
    assert.deepEqual(lock.packages[''].engines, pkg.engines);
  });

  test('CLAUDE.md’s setup line quotes the range engines.node states', () => {
    const [, section = ''] = read('CLAUDE.md').split('## How to work here');
    const [setup = ''] = section.split('The commands that matter');
    assert.ok(setup.trim(), 'CLAUDE.md has no "## How to work here" paragraph to read');
    assert.ok(setup.includes(`\`${pkg.engines.node}\``), `the setup paragraph does not quote \`${pkg.engines.node}\`:\n${setup.trim()}`);
  });

  test('the derivation finds what the measurement found', () => {
    // On 2026-10-28, 22.17.1 failed `npm run build:all` at build.mjs's import
    // of tests/fixtures/licence-keypair.ts, and `npm test` where
    // tests/tools/build-pack.test.ts, build-site.test.ts and
    // cousins.test.ts spawn their tools with no flag. A reader that stopped
    // finding them would let any floor through.
    const at = (v: string) => unmet(v).map((need) => need.where);
    assert.ok(at('22.17.1').includes('npm run build'), 'build.mjs no longer reads as needing unflagged type stripping');
    for (const file of ['build-pack', 'build-site', 'cousins']) {
      assert.ok(
        at('22.17.1').includes(`npm run test:tools, tests/tools/${file}.test.ts`),
        `tests/tools/${file}.test.ts no longer reads as spawning a TypeScript tool with no flag`,
      );
    }
    assert.ok(at('20.20.2').includes('npm run test:unit'), 'the unit suite no longer reads as needing the flag');
    assert.deepEqual(unmet('22.18.0'), [], 'something in the tree needs more than 22.18.0');
  });
});

describe('the CI job at the floor engines.node states', () => {
  // This file holds engines.node to Node's changelog and to every package's
  // own engines. It cannot see a tool or a dependency reaching for an API
  // newer than the floor, and the check job's `node-version: 22` takes the
  // newest 22, so nothing would; a job on the floor itself can.
  const floor = floorOf(pkg.engines.node);
  const jobs = workflowJobs(WORKFLOW);
  const atFloor = jobs.filter((job) => job.node === floor);
  const others = jobs.filter((job) => job.node !== floor);

  test(`one job in ${WORKFLOW} runs on the floor itself`, () => {
    const by = jobs.map((job) => `${job.name} on ${job.node ?? 'no node-version'}`).join(', ');
    assert.equal(atFloor.length, 1, `engines.node is "${pkg.engines.node}", whose floor is ${floor}; ${by}`);
  });

  test('it runs every command the other jobs run that needs no browser', () => {
    const [job] = atFloor;
    assert.ok(job, `no job runs on ${floor}`);
    const wanted = others.flatMap((other) =>
      other.commands.filter((command) => !needsBrowser(command)).map((command) => ({ from: other.name, command })),
    );
    // 11 on 2026-10-28. A reader that found nothing would pass the rule.
    assert.ok(wanted.length >= 8, `only ${wanted.length} commands were read from the other jobs`);
    const missing = wanted.filter(({ command }) => !job.commands.includes(command));
    assert.deepEqual(
      missing.map(({ from, command }) => `${from}: ${command}`),
      [],
      `the ${job.name} job, on ${floor}, does not run what the other jobs run`,
    );
  });

  test('the reader tells a command that needs a browser from one that does not', () => {
    assert.equal(needsBrowser('npm run test:e2e'), true, 'test:e2e no longer reads as starting Playwright');
    assert.equal(needsBrowser('npx playwright install --with-deps chromium'), true);
    assert.equal(needsBrowser('npm run test:all'), true, 'test:all runs test:e2e');
    assert.equal(needsBrowser('npm test'), false);
    assert.equal(needsBrowser('npm run build:all'), false);
    assert.equal(needsBrowser('git diff --exit-code -- src/lexicon/packs'), false);
    assert.throws(() => needsBrowser('npm run no-such-script'), /does not have/);
  });
});

describe('the range reader', () => {
  test('reads the floor of a range, which it must name', () => {
    assert.equal(floorOf('^22.18.0 || >=23.6.0'), '22.18.0');
    assert.equal(floorOf('>=23.6.0 || ^22.18.0'), '22.18.0');
    assert.equal(floorOf('>=20'), '20.0.0');
    assert.throws(() => floorOf('>22.18.0'), /floor cannot be read/);
  });

  test('reads the shapes the lockfile and package.json use, and refuses others', () => {
    assert.equal(satisfies('22.18.0', '^22.18.0 || >=23.6.0'), true);
    assert.equal(satisfies('22.17.1', '^22.18.0 || >=23.6.0'), false);
    assert.equal(satisfies('23.5.0', '^22.18.0 || >=23.6.0'), false);
    assert.equal(satisfies('24.0.0', '^22.18.0 || >=23.6.0'), true);
    assert.equal(satisfies('20.19.0', '>=20.19.0'), true);
    assert.equal(satisfies('20.18.3', '>=20.19.0'), false);
    assert.equal(satisfies('12.22.7', '>=v12.22.7'), true);
    assert.equal(satisfies('0.4.0', '>= 0.4'), true);
    assert.equal(satisfies('18.0.0', '>=14.17'), true);
    assert.throws(() => satisfies('22.0.0', '22.x'), /cannot read "22\.x"/);
    assert.throws(() => satisfies('22.0.0', '^22'), /partial version/);
    assert.throws(() => satisfies('22.0.0', '1.2.3 - 2.3.4'), /cannot read/);
  });
});
