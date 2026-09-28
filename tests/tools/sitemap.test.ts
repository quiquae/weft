/**
 * The sitemap's <lastmod> is a claim about the world, and search engines say
 * plainly that they ignore the field when it is not verifiably accurate. It
 * was `new Date()` for all 711 URLs, so every deploy told them ~700 word
 * pages had changed that morning.
 *
 * These tests fix the replacement rule: a date comes from the content behind
 * the page, and when no date can be established the field is left out rather
 * than filled in with today. They run against throwaway git repositories, so
 * every date asserted here is one the test chose.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentDate, sitemapXml } from '../../tools/sitemap.ts';

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Times are UTC and away from midnight: `git log --format=%cs` renders in the
 * commit's own recorded zone, so a stamp chosen here is the date read back
 * whatever the machine's clock is set to.
 */
const noonAt = (date: string) => `${date}T12:00:00Z`;

function git(root: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync(
    'git',
    ['-c', 'user.email=test@weft.invalid', '-c', 'user.name=Weft test', ...args],
    { cwd: root, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, ...env } },
  ).trim();
}

/** Write `files` and commit them, dated `date` (YYYY-MM-DD). */
function commit(root: string, files: Record<string, string>, date: string): void {
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text);
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', `content of ${date}`], {
    GIT_AUTHOR_DATE: noonAt(date),
    GIT_COMMITTER_DATE: noonAt(date),
  });
}

function withRepo(body: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'weft-sitemap-'));
  try {
    git(root, ['init', '--quiet', '-b', 'main']);
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('a page is dated by the content behind it', () => {
  test('the date is the commit that last changed the source, not today', () => {
    withRepo((root) => {
      commit(root, { 'PRIVACY.md': 'first\n' }, '2020-01-01');
      commit(root, { 'PRIVACY.md': 'second\n' }, '2021-06-15');

      assert.equal(contentDate(root, ['PRIVACY.md']), '2021-06-15');
    });
  });

  test('a later commit that left the source alone does not redate the page', () => {
    withRepo((root) => {
      commit(root, { 'PRIVACY.md': 'only\n' }, '2020-01-01');
      commit(root, { 'SUPPORT.md': 'unrelated\n' }, '2024-03-09');

      assert.equal(contentDate(root, ['PRIVACY.md']), '2020-01-01');
    });
  });

  test('a page built from several sources takes the newest of them', () => {
    withRepo((root) => {
      commit(root, { 'pricing.ts': 'prices\n' }, '2020-01-01');
      commit(root, { 'entitlements.ts': 'features\n' }, '2022-11-30');

      assert.equal(contentDate(root, ['pricing.ts', 'entitlements.ts']), '2022-11-30');
    });
  });

  test('a source with no commit behind it has no date, rather than today', () => {
    withRepo((root) => {
      commit(root, { 'PRIVACY.md': 'committed\n' }, '2020-01-01');
      writeFileSync(join(root, 'DRAFT.md'), 'never committed\n');

      assert.equal(contentDate(root, ['DRAFT.md']), null);
    });
  });

  test('a shallow checkout reports no date rather than HEAD’s', () => {
    withRepo((root) => {
      commit(root, { 'PRIVACY.md': 'first\n' }, '2020-01-01');
      commit(root, { 'SUPPORT.md': 'second\n' }, '2024-03-09');

      // What `actions/checkout` does by default. Every file in it reports the
      // one commit that was fetched, so a per-file date here is the bug this
      // whole change is about, wearing a disguise.
      const shallow = `${root}-shallow`;
      try {
        git(root, ['clone', '--quiet', '--depth=1', `file://${root}`, shallow]);
        assert.equal(git(shallow, ['rev-parse', '--is-shallow-repository']), 'true');

        assert.equal(contentDate(shallow, ['PRIVACY.md']), null);
      } finally {
        rmSync(shallow, { recursive: true, force: true });
      }
    });
  });

  test('somewhere that is not a repository at all has no date', () => {
    const outside = mkdtempSync(join(tmpdir(), 'weft-nogit-'));
    try {
      writeFileSync(join(outside, 'PRIVACY.md'), 'no history here\n');
      assert.equal(contentDate(outside, ['PRIVACY.md']), null);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('the sitemap leaves out what it cannot vouch for', () => {
  test('a URL with a known date carries it', () => {
    const xml = sitemapXml([{ url: 'https://weft.study/privacy', priority: '0.5', lastmod: '2021-06-15' }]);

    assert.match(xml, /<loc>https:\/\/weft\.study\/privacy<\/loc><lastmod>2021-06-15<\/lastmod>/);
  });

  test('a URL with no known date is written without a lastmod at all', () => {
    const xml = sitemapXml([{ url: 'https://weft.study/privacy', priority: '0.5' }]);

    assert.doesNotMatch(xml, /lastmod/, 'an unknown date became a claim');
    assert.doesNotMatch(xml, new RegExp(TODAY), 'an unknown date became today');
    assert.match(xml, /<loc>https:\/\/weft\.study\/privacy<\/loc><priority>0\.5<\/priority>/);
  });

  test('the document is a well-formed urlset', () => {
    const xml = sitemapXml([{ url: 'https://weft.study/', priority: '1.0', lastmod: '2020-01-01' }]);

    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n/);
    assert.match(xml, /\n<\/urlset>\n$/);
  });
});
