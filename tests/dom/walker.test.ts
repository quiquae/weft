import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.ts';

installDom('');

const {
  collectTextNodes,
  shouldSkipElement,
  isCandidateText,
  countWords,
  documentLanguageMatches,
  detectFramework,
  hasSkippedAncestor,
} = await import('../../src/content/walker.ts');

const OPTS = { sourceLang: 'en', minWords: 3, excludeSelectors: [] };

function load(html: string) {
  installDom(html);
  return document.body;
}

describe('countWords', () => {
  test('counts word tokens, not characters', () => {
    assert.equal(countWords('the quick brown fox'), 4);
    assert.equal(countWords("don't stop"), 2);
    assert.equal(countWords('12 34 !!'), 0);
    assert.equal(countWords(''), 0);
  });
});

describe('shouldSkipElement', () => {
  beforeEach(() => void load(''));

  const skip = (html: string, selector: string) => {
    const body = load(html);
    const el = body.querySelector(selector);
    assert.ok(el, `selector ${selector} matched nothing`);
    return shouldSkipElement(el, OPTS);
  };

  test('skips elements whose text is never prose', () => {
    for (const tag of ['script', 'style', 'code', 'pre', 'textarea', 'button', 'svg', 'kbd']) {
      assert.equal(skip(`<${tag} id="t">x</${tag}>`, '#t'), true, tag);
    }
  });

  test('skips anything editable', () => {
    assert.equal(skip('<div id="t" contenteditable>x</div>', '#t'), true);
    assert.equal(skip('<div id="t" contenteditable="true">x</div>', '#t'), true);
    assert.equal(skip('<div id="t" contenteditable="false">x</div>', '#t'), false);
  });

  test('skips live regions, which would be announced in two languages', () => {
    assert.equal(skip('<div id="t" aria-live="polite">x</div>', '#t'), true);
    assert.equal(skip('<div id="t" aria-live="off">x</div>', '#t'), false);
  });

  test('skips interactive roles, where changing a word changes what it does', () => {
    for (const role of ['button', 'link', 'textbox', 'searchbox', 'switch', 'alert']) {
      assert.equal(skip(`<div id="t" role="${role}">x</div>`, '#t'), true, role);
    }
  });

  test('honours translate="no" and notranslate', () => {
    assert.equal(skip('<p id="t" translate="no">x</p>', '#t'), true);
    assert.equal(skip('<p id="t" class="notranslate">x</p>', '#t'), true);
    assert.equal(skip('<p id="t" class="a skiptranslate b">x</p>', '#t'), true);
    assert.equal(skip('<p id="t" class="translate-me">x</p>', '#t'), false);
  });

  test('skips text already in another language', () => {
    assert.equal(skip('<p id="t" lang="fr">x</p>', '#t'), true);
    assert.equal(skip('<p id="t" lang="en-GB">x</p>', '#t'), false);
  });

  test('skips hidden content', () => {
    assert.equal(skip('<p id="t" hidden>x</p>', '#t'), true);
    assert.equal(skip('<p id="t" aria-hidden="true">x</p>', '#t'), true);
  });

  test('skips our own UI', () => {
    assert.equal(skip('<div id="t" data-weft="1">x</div>', '#t'), true);
  });

  test('honours user exclusion selectors, and survives an invalid one', () => {
    const body = load('<p id="t" class="ads">x</p>');
    const el = body.querySelector('#t');
    assert.ok(el);
    assert.equal(shouldSkipElement(el, { ...OPTS, excludeSelectors: ['.ads'] }), true);
    assert.equal(shouldSkipElement(el, { ...OPTS, excludeSelectors: ['!!!bad'] }), false);
  });

  test('allows ordinary prose containers', () => {
    for (const tag of ['p', 'div', 'span', 'article', 'li', 'h1', 'a', 'em']) {
      assert.equal(skip(`<${tag} id="t">x</${tag}>`, '#t'), false, tag);
    }
  });
});

