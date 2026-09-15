import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.ts';
import type { LexEntry, Swap } from '../../src/core/types.ts';

installDom('');

const { computeWoven, swapAtOffset } = await import('../../src/content/weave.ts');
const { WrappedRenderer, resolveRenderMode } = await import('../../src/content/render-wrapped.ts');
const { HighlightRenderer } = await import('../../src/content/render-highlight.ts');
const { cssFor, applyPageStyles, removePageStyles } = await import('../../src/content/styles.ts');
const { defaultSettings } = await import('../../src/core/settings.ts');

const settings = defaultSettings(Date.now(), 'test');

function entry(src: string, tgt: string): LexEntry {
  return {
    src,
    lemma: src,
    pos: 'noun',
    tgt,
    tgtLemma: tgt,
    zipf: 4,
    senses: 1,
    conf: 0.95,
    band: 1,
  };
}

function swap(text: string, word: string, replacement: string, retired = false): Swap {
  const start = text.indexOf(word);
  assert.ok(start >= 0, `"${word}" not in ${JSON.stringify(text)}`);
  return {
    tokenIndex: 0,
    start,
    end: start + word.length,
    original: word,
    replacement,
    entry: entry(word, replacement),
    retired,
  };
}

describe('computeWoven', () => {
  const text = 'The cat sat on the mat by the house.';

  test('produces the woven string', () => {
    const { woven } = computeWoven(text, [swap(text, 'cat', 'chat'), swap(text, 'house', 'maison')]);
    assert.equal(woven, 'The chat sat on the mat by the maison.');
  });

  test('offsets point into the woven string, not the original', () => {
    // "cat" -> "chat" shifts everything after it by one character. If the
    // offsets were reused unchanged the underline would land on the wrong
    // letters, which is the most visible possible bug.
    const { woven, applied } = computeWoven(text, [
      swap(text, 'cat', 'chat'),
      swap(text, 'house', 'maison'),
    ]);
    for (const a of applied) {
      assert.equal(woven.slice(a.start, a.end), a.replacement);
    }
  });

  test('is a no-op with no swaps', () => {
    const { woven, applied } = computeWoven(text, []);
    assert.equal(woven, text);
    assert.deepEqual(applied, []);
  });

  test('handles swaps given out of order', () => {
    const { woven } = computeWoven(text, [swap(text, 'house', 'maison'), swap(text, 'cat', 'chat')]);
    assert.equal(woven, 'The chat sat on the mat by the maison.');
  });

  test('drops an overlapping swap rather than corrupting the text', () => {
    const overlapping: Swap = { ...swap(text, 'cat', 'chat'), start: 5, end: 9 };
    const { woven } = computeWoven(text, [swap(text, 'cat', 'chat'), overlapping]);
    assert.ok(woven.includes('chat'));
    assert.ok(!woven.includes('chatt'), `corrupted: ${woven}`);
  });

  test('handles a swap at the very start and very end', () => {
    const t = 'cat and house';
    const { woven } = computeWoven(t, [swap(t, 'cat', 'chat'), swap(t, 'house', 'maison')]);
    assert.equal(woven, 'chat and maison');
  });

  test('carries the retired flag through', () => {
    const { applied } = computeWoven(text, [swap(text, 'cat', 'chat', true)]);
    assert.equal(applied[0]?.retired, true);
  });
});

describe('swapAtOffset', () => {
  const text = 'The cat sat on the mat.';
  const { woven, applied } = computeWoven(text, [swap(text, 'cat', 'chat')]);
  const record = { node: null as unknown as Text, original: text, woven, swaps: applied, sourceSwaps: [] };
  const first = applied[0];

  test('finds the swap containing an offset', () => {
    assert.ok(first);
    assert.equal(swapAtOffset(record, first.start), first);
    assert.equal(swapAtOffset(record, first.start + 1), first);
    assert.equal(swapAtOffset(record, first.end - 1), first);
  });

  test('treats the closing boundary as inside', () => {
    // A caret sitting exactly at the end of a word still belongs to it, and
    // that is where the caret lands when you hover the right-hand edge.
    assert.ok(first);
    assert.equal(swapAtOffset(record, first.end), first);
  });

  test('returns null outside every swap', () => {
    assert.equal(swapAtOffset(record, 0), null);
    assert.equal(swapAtOffset(record, woven.length - 1), null);
  });
});

