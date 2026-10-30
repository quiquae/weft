/**
 * Nothing a workflow does leaves the repository unless somebody asked.
 *
 * Two of CLAUDE.md's decisions are about publishing, and until 2026-10-30
 * both were held by a sentence. The content site deploys only on request:
 * site.yml builds and link-checks every push, but its deploy job waits for
 * `vars.WEFT_PAGES == 'true'`, because once the 714 pages are indexed,
 * taking them down leaves search results pointing at nothing. And a release
 * is attached only by pushing a version tag, which release.yml alone
 * answers. Delete the `if:` line, or add `branches: [main]` beside the tag,
 * and every check stays green while the next push publishes.
 *
 * So every action a workflow uses is named here as publishing or not, and
 * one this test has not been told about fails, so a new action is read
 * before it is used, as `RUNTIME` in workflow-actions.test.ts reads its
 * runtime. A job using one that publishes must carry that action's gate,
 * compared exactly, since a gate that also deploys on some other condition
 * is no gate. The reader takes the shapes these workflows write and throws
 * on any other, and the probes below are workflows that live only in this
 * file, so the guard is shown to refuse an ungated publish on every run.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WORKFLOWS = join(ROOT, '.github/workflows');

/** The gate a job using an action that publishes must carry. */
type Gate = { job: string } | { tagsOnly: string };

/** Every action that sends something outside the repository, and what must stand before it. */
const OUTWARD: Record<string, { gate: Gate; why: string }> = {
  'actions/deploy-pages': {
    gate: { job: "vars.WEFT_PAGES == 'true'" },
    why: 'publishes the content site, which cannot be unpublished once indexed',
  },
  'softprops/action-gh-release': {
    gate: { tagsOnly: "['v*']" },
    why: 'attaches the packages to a public GitHub release',
  },
};

/** Every other action the workflows use, and why it publishes nothing. */
const INWARD: Record<string, string> = {
  'actions/checkout': 'reads the repository',
  'actions/setup-node': 'installs Node and restores the npm cache',
  'actions/upload-artifact': 'stores files with the run, for the repository to download',
  'actions/upload-pages-artifact': 'stores the built site with the run; deploy-pages is what publishes it',
};

interface Job {
  name: string;
  /** The job-level `if:`, with `${{ }}`, quotes and a trailing comment taken off. */
  if: string | null;
  uses: { action: string; line: number }[];
}

interface Workflow {
  file: string;
  /** Each trigger under `on:`, with the keys beneath it and their values as written. */
  on: Map<string, Map<string, string>>;
  jobs: Job[];
}

const unwrap = (value: string): string =>
  value
    .replace(/\s+#.*$/, '')
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .replace(/^\$\{\{\s*(.*?)\s*\}\}$/, '$1');

/**
 * A workflow read for the shapes these files write: `on:` as a block of
 * triggers two spaces in, each with its keys four in; jobs two spaces in
 * under `jobs:`, a job's `if:` four in, and `uses:` anywhere inside it. An
 * `on:` written inline throws, naming its line, rather than being read as
 * no trigger at all.
 */
function readWorkflow(file: string, text: string): Workflow {
  const lines = text.split('\n');
  const wf: Workflow = { file, on: new Map(), jobs: [] };
  let section = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    const top = /^([\w-]+):\s*(.*?)\s*$/.exec(line);
    if (top) {
      section = top[1] ?? '';
      if (section === 'on' && top[2] && !top[2].startsWith('#')) {
        throw new Error(`${file}:${i + 1}: cannot read "on: ${top[2]}"; write the triggers as a block`);
      }
      continue;
    }
    if (section === 'on') {
      const trigger = /^ {2}([\w-]+):/.exec(line)?.[1];
      if (trigger) {
        wf.on.set(trigger, new Map());
        continue;
      }
      const key = /^ {4}([\w-]+):\s*(.*?)\s*$/.exec(line);
      const last = [...wf.on.values()].at(-1);
      if (key && last) last.set(key[1] ?? '', unwrap(key[2] ?? ''));
    } else if (section === 'jobs') {
      const name = /^ {2}([\w-]+):\s*$/.exec(line)?.[1];
      if (name) {
        wf.jobs.push({ name, if: null, uses: [] });
        continue;
      }
      const job = wf.jobs.at(-1);
      if (!job) continue;
      const cond = /^ {4}if:\s*(.*)$/.exec(line)?.[1];
      if (cond !== undefined) job.if = unwrap(cond);
      const uses = /^\s+(?:- )?uses:\s*(\S+)/.exec(line)?.[1];
      if (uses) job.uses.push({ action: unwrap(uses).replace(/@.*$/, ''), line: i + 1 });
    }
  }
  return wf;
}

