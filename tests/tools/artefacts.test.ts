/**
 * Committed artefacts go stale on their own, and nothing looks at them.
 *
 * Three times now a session has found a generated file that the tree had
 * moved past: `docs/SUBMIT.md` naming five zip filenames a version bump had
 * deleted, `RELEASE-1.0.1.md` listing a `git log` that every later commit
 * makes wronger, and the fifteen listing screenshots — which were stale
 * against `src/` at the moment they were being offered as evidence that the
 * listing art matched the shipped code. Each was found by a human noticing.
 * The count sweep this repository does every session greps for test totals,
 * so it walks straight past all three.
 *
 * The check cannot be "rebuild it and diff", which is what CI already does
 * for the lexicon packs. The screenshots are rendered by a browser and CI
 * runs on `ubuntu-latest`, where the font stack differs, so a byte
 * comparison would fail for a reason unrelated to staleness; and the release
 * notes *cannot* match, because they list commits and the commit that lands
 * them does not exist until after the squash. So the question asked here is
 * provenance rather than content: has anything the artefact is generated
 * from been committed since the artefact was last written?
 *
 * These run against throwaway git repositories, so every commit asserted
 * about is one the test made.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkArtefacts, formatReport, artefactsFor, artefactManifestPath } from '../../tools/artefacts.ts';

function git(root: string, args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.email=test@weft.invalid', '-c', 'user.name=Weft test', ...args],
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  ).trim();
}

/** Write `files` (paths relative to `root`) and commit them under `subject`. */
function commit(root: string, files: Record<string, string>, subject: string): void {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, dirname(name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', subject]);
}

function withRepo(body: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'weft-artefacts-'));
  try {
    git(root, ['init', '--quiet', '-b', 'main']);
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The shape under test throughout: one artefact drawn from one source tree. */
const SHOTS = {
  name: 'listing screenshots',
  paths: ['docs/store'],
  inputs: ['src'],
  regenerate: 'WEFT_STORE=1 npx playwright test store-assets',
};

const only = (root: string, artefact = SHOTS) => {
  const report = checkArtefacts(root, [artefact]);
  assert.equal(report.results.length, 1);
  return report.results[0]!;
};

describe('an artefact is stale when its sources moved after it was written', () => {
  test('a source committed after the artefact makes it stale', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(root, { 'src/a.ts': 'two\n' }, 'change the source again');

      const result = only(root);
      assert.equal(result.state, 'stale');
      assert.deepEqual(
        result.invalidatedBy.map((c) => c.subject),
        ['change the source again'],
      );
    });
  });

  test('an artefact written after its sources is fresh', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'src/a.ts': 'two\n' }, 'change the source again');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');

      const result = only(root);
      assert.equal(result.state, 'fresh');
      assert.deepEqual(result.invalidatedBy, []);
    });
  });

  test('a commit touching neither the artefact nor its sources leaves it fresh', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(root, { 'README.md': 'prose\n' }, 'edit some prose');

      // Without this the check is just "has anything happened lately", which
      // would fire on every commit and so be ignored on every commit.
      assert.equal(only(root).state, 'fresh');
    });
  });

  test('regenerating in the same commit as the source change is not stale', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(
        root,
        { 'src/a.ts': 'two\n', 'docs/store/chrome-01.png': 'shot two\n' },
        'change the source and recapture',
      );

      assert.equal(only(root).state, 'fresh');
    });
  });

  test('several sources are considered, not just the first', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n', 'tests/e2e/spec.ts': 'spec\n' }, 'source and spec');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(root, { 'tests/e2e/spec.ts': 'spec two\n' }, 'change the spec');

      const result = only(root, { ...SHOTS, inputs: ['src', 'tests/e2e/spec.ts'] });
      assert.equal(result.state, 'stale');
      assert.deepEqual(
        result.invalidatedBy.map((c) => c.subject),
        ['change the spec'],
      );
    });
  });
});

