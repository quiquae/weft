/**
 * Which committed artefacts the tree has moved past.
 *
 * Some files in this repository are generated and committed: the fifteen
 * listing screenshots, the documentation and first-run shots, and the
 * release notes. Their inputs live elsewhere — mostly `src/` — so an
 * ordinary change to the extension silently invalidates them, and nothing
 * notices. That has now happened three times:
 *
 *   - a version bump left `docs/SUBMIT.md` telling a human to upload five
 *     zip filenames that no longer existed;
 *   - `RELEASE-1.0.1.md` lists a `git log`, and every commit landing before
 *     the tag is pushed makes that list wronger;
 *   - the three `*-05-settings.png` were stale against `src/` at the moment
 *     they were being offered as evidence that the listing art matched the
 *     shipped code.
 *
 * Each was found by somebody noticing. The count sweep this repository runs
 * every session greps for test totals, so it walks past all three: a change
 * to `src/` invalidates *artefacts*, and nothing was looking at artefacts.
 *
 * **Why provenance and not content.** The obvious check is the one CI
 * already runs for the lexicon packs — rebuild them and diff. It cannot work
 * here. The screenshots are rendered by a browser and CI runs on
 * `ubuntu-latest`, where the font stack and text antialiasing differ, so a
 * byte comparison would fail for a reason that has nothing to do with
 * staleness; that temptation is recorded and refused in `CLAUDE.md` already.
 * And the release notes *cannot* match their own tree, because they list
 * commits and the squash commit that lands them does not exist until after
 * the merge. So the question asked here is not "is the content right" but
 * "has anything this was generated from been committed since it was last
 * written", which is answerable from git alone, on any platform, in
 * milliseconds.
 *
 * Not covered, deliberately: `src/lexicon/packs/`. Those are reproducible
 * byte for byte, so CI's `Committed packs match the seed lexicons` step
 * rebuilds and diffs them, which is a stronger check than this one. A second
 * weaker check over the same files would only add noise.
 *
 * TypeScript rather than another `tools/*.mjs` for the reason `tools/
 * sitemap.ts` records: `tsc` rejects a `.mjs` import from a `.ts` test with
 * TS7016, so a `.mjs` module here could only be tested through the CLI.
 */
import { execFileSync } from 'node:child_process';

/** One generated file, or set of them, and what invalidates it. */
export interface Artefact {
  /** How the report names it. */
  name: string;
  /** Git pathspecs for the committed artefact itself. */
  paths: string[];
  /** Git pathspecs whose change invalidates it. `.` means any commit. */
  inputs: string[];
  /** The command that regenerates it, printed next to the finding. */
  regenerate: string;
}

export type ArtefactState =
  /** Nothing has touched the sources since the artefact was written. */
  | 'fresh'
  /** Sources moved afterwards; the artefact describes an older tree. */
  | 'stale'
  /** No commit has ever written it — usually a pathspec that matches nothing. */
  | 'missing'
  /** A shallow checkout, where every file's last commit is HEAD. */
  | 'unknown';

export interface Commit {
  sha: string;
  subject: string;
}

export interface ArtefactResult {
  name: string;
  state: ArtefactState;
  /** The commit that last wrote the artefact, or null. */
  capturedAt: string | null;
  /** Commits touching the sources since then, newest first. */
  invalidatedBy: Commit[];
  regenerate: string;
}

export interface ArtefactReport {
  /** False in a shallow clone, where no per-file question can be answered. */
  usableHistory: boolean;
  results: ArtefactResult[];
}

/**
 * Where a verify stamp for `name` lives.
 *
 * A regeneration that reproduces the same bytes commits nothing, so the last
 * commit touching an artefact's real content never moves — a group already
 * confirmed correct reports exactly the same staleness forever. This path is
 * folded into that artefact's own `paths` in `artefactsFor`, so committing a
 * stamp here is a real change `checkArtefacts` already knows how to read; no
 * change to that function was needed.
 *
 * One file per artefact, not one shared file for all of them. A shared file
 * would make verifying artefact A touch a path also declared for artefact B,
 * moving B's `lastWrote` on a commit that never looked at B — silently
 * reporting it fresh, which this module's own tests already call "the worst
 * possible answer" for the analogous missing-vs-fresh case.
 */
export function artefactManifestPath(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `docs/artefacts/${slug}.json`;
}

/** Run git in `root`; null if it fails for any reason, including no git. */
function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Whether per-file history from this checkout means anything.
 *
 * `actions/checkout` clones at depth 1 unless told otherwise, and in a
 * shallow clone every file's last commit is HEAD — so every artefact would
 * read as written by the newest commit and nothing would ever look stale.
 * That is this module's own bug wearing a disguise, so it is refused rather
 * than answered. The sitemap's dates had to learn the same thing.
 */
function hasUsableHistory(root: string): boolean {
  return git(root, ['rev-parse', '--is-shallow-repository']) === 'false';
}

/** The commit that last wrote any of `paths`, or null if none ever did. */
function lastWrote(root: string, paths: string[]): string | null {
  const sha = git(root, ['log', '-1', '--format=%H', '--', ...paths]);
  return sha ? sha : null;
}

/** Commits after `since` that touch any of `paths`, newest first. */
function commitsSince(root: string, since: string, paths: string[]): Commit[] {
  // \x1f is a unit separator: a commit subject can contain anything a shell
  // would otherwise let through, and this repository's subjects contain
  // colons, backticks and em dashes.
  const out = git(root, ['log', '--format=%H\x1f%s', `${since}..HEAD`, '--', ...paths]);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha = '', subject = ''] = line.split('\x1f');
      return { sha, subject };
    });
}

