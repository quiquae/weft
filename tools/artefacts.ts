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
      // Only the fifteen captures. The tiles beside them are a group of
      // their own below, on a different input: they are rendered from HTML
      // by a tool and owe nothing to `src/`.
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
      // The numbered captures only, because these come from the e2e spec and
      // `icons.png` beside them comes from a tool — different inputs and a
      // different command, so they cannot share a group.
      //
      // This comment used to say `icons.png` was "drawn by hand, generated
      // from nothing and so never stale". That was true when written and it
      // was also the sentence that let the file rot: its lower half sat
      // blank for eight days behind a label promising a magnified
      // comparison, and every check in the repository was structurally
      // unable to see it. It has a generator now, one group down.
      paths: ['docs/firstrun/0*.png'],
      inputs: ['src', 'tests/e2e/firstrun.spec.ts', 'tests/e2e/fixtures.ts'],
      regenerate: 'npm run build:test && WEFT_FIRSTRUN=1 npx playwright test firstrun',
    },
    {
      name: 'icon comparison sheet',
      // `inputs` is the four rasters and the tool, and nothing else.
      //
      // Not `assets`, which would sweep in `icon.svg`: the sheet
      // deliberately does not use it — the SVG carries four warp threads at
      // every size where the 16px raster carries two — so a change to it
      // cannot invalidate the sheet, and declaring it would report a
      // staleness that is not one. Same argument the tiles group makes for
      // refusing to declare `src`.
      //
      // Not `tools/make-icons.mjs` either, one level further back: it
      // reaches the sheet only through the rasters, which are themselves an
      // artefact group below, so an edit nobody rebuilt is reported there
      // rather than twice.
      paths: ['docs/firstrun/icons.png'],
      inputs: ['assets/icon-*.png', 'tools/make-icon-sheet.mjs'],
      regenerate: 'npm run icons:sheet',
    },
    {
      name: 'shipped extension icons',
      // The toolbar icon and its siblings, which were in no group at all
      // until the sheet above needed to declare them as an input.
      //
      // They were invisible for a precise reason worth keeping: the guard
      // in `tests/tools/artefacts.test.ts` that finds a generator whose
      // output sits outside every pathspec derived generators from tools
      // declaring an `OUT` inside `docs/` — and `make-icons.mjs` writes
      // into `assets/`. So the check built to catch exactly this class had
      // the class's own blind spot compiled into its predicate. That
      // predicate is now any `OUT`, wherever it points.
      //
      // Unlike every other group here, these are drawn with no browser, no
      // fonts and no clock — `iconPixels` in `tools/brand.ts`, then a pure
      // Node PNG encoder — so their *pixels* are the same on any machine.
      // Their bytes are not, and this comment used to say they were:
      // `deflateSync` is whatever zlib the Node binary was built against,
      // and the 128px icon comes out at 431 bytes under one and 432 under
      // another, same pixels. So CI cannot rebuild and `git diff` them the
      // way it does the lexicon packs; it would fail on a correct tree.
      //
      // What it can do instead is in `tests/tools/brand.test.ts`, under
      // `npm test`: every file in this group is held to what the geometry
      // draws, the rasters by their decoded pixels and the vectors as text,
      // so an edit to `tools/brand.ts` that nobody rebuilt fails by name.
      // That is the stronger check. This group stays anyway, because the
      // tests find these files through it — `brand.test.ts` reads them off
      // this group rather than off a list, and `artefacts.test.ts` requires
      // every committed image to sit in some group — and what it reports for
      // them is now only whether anyone has looked since an input moved.
      //
      // `site/icon.svg` is in here rather than with the site because it is
      // the same string from the same generator: it was a hand-made copy of
      // `assets/icon.svg`, byte-identical when found, and `make-icons.mjs`
      // now writes both.
      //
      // `tools/brand.ts` is the geometry itself — how many threads, how
      // thick, how far the weft reaches — which `make-icons.mjs` now only
      // fills. It is an input of all three groups that draw the mark, and
      // `tests/tools/brand.test.ts` fails if a tool that imports it writes
      // into a group that does not say so.
      paths: ['assets/icon-*.png', 'assets/icon.svg', 'site/icon.svg'],
      inputs: ['tools/make-icons.mjs', 'tools/brand.ts'],
      regenerate: 'npm run icons',
    },
    {
      name: 'social card',
      // The Open Graph card, which is what a link to weft.study renders as
      // in every chat window and timeline that unfurls it — so it is read
      // by more people than any screenshot here, and it was in no group.
      //
      // It was invisible for a second reason on top of the `docs/` one:
      // `tools/make-og.mjs` declares no `const OUT` at all, it writes
      // `join(ROOT, 'site/og.png')` inline. So the derivation could not
      // have found it however the directory predicate was written, which is
      // why the guard beside this file now enumerates committed images from
      // git rather than trying to recognise a generator.
      //
      // Measured byte-stable across three runs on 2026-09-28, and the
      // reason is structural: the card has no `new Date()` in it. So this
      // group can always be cleared by regenerating.
      //
      // `tools/brand.ts` because the card carries the mark and the four
      // words the artwork leads with, and takes both from there. See the
      // tiles below for what the missing input cost.
      paths: ['site/og.png'],
      inputs: ['tools/make-og.mjs', 'tools/brand.ts'],
      regenerate: 'npm run og',
    },
    {
      name: 'store promo tiles',
      // Generated after all. This group did not exist because the comment
      // above used to claim these three were "drawn by hand and are not
      // generated from anything", so a `TODO.md` item was raised to open
      // them by eye on the grounds that no other check was possible — while
      // `tools/make-store-tiles.mjs` had been sitting beside `make-og.mjs`
      // rendering them from HTML the whole time. It was reachable by no
      // `npm run` either, which is most of why nobody found it.
      //
      // `inputs` is the tool and what it draws from, and nothing else,
      // deliberately: the tiles are graphics rather than screenshots and
      // the generator imports nothing from `src/`, so declaring `src` would
      // report them stale on every commit that cannot possibly have changed
      // them.
      //
      // It was the tool alone until 2026-10-01, and this group reported
      // "ok" on that basis while all three files showed a mark the icon
      // beside them had replaced nine days earlier. The declaration was
      // accurate: the tile generator had not moved. The mark had — in
      // `make-icons.mjs`, which this group did not name, because the
      // generator held its own pasted copy of the mark rather than a
      // reference to it. **Provenance cannot see a copy.** The copy is now
      // an import of `tools/brand.ts`, so the import is now an input.
      paths: ['docs/store/tile-*.png', 'docs/store/logo-*.png'],
      inputs: ['tools/make-store-tiles.mjs', 'tools/brand.ts'],
      regenerate: 'npm run tiles',
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