describe('the states that are not an answer say so', () => {
  test('an artefact nobody has committed is missing, not fresh', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');

      // "Fresh" here would be the worst possible answer: it is the reading a
      // typo in a pathspec produces, and it reports success for a file that
      // does not exist.
      const result = only(root);
      assert.equal(result.state, 'missing');
      assert.equal(result.capturedAt, null);
    });
  });

  test('a shallow checkout is refused rather than answered wrongly', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(root, { 'src/a.ts': 'two\n' }, 'change the source again');

      const shallow = mkdtempSync(join(tmpdir(), 'weft-artefacts-shallow-'));
      try {
        git(shallow, ['clone', '--quiet', '--depth=1', `file://${root}`, '.']);
        const report = checkArtefacts(shallow, [SHOTS]);
        // In a shallow clone every file's last commit is HEAD, so the honest
        // answer is that this checkout cannot tell. `actions/checkout` is
        // shallow unless given fetch-depth: 0 — the same disguise the
        // sitemap's dates had to be taught to refuse.
        assert.equal(report.usableHistory, false);
        assert.equal(report.results[0]!.state, 'unknown');
      } finally {
        rmSync(shallow, { recursive: true, force: true });
      }
    });
  });
});

describe('the report tells you what to do about it', () => {
  test('a stale artefact is reported with the command that regenerates it', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(root, { 'src/a.ts': 'two\n' }, 'change the source again');

      const text = formatReport(checkArtefacts(root, [SHOTS]));
      assert.match(text, /listing screenshots/);
      assert.match(text, /change the source again/);
      // A report that names a problem and not its remedy is a report nobody
      // acts on.
      assert.match(text, /WEFT_STORE=1 npx playwright test store-assets/);
    });
  });

  test('a fresh tree reports no work and says which artefacts it checked', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');

      const text = formatReport(checkArtefacts(root, [SHOTS]));
      assert.match(text, /listing screenshots/);
      assert.match(text, /0 stale/);
    });
  });
});

describe('a verified stamp records a human check, not just a regeneration', () => {
  // A regeneration that reproduces the same bytes commits nothing, so
  // lastWrote never moves and a group already confirmed correct reports the
  // same staleness forever. The fix: each artefact carries its own manifest
  // path, alongside its real content, in the same `paths` array. Committing
  // *that* is a real change git can see, which checkArtefacts already knows
  // how to read — no change to checkArtefacts itself.
  const shotsWithManifest = {
    name: 'listing screenshots',
    paths: ['docs/store', artefactManifestPath('listing screenshots')],
    inputs: ['src'],
    regenerate: 'WEFT_STORE=1 npx playwright test store-assets',
  };

  test('a verify commit with no content change flips a stale artefact to fresh', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(root, { 'src/a.ts': 'two\n' }, 'change the source again');

      // Genuinely stale before anyone has looked.
      assert.equal(only(root, shotsWithManifest).state, 'stale');

      // Regenerated, diffed, found byte-identical — nothing under docs/store
      // changes, only the manifest records that somebody checked.
      commit(
        root,
        { [shotsWithManifest.paths[1]!]: '{"verifiedAt":"now"}\n' },
        'confirm the shots are still correct',
      );

      assert.equal(only(root, shotsWithManifest).state, 'fresh');
    });
  });

  test('a later source change stales it again, even after a verify commit', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(root, { 'docs/store/chrome-01.png': 'shot\n' }, 'capture the shots');
      commit(root, { 'src/a.ts': 'two\n' }, 'change the source again');
      commit(
        root,
        { [shotsWithManifest.paths[1]!]: '{"verifiedAt":"now"}\n' },
        'confirm the shots are still correct',
      );
      commit(root, { 'src/a.ts': 'three\n' }, 'change the source a third time');

      // A verify stamp pins one moment; it is not a standing exemption.
      assert.equal(only(root, shotsWithManifest).state, 'stale');
    });
  });

  test('verifying one artefact does not freshen an unrelated stale one', () => {
    withRepo((root) => {
      commit(root, { 'src/a.ts': 'one\n' }, 'the source');
      commit(
        root,
        { 'docs/store/chrome-01.png': 'shot\n', 'docs/screens/x.png': 'shot\n' },
        'capture both sets',
      );
      commit(root, { 'src/a.ts': 'two\n' }, 'change the source again');

      const screensWithManifest = {
        name: 'documentation screenshots',
        paths: ['docs/screens', artefactManifestPath('documentation screenshots')],
        inputs: ['src'],
        regenerate: 'npx playwright test screenshots',
      };

      // Only the store shots get a verify commit.
      commit(
        root,
        { [shotsWithManifest.paths[1]!]: '{"verifiedAt":"now"}\n' },
        'confirm the store shots only',
      );

      const report = checkArtefacts(root, [shotsWithManifest, screensWithManifest]);
      assert.equal(report.results[0]!.state, 'fresh');
      // A shared manifest file would have freshened this too, on a commit
      // that never touched it. That is the false "fresh" this tool's own
      // "missing, not fresh" test already refuses to give.
      assert.equal(report.results[1]!.state, 'stale');
    });
  });
});

