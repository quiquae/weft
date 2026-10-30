/**
 * Every action a workflow uses runs on the Node GitHub's runners run.
 * GitHub deprecated Node 20 for actions on 2025-09-19, made Node 24 the
 * runners' default on 2026-06-16 and removed Node 20 from them on
 * 2026-09-23, the dates its changelog's editor's notes give
 * (github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners,
 * read 2026-10-30). An action whose action.yml still says `using: node20`
 * runs all the same, forced onto 24, and every job that uses one ends on a
 * warning naming it: both of ci.yml's jobs did until 2026-10-30.
 *
 * So the first major of each action to run on 24 is written down, in
 * `RUNTIME`, beside where it was read: the action's own action.yml at that
 * major's first release. A composite action runs on the Node of the actions
 * it uses, so upload-pages-artifact's is read through to upload-artifact's.
 * An action `RUNTIME` does not name fails, so a new one is read before it is
 * used, and a ref this reader cannot take a major from fails rather than
 * being guessed at.
 *
 * release.yml is held back on purpose. It publishes, fires once on a tag and
 * cannot be rehearsed, so it moves in a release somebody watches, not in a
 * pass nobody does. `HELD` names its lines, and fails once they move, so the
 * hold cannot outlive the bump.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOWS = '.github/workflows';

/** The first major of each action whose runtime is Node 24, and where that was read, on 2026-10-30. */
const RUNTIME: Record<string, { node24: number; read: string }> = {
  'actions/checkout': { node24: 5, read: 'action.yml at v5.0.0 says "using: node24", at v4.0.0 node20' },
  'actions/setup-node': { node24: 5, read: 'action.yml at v5.0.0 says "using: node24", at v4.0.0 node20' },
  'actions/upload-artifact': {
    node24: 6,
    read: 'action.yml at v6.0.0 says "using: node24"; v5.0.0 still says node20, its release calling 24 preliminary',
  },
  'actions/upload-pages-artifact': {
    node24: 5,
    read: 'composite; v5.0.0 uses upload-artifact v7.0.0, v4.0.0 uses v4.6.2, which is node20',
  },
  'actions/deploy-pages': { node24: 5, read: 'action.yml at v5.0.0 says "using: node24", at v4.0.0 node20' },
  'softprops/action-gh-release': { node24: 3, read: 'action.yml at v3.0.0 says "using: node24", at v2 node20' },
};

/** Workflow lines that stay below Node 24, each for the reason beside it. */
const HELD: { file: string; action: string; why: string }[] = [
  'actions/checkout',
  'actions/setup-node',
  'softprops/action-gh-release',
].map((action) => ({
  file: 'release.yml',
  action,
  why: 'release.yml publishes, fires once on a tag and cannot be rehearsed, so it moves at B2 in TODO.md',
}));

interface Use {
  file: string;
  line: number;
  action: string;
  major: number;
  ref: string;
}

/**
 * Every `uses:` in a workflow, read for the shape this repository writes:
 * `owner/repo@vN`, or `@vN.N.N`, quoted or not, a comment after it allowed.
 * A commit SHA, a branch, a docker image, a local action or an action in a
 * subdirectory throws, naming its line, rather than being read as no action
 * or as the wrong major.
 */
function usesIn(file: string, text: string): Use[] {
  const out: Use[] = [];
  text.split('\n').forEach((raw, i) => {
    const m = /^\s*(?:-\s+)?uses:\s*(.*?)\s*$/.exec(raw);
    if (!m) return;
    const value = (m[1] ?? '').replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2');
    const at = /^([\w.-]+\/[\w.-]+)@(v(\d+)(?:\.\d+){0,2})$/.exec(value);
    if (!at) throw new Error(`${file}:${i + 1}: cannot read "uses: ${m[1]}"`);
    out.push({ file, line: i + 1, action: at[1] as string, ref: at[2] as string, major: Number(at[3]) });
  });
  return out;
}

const files = readdirSync(join(ROOT, WORKFLOWS))
  .filter((file) => /\.ya?ml$/.test(file))
  .sort();
const uses = files.flatMap((file) => usesIn(file, readFileSync(join(ROOT, WORKFLOWS, file), 'utf8')));
const where = (use: Use): string => `${use.file}:${use.line} ${use.action}@${use.ref}`;
const below = (use: Use): boolean => use.major < (RUNTIME[use.action]?.node24 ?? Infinity);

describe('the actions the workflows use', () => {
  test('every action is one RUNTIME has read', () => {
    // 13 on 2026-10-30. A reader that found nothing would pass every rule here.
    assert.ok(uses.length >= 10, `only ${uses.length} uses: lines were read from ${files.join(', ')}`);
    const unread = uses.filter((use) => !RUNTIME[use.action]).map(where);
    assert.deepEqual(unread, [], 'read which major of each first says "using: node24" in its action.yml, and write it in RUNTIME');
  });

  test('every action runs on Node 24, but the lines HELD names', () => {
    const old = uses
      .filter((use) => RUNTIME[use.action] && below(use))
      .filter((use) => !HELD.some((h) => h.file === use.file && h.action === use.action))
      .map((use) => {
        const { node24, read } = RUNTIME[use.action] as { node24: number; read: string };
        return `${where(use)} runs on Node 20, forced onto 24: v${node24} is its first on 24 (${read})`;
      });
    assert.deepEqual(old, []);
  });

  test('HELD names only lines a workflow still has below Node 24', () => {
    const stale = HELD.filter((h) => !uses.some((use) => use.file === h.file && use.action === h.action && below(use)));
    assert.deepEqual(
      stale.map((h) => `${h.file} ${h.action}`),
      [],
      'these have moved to Node 24, so HELD no longer needs to excuse them',
    );
  });
});

describe('the uses: reader', () => {
  test('reads the shapes the workflows write, and refuses others', () => {
    assert.deepEqual(usesIn('x.yml', 'steps:\n      - uses: actions/checkout@v7\n'), [
      { file: 'x.yml', line: 2, action: 'actions/checkout', ref: 'v7', major: 7 },
    ]);
    assert.equal(usesIn('x.yml', '        uses: actions/upload-artifact@v7.0.2 # pinned')[0]?.major, 7);
    assert.equal(usesIn('x.yml', "      - uses: 'actions/setup-node@v5'")[0]?.action, 'actions/setup-node');
    assert.deepEqual(usesIn('x.yml', '      # - uses: actions/checkout@v4\n      - run: npm ci'), []);
    for (const shape of [
      'actions/checkout@3d3c42e5aac5c3f2e4e5c7a9b0d1e2f3a4b5c6d7',
      'actions/checkout@main',
      'docker://alpine:3.20',
      './.github/actions/local',
      'github/codeql-action/init@v3',
    ]) {
      assert.throws(() => usesIn('x.yml', `      - uses: ${shape}`), /x\.yml:1: cannot read/, shape);
    }
  });
});
