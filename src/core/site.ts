/**
 * Where Weft's pages live: GitHub Pages, under the repository's name.
 *
 * The extension links `SUPPORT_URL` from its help page, and the site builder
 * and the link checker read both, so the pages and the links to them move
 * together. Plain literals: a template joining a name would ride into every
 * bundle that imports this module (`core-tree-shaking.test.ts`).
 */
export const SITE_URL = 'https://quiquae.github.io/weft';

/** Where someone goes when something is wrong. Every store asks for one. */
export const SUPPORT_URL = 'https://quiquae.github.io/weft/support';