/** Check each artefact against the git history of `root`. */
export function checkArtefacts(root: string, artefacts: Artefact[]): ArtefactReport {
  const usableHistory = hasUsableHistory(root);
  const results = artefacts.map((artefact): ArtefactResult => {
    const base = {
      name: artefact.name,
      capturedAt: null as string | null,
      invalidatedBy: [] as Commit[],
      regenerate: artefact.regenerate,
    };
    if (!usableHistory) return { ...base, state: 'unknown' };

    const capturedAt = lastWrote(root, artefact.paths);
    if (!capturedAt) return { ...base, state: 'missing' };

    const invalidatedBy = commitsSince(root, capturedAt, artefact.inputs);
    return {
      ...base,
      capturedAt,
      invalidatedBy,
      state: invalidatedBy.length ? 'stale' : 'fresh',
    };
  });
  return { usableHistory, results };
}

/** Human-readable report. Names the remedy beside every finding. */
export function formatReport(report: ArtefactReport): string {
  const lines: string[] = [];
  if (!report.usableHistory) {
    lines.push(
      'This is a shallow checkout, so no artefact can be dated: every file',
      "looks as though HEAD wrote it. Clone with full history (actions/checkout",
      'needs fetch-depth: 0) and run this again.',
      '',
    );
  }

  for (const r of report.results) {
    if (r.state === 'fresh') {
      lines.push(`  ok      ${r.name}`);
      continue;
    }
    if (r.state === 'unknown') {
      lines.push(`  ?       ${r.name} — cannot tell in a shallow checkout`);
      continue;
    }
    if (r.state === 'missing') {
      lines.push(`  MISSING ${r.name} — no commit has ever written it`);
      lines.push(`          regenerate: ${r.regenerate}`);
      continue;
    }
    const n = r.invalidatedBy.length;
    lines.push(
      `  STALE   ${r.name} — written at ${r.capturedAt?.slice(0, 7)}, ` +
        `${n} commit${n === 1 ? '' : 's'} since:`,
    );
    for (const c of r.invalidatedBy.slice(0, 8)) {
      lines.push(`            ${c.sha.slice(0, 7)} ${c.subject}`);
    }
    if (n > 8) lines.push(`            … and ${n - 8} more`);
    lines.push(`          regenerate: ${r.regenerate}`);
  }

  const stale = report.results.filter((r) => r.state === 'stale' || r.state === 'missing').length;
  lines.push('', `${report.results.length} artefacts checked, ${stale} stale.`);
  return lines.join('\n');
}

/**
 * The artefacts this repository actually commits.
 *
 * `version` names the release notes, which are per-version: passing it in
 * rather than reading `manifest.config.mjs` here keeps this module free of
 * I/O and lets a test ask for a version that does not exist.
 */
export function artefactsFor(version: string): Artefact[] {
  const groups: Array<Omit<Artefact, 'paths'> & { paths: string[] }> = [
    {
      name: 'store listing screenshots',
      // Only the fifteen captures. The three tiles and the logo beside them
      // are drawn by hand and are not generated from anything.
      paths: ['docs/store/*-0*.png'],
      inputs: ['src', 'tests/e2e/store-assets.spec.ts', 'tests/e2e/fixtures.ts'],
      regenerate: 'npm run build:test && WEFT_STORE=1 npx playwright test store-assets',
    },
    {
      name: 'documentation screenshots',
      // The whole directory — and unlike the two groups either side of it,
      // that is now the accurate declaration rather than a line nobody drew.
      // Every file in here is written by the spec below. It was not always:
      // five hand-made captures of the *content site* sat in this directory
      // being counted as generated, so a regeneration was a no-op for them,
      // `git status` stayed clean, and the group's verify stamp vouched for
      // bytes no regeneration could ever correct. Three of the five were
      // stale — the density copy PR #8 removed, the backwards Latin descent
      // sentence PR #17 fixed, and the straight quotes PR #20 unified — and
      // all five are deleted. No glob can pick out the fourteen that remain,
      // so what keeps this pathspec honest is a test rather than a pattern:
      // `tests/tools/artefacts.test.ts` fails if any file matched here is
      // one the generator does not write, for all three groups.
      paths: ['docs/screens'],
      inputs: ['src', 'tests/e2e/screenshots.spec.ts', 'tests/e2e/fixtures.ts'],
      regenerate: 'npm run build:test && WEFT_SCREENS=1 npx playwright test screenshots',
    },
    {
      name: 'first-run walkthrough shots',
      // The numbered captures only. `icons.png` beside them is a magnified
      // icon comparison sheet drawn by hand, generated from nothing and so
      // never stale — the same line the store group draws for its tiles.
      paths: ['docs/firstrun/0*.png'],
      inputs: ['src', 'tests/e2e/firstrun.spec.ts', 'tests/e2e/fixtures.ts'],
      regenerate: 'npm run build:test && WEFT_FIRSTRUN=1 npx playwright test firstrun',
    },
    {
      name: `release notes for ${version}`,
      paths: [`RELEASE-${version}.md`],
      // Any commit at all: the notes carry a `git log` of everything since
      // the previous tag, plus the six package sizes, which move with `src/`.
      inputs: ['.'],
      regenerate: `npm run release -- --version=${version}`,
    },
  ];
  // Every group carries its own verify-stamp path, so a byte-identical
  // regeneration has somewhere to record that a human checked.
  return groups.map((g) => ({ ...g, paths: [...g.paths, artefactManifestPath(g.name)] }));
}