describe('artefactManifestPath', () => {
  test('derives a filesystem-safe, distinct path per artefact name', () => {
    assert.equal(
      artefactManifestPath('store listing screenshots'),
      'docs/artefacts/store-listing-screenshots.json',
    );
    assert.notEqual(
      artefactManifestPath('documentation screenshots'),
      artefactManifestPath('first-run walkthrough shots'),
    );
  });

  test('punctuation collapses rather than producing adjacent dashes', () => {
    assert.equal(
      artefactManifestPath("release notes for 1.0.1"),
      'docs/artefacts/release-notes-for-1-0-1.json',
    );
  });
});

describe("the real artefact list points at things that are actually there", () => {
  const ROOT = join(import.meta.dirname, '../..');

  /**
   * The committed files a group's pathspec matches, minus its verify stamp.
   *
   * `artefactsFor` folds `artefactManifestPath(name)` into every group's
   * `paths`, which is what lets a stamp move `lastWrote`. It also means
   * `git ls-files` over those paths returns one extra entry — but only once
   * somebody has actually run `artefacts:verify` for that group and
   * committed the result. Counting it made the store-pathspec test below
   * pass for as long as the mechanism went unused and fail on its first
   * real use, which is the worst moment for a guard to turn red.
   */
  const captures = (artefact: { name: string; paths: string[] }): string[] => {
    const manifest = artefactManifestPath(artefact.name);
    return git(ROOT, ['ls-files', ...artefact.paths])
      .split('\n')
      .filter(Boolean)
      .filter((f) => f !== manifest);
  };

  test('every declared source path exists in this repository', () => {
    // The failure this catches is silent: a pathspec matching nothing makes
    // `git log` return nothing, which reads as "fresh" forever.
    for (const artefact of artefactsFor('1.0.1')) {
      for (const input of artefact.inputs) {
        if (input === '.') continue;
        const seen = git(ROOT, ['log', '-1', '--format=%H', '--', input]);
        assert.notEqual(seen, '', `no commit has ever touched the source "${input}"`);
      }
    }
  });

  test('every declared artefact path has been committed at least once', () => {
    for (const artefact of artefactsFor('1.0.1')) {
      // The verify-manifest path is exempt: it is derived, not hand-typed,
      // so it cannot be a typo, and it legitimately has no history until
      // `artefacts:verify` runs for that group for the first time.
      const manifest = artefactManifestPath(artefact.name);
      for (const path of artefact.paths) {
        if (path === manifest) continue;
        const seen = git(ROOT, ['log', '-1', '--format=%H', '--', path]);
        assert.notEqual(seen, '', `no commit has ever written the artefact "${path}"`);
      }
    }
  });

  test('the store pathspec takes the fifteen captures and not the hand-drawn tiles', () => {
    const shots = artefactsFor('1.0.1').find((a) => a.name.startsWith('store listing'));
    assert.ok(shots);
    const matched = captures(shots);
    // The tiles and the Edge logo sit in the same directory and are drawn by
    // hand, so they are generated from nothing and can never be stale. A
    // pathspec that swept them in would report the whole group stale for a
    // reason no regeneration could fix.
    assert.equal(matched.length, 15, `matched:\n${matched.join('\n')}`);
    for (const file of matched) assert.match(file, /-0\d-/);
  });

  test('the first-run pathspec takes the generated shots and not the hand-made icon sheet', () => {
    const shots = artefactsFor('1.0.1').find((a) => a.name.startsWith('first-run'));
    assert.ok(shots);
    const matched = captures(shots);
    // `icons.png` is a magnified icon comparison sheet drawn by hand, and it
    // sits in this directory because that is where the first-run material
    // was collected, not because any generator writes it. The store group
    // above already draws exactly this line for the tiles beside it; this
    // group was declared as the whole directory and so swept the sheet in.
    assert.ok(matched.length > 0, 'the first-run pathspec matches nothing');
    for (const file of matched) {
      assert.match(file, /docs\/firstrun\/\d\d-[a-z-]+\.png$/, `${file} is not a generated shot`);
    }
  });

  /**
   * The basenames a generator writes, read out of the generator itself.
   *
   * Two shapes, because the three specs name their files two ways — and
   * neither list may be typed out here, which is the whole point. A
   * hand-written list of the files to check cannot police the file that was
   * forgotten; that is how `07-help.png` sat inside a pathspec for two
   * weeks saying "Weft 1.0.0", and how five hand-made captures of the
   * *content site* sat inside `docs/screens` being counted as generated.
   *
   * `firstrun.spec.ts` and `screenshots.spec.ts` name each file as a
   * single-quoted literal. `store-assets.spec.ts` composes
   * `${frame}-${slug}.png` from a frame table and the slug it is called
   * with, so none of its fifteen names exists anywhere in the file as a
   * whole string and they have to be multiplied out. That composition is
   * the reason this guard was left applying to one group only when it was
   * written, and the reason the other two went unchecked.
   *
   * Single quotes rather than any quote: this repository writes filenames
   * in prose inside backticks, and a comment naming a file is not a
   * generator writing it.
   */
  const literalShots = (spec: string): Set<string> =>
    new Set(Array.from(spec.matchAll(/'([a-z0-9-]+\.png)'/g), (m) => m[1]!));

  const composedShots = (spec: string): Set<string> => {
    const frames = Array.from(spec.matchAll(/\{ name: '([a-z]+)',/g), (m) => m[1]!);
    const slugs = Array.from(spec.matchAll(/\bcapture\('([a-z0-9-]+)'/g), (m) => m[1]!);
    return new Set(frames.flatMap((f) => slugs.map((s) => `${f}-${s}.png`)));
  };

  /** Which spec writes each image group, and how that spec spells a name. */
  const GENERATORS = [
    { group: 'first-run', spec: 'tests/e2e/firstrun.spec.ts', shots: literalShots },
    { group: 'documentation', spec: 'tests/e2e/screenshots.spec.ts', shots: literalShots },
    { group: 'store listing', spec: 'tests/e2e/store-assets.spec.ts', shots: composedShots },
  ];

  for (const { group, spec: specPath, shots } of GENERATORS) {
    test(`every file in the ${group} pathspec is written by its generator`, () => {
      // The failure this catches is silent in both directions. A file that
      // no generator writes is never touched by a regeneration, so
      // `git status` stays clean, `artefacts:check` reports the group fresh
      // from its provenance, and a verify stamp then claims the whole
      // pathspec was checked — which for that file nothing can make true.
      // Two have already been found this way: `07-help.png` carrying a
      // superseded version number, and `landing.png` advertising "48% —
      // 1 word in 2", a phrasing PR #8 removed at a density the demo can no
      // longer reach.
      const artefact = artefactsFor('1.0.1').find((a) => a.name.startsWith(group));
      assert.ok(artefact, `no artefact group is named for "${group}"`);
      const written = shots(readFileSync(join(ROOT, specPath), 'utf8'));
      const matched = captures(artefact);
      // Non-vacuity floor: a pathspec that matches nothing runs this loop
      // over an empty list and passes, which is the silent skip a derived
      // list invites. A derivation that has stopped matching needs no floor
      // — it makes every file below fail by name.
      assert.ok(matched.length > 0, `the ${group} pathspec matches nothing`);
      for (const file of matched) {
        const name = file.slice(file.lastIndexOf('/') + 1);
        assert.ok(
          written.has(name),
          `${file} is inside the artefact pathspec but ${specPath} does not write it, ` +
            'so regenerating the group can never correct it',
        );
      }
    });
  }

  test('the release notes are named after the version they belong to', () => {
    const notes = artefactsFor('9.9.9').find((a) => a.paths.some((p) => p.startsWith('RELEASE-')));
    assert.ok(notes, 'no artefact covers the release notes');
    assert.deepEqual(notes.paths, ['RELEASE-9.9.9.md', artefactManifestPath(notes.name)]);
  });

  test('every real artefact declares its own manifest path', () => {
    // Not required to be committed yet: unlike the hand-typed paths above,
    // this one is derived, so it cannot be a typo, and requiring history
    // before it is ever used would mean fabricating a verify commit — the
    // exact false "somebody checked" this mechanism exists to prevent —
    // just to satisfy this test. It becomes real the first time
    // `artefacts:verify` actually runs for that group.
    for (const artefact of artefactsFor('1.0.1')) {
      assert.ok(
        artefact.paths.includes(artefactManifestPath(artefact.name)),
        `${artefact.name} does not declare its manifest path in paths`,
      );
    }
  });
});