describe('WrappedRenderer', () => {
  function setup(text: string, swaps: Swap[]) {
    installDom(`<p id="t">${text}</p>`);
    const node = document.querySelector('#t')?.firstChild as Text;
    const { woven, applied } = computeWoven(text, swaps);
    const record = { node, original: text, woven, swaps: applied, sourceSwaps: swaps };
    const renderer = new WrappedRenderer(settings, 'fr');
    return { renderer, record, node };
  }

  const TEXT = 'The cat sat on the mat by the house.';

  test('replaces the text node with elements carrying lang', () => {
    const { renderer, record } = setup(TEXT, [swap(TEXT, 'cat', 'chat')]);
    renderer.apply(record);
    const el = document.querySelector('weft-w');
    assert.ok(el, 'no wrapped element was created');
    assert.equal(el.textContent, 'chat');
    assert.equal(el.getAttribute('lang'), 'fr');
    assert.equal(el.getAttribute('title'), 'cat', 'the English must be available without a tooltip');
    assert.equal(document.querySelector('#t')?.textContent, 'The chat sat on the mat by the house.');
  });

  test('is keyboard reachable when the setting allows it', () => {
    const { renderer, record } = setup(TEXT, [swap(TEXT, 'cat', 'chat')]);
    renderer.apply(record);
    const el = document.querySelector('weft-w') as HTMLElement;
    assert.equal(el.tabIndex, 0);
  });

  test('marks retired words so they can be styled more faintly', () => {
    const { renderer, record } = setup(TEXT, [swap(TEXT, 'cat', 'chat', true)]);
    renderer.apply(record);
    assert.equal(document.querySelector('weft-w')?.getAttribute('data-weft-retired'), '1');
  });

  test('revert restores the original text exactly', () => {
    const { renderer, record } = setup(TEXT, [
      swap(TEXT, 'cat', 'chat'),
      swap(TEXT, 'house', 'maison'),
    ]);
    renderer.apply(record);
    assert.notEqual(document.querySelector('#t')?.textContent, TEXT);
    renderer.revert(record);
    assert.equal(document.querySelector('#t')?.textContent, TEXT);
    assert.equal(document.querySelectorAll('weft-w').length, 0);
    assert.equal(document.querySelector('#t')?.childNodes.length, 1, 'should collapse to one text node');
  });

  test('destroy reverts everything it applied', () => {
    installDom('<p id="a">The cat sat on the mat here.</p><p id="b">The house is by the road.</p>');
    const renderer = new WrappedRenderer(settings, 'fr');
    for (const [id, word, target] of [
      ['#a', 'cat', 'chat'],
      ['#b', 'house', 'maison'],
    ] as const) {
      const node = document.querySelector(id)?.firstChild as Text;
      const text = node.nodeValue as string;
      const { woven, applied } = computeWoven(text, [swap(text, word, target)]);
      renderer.apply({ node, original: text, woven, swaps: applied, sourceSwaps: [] });
    }
    assert.equal(document.querySelectorAll('weft-w').length, 2);
    renderer.destroy();
    assert.equal(document.querySelectorAll('weft-w').length, 0);
    assert.equal(document.querySelector('#a')?.textContent, 'The cat sat on the mat here.');
    assert.equal(document.querySelector('#b')?.textContent, 'The house is by the road.');
  });

  test('applying to a detached node does not throw', () => {
    const { renderer, record, node } = setup(TEXT, [swap(TEXT, 'cat', 'chat')]);
    node.remove();
    assert.doesNotThrow(() => renderer.apply(record));
  });

  test('reverting a record that was never applied does not throw', () => {
    const { renderer, record } = setup(TEXT, [swap(TEXT, 'cat', 'chat')]);
    assert.doesNotThrow(() => renderer.revert(record));
  });

  test('resolves an element back to its swap', () => {
    const { renderer, record } = setup(TEXT, [swap(TEXT, 'cat', 'chat')]);
    renderer.apply(record);
    const el = document.querySelector('weft-w') as HTMLElement;
    const hit = renderer.hitForElement(el);
    assert.ok(hit);
    assert.equal(hit.swap.replacement, 'chat');
  });

  test('setRevealed marks one element at a time', () => {
    const { renderer, record } = setup(TEXT, [
      swap(TEXT, 'cat', 'chat'),
      swap(TEXT, 'house', 'maison'),
    ]);
    renderer.apply(record);
    const [a, b] = [...document.querySelectorAll('weft-w')];
    const swapA = record.swaps[0];
    const swapB = record.swaps[1];
    assert.ok(swapA && swapB);

    renderer.setRevealed(record, swapA);
    assert.equal(a?.getAttribute('data-weft-active'), '1');
    renderer.setRevealed(record, swapB);
    assert.equal(a?.getAttribute('data-weft-active'), null, 'the previous one must clear');
    assert.equal(b?.getAttribute('data-weft-active'), '1');
    renderer.clearRevealed();
    assert.equal(b?.getAttribute('data-weft-active'), null);
  });
});