describe('isCandidateText', () => {
  test('requires the configured minimum of words', () => {
    load('<p>one two three four</p><p>too short</p>');
    const [long, short] = [...document.querySelectorAll('p')].map((p) => p.firstChild as Text);
    assert.ok(long && short);
    assert.equal(isCandidateText(long, OPTS), true);
    assert.equal(isCandidateText(short, OPTS), false, 'interface chrome must be protected');
  });

  test('rejects text with no letters', () => {
    load('<p>12 34 56 78</p>');
    const node = document.querySelector('p')?.firstChild as Text | null;
    assert.ok(node);
    assert.equal(isCandidateText(node, OPTS), false);
  });
});

describe('collectTextNodes', () => {
  test('finds prose and prunes whole skipped subtrees', () => {
    const body = load(`
      <p>The quick brown fox jumped over it.</p>
      <div>
        <script>var a = "the quick brown fox";</script>
        <pre>the quick brown fox in a code block</pre>
        <p>Water flowed under the stone bridge.</p>
      </div>
      <button>the quick brown button label</button>
    `);
    const found = collectTextNodes(body, OPTS).map((n) => n.nodeValue?.trim());
    assert.equal(found.length, 2, `got ${JSON.stringify(found)}`);
    assert.ok(found[0]?.startsWith('The quick brown fox'));
    assert.ok(found[1]?.startsWith('Water flowed'));
  });

  test('a skipped root yields nothing at all', () => {
    const body = load('<pre id="t">the quick brown fox jumped over</pre>');
    const pre = body.querySelector('#t');
    assert.ok(pre);
    assert.deepEqual(collectTextNodes(pre, OPTS), []);
  });

  test('accepts a text node handed in directly', () => {
    const body = load('<p id="t">The quick brown fox jumped over.</p>');
    const node = body.querySelector('#t')?.firstChild as Text | null;
    assert.ok(node);
    assert.equal(collectTextNodes(node, OPTS).length, 1);
  });

  test('rejects a text node whose ancestor is skipped', () => {
    const body = load('<pre><span id="t">the quick brown fox jumped</span></pre>');
    const node = body.querySelector('#t')?.firstChild as Text | null;
    assert.ok(node);
    assert.deepEqual(collectTextNodes(node, OPTS), []);
  });

  test('respects the node limit', () => {
    const body = load('<p>one two three four</p>'.repeat(50));
    assert.equal(collectTextNodes(body, OPTS, 10).length, 10);
  });
});

describe('hasSkippedAncestor', () => {
  test('walks up through the tree', () => {
    const body = load('<div aria-live="polite"><span><em id="t">x</em></span></div>');
    const el = body.querySelector('#t');
    assert.ok(el);
    assert.equal(hasSkippedAncestor(el, OPTS), true);
  });

  test('returns false for a clean ancestry', () => {
    const body = load('<div><span><em id="t">x</em></span></div>');
    const el = body.querySelector('#t');
    assert.ok(el);
    assert.equal(hasSkippedAncestor(el, OPTS), false);
  });

  test('handles null', () => {
    assert.equal(hasSkippedAncestor(null, OPTS), false);
  });
});

describe('documentLanguageMatches', () => {
  test('trusts an explicit document language', () => {
    installDom('');
    document.documentElement.setAttribute('lang', 'fr');
    assert.equal(documentLanguageMatches('en'), false);
    document.documentElement.setAttribute('lang', 'en-US');
    assert.equal(documentLanguageMatches('en'), true);
  });

  test('assumes the source language when no claim is made', () => {
    installDom('');
    document.documentElement.removeAttribute('lang');
    assert.equal(documentLanguageMatches('en'), true);
  });
});

describe('detectFramework', () => {
  test('notices a React marker', () => {
    load('<div data-reactroot><p>hello</p></div>');
    assert.equal(detectFramework(), 'react');
  });

  test('notices Angular and Svelte markers', () => {
    load('<div ng-version="17.0.0"></div>');
    assert.equal(detectFramework(), 'angular');
    load('<div data-svelte-h="abc"></div>');
    assert.equal(detectFramework(), 'svelte');
  });

  test('returns null for a plain document', () => {
    load('<p>plain</p>');
    assert.equal(detectFramework(), null);
  });
});
