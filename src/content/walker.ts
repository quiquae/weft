/**
 * Finding the text worth weaving.
 *
 * The rules here are almost entirely about what NOT to touch. A language tool
 * that rewrites a button label, a code sample or a two-factor code is not a
 * language tool. Each exclusion below is a thing that looked fine in testing
 * and would have been a bug report.
 */

/** Elements whose text is never prose. */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'META', 'LINK',
  'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'OPTGROUP', 'BUTTON',
  'CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'TT',
  'MATH', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED', 'AUDIO', 'VIDEO',
  'TRACK', 'SOURCE', 'PICTURE', 'MAP', 'AREA', 'PROGRESS', 'METER',
  'TIME', 'ABBR', 'SUP', 'SUB',
]);

/**
 * Interactive roles. Rewriting the word inside a control changes what the
 * control appears to do, which is the one failure mode that can cost a user
 * something they cannot undo.
 */
const SKIP_ROLES = new Set([
  'button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab',
  'option', 'combobox', 'listbox', 'searchbox', 'textbox', 'spinbutton',
  'slider', 'switch', 'checkbox', 'radio', 'progressbar', 'status', 'alert',
  'log', 'timer', 'marquee',
]);

/** Class names in wide use to opt text out of machine translation. */
const NOTRANSLATE = /(?:^|\s)(?:notranslate|skiptranslate|no-translate)(?:$|\s)/i;

/** Our own UI, so we never weave our own tooltip. */
export const WEFT_ATTR = 'data-weft';

export interface WalkerOptions {
  /** BCP-47 prefix the page language must match, e.g. "en". */
  sourceLang: string;
  /** Minimum word tokens in a text node before it is considered. */
  minWords: number;
  /** Extra CSS selectors the user has excluded. */
  excludeSelectors: string[];
}

export const DEFAULT_MIN_WORDS = 3;

/**
 * Should this element and its subtree be skipped entirely?
 *
 * Returns FILTER_REJECT-worthy truth: callers use it to prune whole subtrees,
 * which is what keeps the walk cheap on a large page.
 */
export function shouldSkipElement(el: Element, opts: WalkerOptions): boolean {
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return true;
  if (el.hasAttribute(WEFT_ATTR)) return true;

  // A node the page has explicitly marked untranslatable.
  if (el.getAttribute('translate') === 'no') return true;
  const cls = el.getAttribute('class');
  if (cls && NOTRANSLATE.test(cls)) return true;

  // Editable text. Rewriting what someone is typing is unforgivable.
  const editable = el.getAttribute('contenteditable');
  if (editable !== null && editable !== 'false') return true;

  // Hidden content: cheap attribute checks only. Reading computed style for
  // every element would force layout on every mutation batch.
  if (el.hasAttribute('hidden')) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;

  // Live regions announce changes to screen readers; weaving them produces
  // announcements in two languages at once.
  const live = el.getAttribute('aria-live');
  if (live && live !== 'off') return true;

  const role = el.getAttribute('role');
  if (role && SKIP_ROLES.has(role)) return true;

  // A different language from the source: either already translated, or a
  // quotation we have no business rewriting.
  const lang = el.getAttribute('lang');
  if (lang && !lang.toLowerCase().startsWith(opts.sourceLang.toLowerCase())) return true;

  if (opts.excludeSelectors.length) {
    for (const selector of opts.excludeSelectors) {
      try {
        if (el.matches(selector)) return true;
      } catch {
        // An invalid user selector must not break the walk.
      }
    }
  }

  return false;
}

const WORD_RE = /\p{L}[\p{L}\p{M}'’-]*/gu;

/** Word-token count, used for the node-level minimum. */
export function countWords(text: string): number {
  WORD_RE.lastIndex = 0;
  let n = 0;
  while (WORD_RE.exec(text)) n++;
  return n;
}

/**
 * Is this text node a candidate?
 *
 * The word minimum is what protects interface chrome. Navigation labels,
 * breadcrumbs and badges are one or two words long, and they are the text a
 * user most needs to be able to read at a glance. Prose is longer.
 */
export function isCandidateText(node: Text, opts: WalkerOptions): boolean {
  const value = node.nodeValue;
  if (!value || value.length < 4) return false;
  if (!/\p{L}/u.test(value)) return false;
  if (countWords(value) < opts.minWords) return false;
  return true;
}

/**
 * Collect candidate text nodes under `root`.
 *
 * Uses a TreeWalker with a rejecting filter so that skipping an element skips
 * its whole subtree in one step: on a feed page the difference between
 * FILTER_REJECT and FILTER_SKIP is thousands of nodes.
 */
export function collectTextNodes(root: Node, opts: WalkerOptions, limit = 4000): Text[] {
  const out: Text[] = [];

  // A root that is itself a skipped element yields nothing.
  if (root.nodeType === Node.ELEMENT_NODE && shouldSkipElement(root as Element, opts)) {
    return out;
  }
  if (root.nodeType === Node.TEXT_NODE) {
    const text = root as Text;
    const parent = text.parentElement;
    if (parent && !hasSkippedAncestor(parent, opts) && isCandidateText(text, opts)) {
      out.push(text);
    }
    return out;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return shouldSkipElement(node as Element, opts)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      }
      return isCandidateText(node as Text, opts)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  let node = walker.nextNode();
  while (node && out.length < limit) {
    out.push(node as Text);
    node = walker.nextNode();
  }
  return out;
}

/**
 * Walk up from an element checking the skip rules.
 *
 * Needed when we are handed a single text node by a mutation record rather
 * than reaching it through the TreeWalker, because then no ancestor has been
 * filtered for us.
 */
export function hasSkippedAncestor(el: Element | null, opts: WalkerOptions): boolean {
  let cur: Element | null = el;
  let depth = 0;
  while (cur && depth < 60) {
    if (shouldSkipElement(cur, opts)) return true;
    cur = cur.parentElement;
    depth++;
  }
  return false;
}

/**
 * Is the document in the source language?
 *
 * Checked once per page. Weaving French words into a page that is already in
 * French is nonsense, and the `lang` attribute is right often enough to be
 * worth trusting for the top-level decision.
 */
export function documentLanguageMatches(sourceLang: string): boolean {
  const declared = document.documentElement.getAttribute('lang');
  if (!declared) return true; // no claim made; assume the source language
  return declared.toLowerCase().startsWith(sourceLang.toLowerCase());
}

/** Whether the page looks like it is managed by a virtual-DOM framework. */
export function detectFramework(): string | null {
  const root = document.body;
  if (!root) return null;
  if (document.querySelector('[data-reactroot]')) return 'react';
  for (const key of Object.keys(root)) {
    if (key.startsWith('__reactContainer') || key === '_reactRootContainer') return 'react';
  }
  const anyRoot = root as unknown as Record<string, unknown>;
  if (anyRoot['__vue_app__'] || document.querySelector('[data-v-app]')) return 'vue';
  if (document.querySelector('[ng-version]')) return 'angular';
  if (document.querySelector('[data-svelte-h]')) return 'svelte';
  // Next.js and Remix hydrate React without a data-reactroot attribute.
  if (document.getElementById('__next') || document.getElementById('root')) return 'react?';
  return null;
}