/** Each job that publishes without the gate its action asks for, said as a reader would want it. */
function ungated(wf: Workflow): string[] {
  const out: string[] = [];
  for (const job of wf.jobs) {
    for (const use of job.uses) {
      const gate = OUTWARD[use.action]?.gate;
      if (!gate) continue;
      const where = `${wf.file}:${use.line} ${use.action} (job "${job.name}")`;
      if ('job' in gate && job.if !== gate.job) {
        out.push(`${where} runs ${job.if === null ? 'with no if:' : `if: ${job.if}`}, where it must wait for ${gate.job}`);
      }
      if ('tagsOnly' in gate) {
        const triggers = [...wf.on.keys()];
        const push = wf.on.get('push');
        const keys = push ? [...push.keys()] : [];
        if (triggers.join() !== 'push' || keys.join() !== 'tags' || push?.get('tags') !== gate.tagsOnly) {
          const said = triggers.map((t) => `${t}${(wf.on.get(t)?.size ?? 0) ? ` (${[...(wf.on.get(t)?.keys() ?? [])].join(', ')})` : ''}`);
          out.push(`${where} fires on ${said.join(', ') || 'nothing'}, where it must fire on a push of tags ${gate.tagsOnly} alone`);
        }
      }
    }
  }
  return out;
}

const workflows: Workflow[] = readdirSync(WORKFLOWS)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort()
  .map((f) => readWorkflow(f, readFileSync(join(WORKFLOWS, f), 'utf8')));

describe('nothing publishes unless somebody asked', () => {
  test('every action a workflow uses is named as publishing or not', () => {
    const unread = workflows.flatMap((wf) =>
      wf.jobs.flatMap((job) =>
        job.uses
          .filter((u) => !(u.action in OUTWARD) && !(u.action in INWARD))
          .map((u) => `${wf.file}:${u.line} ${u.action}: say in OUTWARD or INWARD whether it publishes`),
      ),
    );
    assert.deepEqual(unread, []);
  });

  test('every job that publishes carries its action’s gate', () => {
    assert.deepEqual(workflows.flatMap(ungated), []);
  });

  test('the guard refuses an ungated publish, shown on workflows that live only here', () => {
    const deploy = (cond: string) =>
      readWorkflow(
        'probe.yml',
        `on:\n  push:\n    branches: [main]\njobs:\n  deploy:\n${cond}    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/deploy-pages@v5\n`,
      );
    assert.equal(ungated(deploy('')).length, 1, 'a deploy job with no if: passed');
    assert.equal(
      ungated(deploy("    if: vars.WEFT_PAGES == 'true' || github.event_name == 'push'\n")).length,
      1,
      'a gate that also deploys on every push passed',
    );
    assert.deepEqual(ungated(deploy("    if: ${{ vars.WEFT_PAGES == 'true' }} # opt-in\n")), []);
    const release = (on: string) =>
      readWorkflow('probe.yml', `on:\n${on}jobs:\n  release:\n    steps:\n      - uses: softprops/action-gh-release@v2\n`);
    assert.equal(ungated(release("  push:\n    branches: [main]\n    tags: ['v*']\n")).length, 1, 'a release on main passed');
    assert.equal(ungated(release("  push:\n    tags: ['v*']\n  workflow_dispatch:\n")).length, 1, 'a dispatchable release passed');
    assert.deepEqual(ungated(release("  push:\n    tags: ['v*']\n")), []);
    assert.throws(() => readWorkflow('probe.yml', 'on: [push]\n'), /probe\.yml:1: cannot read/);
  });

  test('the rule has something to hold', () => {
    assert.ok(workflows.length >= 3, `only ${workflows.length} workflows were read`);
    const used = new Set(workflows.flatMap((wf) => wf.jobs.flatMap((job) => job.uses.map((u) => u.action))));
    const named = [...Object.keys(OUTWARD), ...Object.keys(INWARD)];
    assert.deepEqual(
      named.filter((action) => !used.has(action)),
      [],
      'an action no workflow uses has outlived its line here',
    );
    const uses = workflows.reduce((n, wf) => n + wf.jobs.reduce((m, job) => m + job.uses.length, 0), 0);
    assert.ok(uses >= 10, `only ${uses} uses: lines were read`);
  });
});
