/**
 * Dates for the sitemap, and the sitemap itself.
 *
 * `<lastmod>` used to be `new Date()` for every one of the 711 URLs, so each
 * deploy announced that all ~700 word pages had changed that morning. The
 * site workflow rebuilds on every push to `main`, so the claim was made
 * repeatedly and was false every time. Search engines say they use `lastmod`
 * only while it is consistently accurate and otherwise ignore it, which turns
 * the field from an asset into noise — and the 700-page lexicon is precisely
 * the asset that field exists to help.
 *
 * So the rule here is: a page is dated by the content behind it. Word pages
 * take the `builtAt` of the pack they are generated from; the hand-written
 * pages take the commit date of the source that holds their prose. When
 * neither can be established the `<lastmod>` is left out, because the element
 * is optional and an absent date is honest where today's date is not.
 *
 * Written in TypeScript rather than as another `tools/*.mjs` for one reason:
 * `tsc` will not let a test import a `.mjs` (TS7016), and this logic is worth
 * testing directly rather than only through a whole site build. Node strips
 * the types at run time, the same way `tools/build-site.mjs` already imports
 * `src/core/pricing.ts`.
 */
import { execFileSync } from 'node:child_process';

/** One entry in the sitemap. An absent `lastmod` is written as no element. */
export interface SitemapUrl {
  url: string;
  priority: string;
  lastmod?: string | null;
}

/** Run git in `root`; null if it fails for any reason, including no git. */
function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const usableHistory = new Map<string, boolean>();

/**
 * Whether per-file dates from this checkout mean anything.
 *
 * In a shallow clone — which is what `actions/checkout` produces unless it is
 * given `fetch-depth: 0` — every file's last commit *is* HEAD, so `git log`
 * hands back the same recent date for all of them. That is the bug this
 * module exists to fix, wearing a disguise, so it is refused rather than
 * trusted.
 */
function hasUsableHistory(root: string): boolean {
  const known = usableHistory.get(root);
  if (known !== undefined) return known;
  const usable = git(root, ['rev-parse', '--is-shallow-repository']) === 'false';
  usableHistory.set(root, usable);
  return usable;
}

/**
 * The date (YYYY-MM-DD) of the newest commit touching any of `paths`, or null
 * when that cannot be established — no history, a shallow checkout, or a file
 * nobody has committed. Never the wall clock.
 *
 * `paths` are the sources whose content the page actually shows, so an edit
 * elsewhere in the repository does not redate it.
 */
export function contentDate(root: string, paths: string[]): string | null {
  if (!hasUsableHistory(root)) return null;
  let newest: string | null = null;
  for (const path of paths) {
    // %cs is the committer date as YYYY-MM-DD in the commit's own recorded
    // timezone, so it does not move with the machine building the site.
    const date = git(root, ['log', '-1', '--format=%cs', '--', path]);
    if (!date) continue;
    if (newest === null || date > newest) newest = date;
  }
  return newest;
}

/** Render the sitemap. URLs without a date get no `<lastmod>` element. */
export function sitemapXml(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '';
      return `  <url><loc>${u.url}</loc>${lastmod}<priority>${u.priority}</priority></url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}