describe('resolveRenderMode', () => {
  test('prefers the structurally safe renderer by default', () => {
    assert.equal(resolveRenderMode(settings, null, true).mode, 'highlight');
  });

  test('stays safe when a framework is present', () => {
    const choice = resolveRenderMode(settings, 'react', true);
    assert.equal(choice.mode, 'highlight');
    assert.match(choice.reason, /react/);
  });

  test('falls back to wrapping when the Highlight API is missing', () => {
    const choice = resolveRenderMode(settings, null, false);
    assert.equal(choice.mode, 'wrapped');
    assert.match(choice.reason, /unavailable/);
  });

  test('an accessibility preference overrides everything', () => {
    const a11y = { ...settings, a11y: { ...settings.a11y, preferWrappedForAT: true } };
    const choice = resolveRenderMode(a11y, 'react', true);
    assert.equal(choice.mode, 'wrapped');
    assert.match(choice.reason, /accessibility/);
  });

  test('an explicit setting is honoured', () => {
    const forced = { ...settings, weave: { ...settings.weave, renderMode: 'wrapped' as const } };
    assert.equal(resolveRenderMode(forced, null, true).mode, 'wrapped');
  });
});

describe('HighlightRenderer.supported', () => {
  test('reports false where the API is absent, so the fallback is chosen', () => {
    // jsdom has no Custom Highlight API, which is exactly the environment the
    // fallback exists for.
    assert.equal(HighlightRenderer.supported(), false);
  });
});

describe('page styles', () => {
  test('emit rules for both renderers', () => {
    const css = cssFor(settings);
    assert.match(css, /::highlight\(weft-woven\)/);
    assert.match(css, /::highlight\(weft-active\)/);
    assert.match(css, /::highlight\(weft-retired\)/);
    assert.match(css, /weft-w\s*\{/);
  });

  test('reflect the configured tint and underline', () => {
    const css = cssFor({
      ...settings,
      weave: {
        ...settings.weave,
        style: { ...settings.weave.style, tint: '#ff0000', underline: 'dashed' },
      },
    });
    assert.match(css, /rgb\(255 0 0/);
    assert.match(css, /underline dashed/);
  });

  test('high contrast strengthens the treatment', () => {
    const css = cssFor({ ...settings, a11y: { ...settings.a11y, highContrast: true } });
    assert.match(css, /underline solid/);
    assert.match(css, /text-decoration-thickness: 2px/);
  });

  test('fall back to a style element where constructable sheets are absent', () => {
    installDom('<p>x</p>');
    applyPageStyles(settings);
    const el = document.getElementById('weft-styles');
    assert.ok(el, 'expected a fallback style element in jsdom');
    assert.match(el.textContent ?? '', /::highlight/);
    removePageStyles();
    assert.equal(document.getElementById('weft-styles'), null);
  });
});
