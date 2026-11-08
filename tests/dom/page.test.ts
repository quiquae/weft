import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom } from './setup.ts';
import type { LexPack, Settings } from '../../src/core/types.ts';
import type { PageState } from '../../src/shared/messages.ts';
import type { Renderer } from '../../src/content/renderer.ts';
import type { WovenRecord } from '../../src/content/weave.ts';

/**
 * The content script's page object, outside the browser.
 *
 * `WeftPage` keeps the bookkeeping that decides what a page shows: a record
 * for each woven node, the nodes that wove nothing, the nodes it made itself,
 * and the queue the idle scanner reads. Until 2026-11-08 every defect found in
 * that bookkeeping was held only by an end-to-end test in a real Chromium, and
 * two of its guards by nothing at all. The class lived in the module that
 * boots the content script, which reads the extension's namespace and
 * registers a message listener the moment it is imported, so nothing could
 * construct it anywhere else. It has a module of its own now, and these tests
 * build it in jsdom, handing it a renderer that writes `nodeValue` in place
 * as the highlight renderer does, or the real wrapped renderer, with the
 * extension's namespace faked so the real `send()` has somewhere to post.
 */

const dom = installDom('');
const g = globalThis as unknown as Record<string, unknown>;
// Build-time constants esbuild would otherwise have inlined.
g['__WEFT_TARGET__'] = 'chrome';
g['__WEFT_DEV__'] = false;
g['location'] = dom.window.location;
// The page posts what it records to the worker; here nothing answers, which
// `send()` reads as no reply, as it does when the worker is asleep.
g['chrome'] = { runtime: { id: 'weft-test', sendMessage: async () => undefined } };

const { WeftPage } = await import('../../src/content/page.ts');
const { WrappedRenderer } = await import('../../src/content/render-wrapped.ts');
const { defaultSettings } = await import('../../src/core/settings.ts');

const pack = JSON.parse(
  readFileSync(new URL('../../src/lexicon/packs/en-fr.json', import.meta.url), 'utf8'),
) as LexPack;

/** English the French pack can weave much of: every noun here is in it. */
const PARAGRAPH =
  'The house by the water stood at the end of the road, and every morning the bread came ' +
  'from the city across the river, past the tree where a bird sang to the horse at the door.';

/** What the highlight renderer does to the tree, and nothing else. */
class NodeValueRenderer implements Renderer {
  readonly mode = 'highlight' as const;
  readonly applied: WovenRecord[] = [];
  apply(record: WovenRecord): void {
    this.applied.push(record);
    record.node.nodeValue = record.woven;
  }
  revert(record: WovenRecord): void {
    if (record.node.nodeValue === record.woven) record.node.nodeValue = record.original;
  }
  setRevealed(): void {}
  clearRevealed(): void {}
  hitTest(): null {
    return null;
  }
  rectFor(): null {
    return null;
  }
  flush(): void {}
  updateSettings(): void {}
  destroy(): void {}
}

function stateFor(ratio: number, settings: Settings = defaultSettings(Date.now(), 'test')): PageState {
  return {
    settings,
    tier: 'free',
    decision: {
      mode: 'taxed',
      rule: null,
      attentionKey: 'example.test',
      baseRatio: ratio,
      ceilingRatio: ratio,
      escalate: false,
      target: 'fr',
    },
    ratio,
    attentionSeconds: 0,
    cards: {},
    introducedToday: [],
    panicActive: false,
    effectiveLevel: 1,
    penaltyActive: false,
  };
}

const live: Array<InstanceType<typeof WeftPage>> = [];

function open(state: PageState, renderer: Renderer): InstanceType<typeof WeftPage> {
  const page = new WeftPage(state, pack, renderer);
  live.push(page);
  page.start();
  return page;
}

/** The paragraph's one text node, as the page wrote it. */
function paragraph(text: string): Text {
  document.body.replaceChildren();
  const p = document.createElement('p');
  p.textContent = text;
  document.body.append(p);
  return p.firstChild as Text;
}

/** Let the idle scanner, on 16 ms timeouts in jsdom, read its queue to the end. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

afterEach(() => {
  for (const page of live.splice(0)) page.destroy();
  document.body.replaceChildren();
});

describe('the page object, built in jsdom', () => {
  test('weaves a page through the renderer it is handed', async () => {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    open(stateFor(0.35), renderer);
    await settle();
    assert.equal(renderer.applied.length, 1, 'one paragraph should be woven once');
    assert.equal(renderer.applied[0]!.original, PARAGRAPH);
    assert.ok(renderer.applied[0]!.swaps.length > 0, 'the paragraph wove no word');
    assert.equal(node.nodeValue, renderer.applied[0]!.woven);
  });
});

describe('the bookkeeping that decides what a page shows', () => {
  test('a paragraph the page rewrites before the scan reaches it is woven once', async () => {
    // start() queues the node, and the rewrite queues it again, from the
    // observer, before the idle scanner has run. Read a second time, its value
    // is the woven text, and weaving that as English weaves the page twice.
    const node = paragraph('The road ran down to the water.');
    const renderer = new NodeValueRenderer();
    open(stateFor(0.35), renderer);
    node.nodeValue = PARAGRAPH;
    await settle();
    const woven = renderer.applied.filter((record) => record.node === node);
    assert.equal(woven.length, 1, `the paragraph was woven ${woven.length} times`);
    assert.equal(woven[0]!.original, PARAGRAPH);
    assert.equal(node.nodeValue, woven[0]!.woven);
  });

  test('a page suspended before its scan weaves nothing it had queued', async () => {
    // A panic pass can arrive between start() queueing the page and the idle
    // scanner reading the queue.
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.35), renderer);
    page.suspend();
    await settle();
    assert.equal(renderer.applied.length, 0, 'a suspended page wove what it had queued');
    assert.equal(node.nodeValue, PARAGRAPH);
  });

  test('a woven page suspended stays in English', async () => {
    // suspend() writes the English back into every node it wove. Read as the
    // page rewriting its own text, that write is queued and woven again, and
    // a panic pass ends a moment after it starts.
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.35), renderer);
    await settle();
    assert.equal(renderer.applied.length, 1);
    page.suspend();
    await settle();
    assert.equal(node.nodeValue, PARAGRAPH, 'the suspended page is woven again');
    assert.equal(renderer.applied.length, 1, `the paragraph was woven ${renderer.applied.length} times`);
  });

  test('and weaves the page again when it resumes', async () => {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.35), renderer);
    page.suspend();
    await settle();
    page.resume();
    await settle();
    assert.equal(renderer.applied.length, 1);
    assert.equal(node.nodeValue, renderer.applied[0]!.woven);
  });

  test('a paragraph that wove nothing at rest is woven when the density rises', async () => {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const settings = defaultSettings(Date.now(), 'test');
    const page = open(stateFor(0, settings), renderer);
    await settle();
    assert.equal(renderer.applied.length, 0, 'a resting density of 0 wove a word');
    page.applySettings(settings, 0.35, 1);
    await settle();
    assert.equal(renderer.applied.length, 1, 'the re-weave never reached the paragraph that wove nothing');
    assert.equal(node.nodeValue, renderer.applied[0]!.woven);
  });

  test('the wrapped renderer replacing a node is not read as the page changing', async () => {
    // The renderer swaps the text node for a fragment, which the observer
    // reports as a removal and several additions. Read as the page's doing,
    // the English runs it inserted are queued and woven again.
    paragraph(PARAGRAPH);
    const settings = defaultSettings(Date.now(), 'test');
    const renderer = new WrappedRenderer(settings, 'fr');
    const applied: WovenRecord[] = [];
    const apply = renderer.apply.bind(renderer);
    renderer.apply = (record) => {
      applied.push(record);
      apply(record);
    };
    open(stateFor(0.35, settings), renderer);
    await settle();
    assert.equal(applied.length, 1, `one paragraph was woven ${applied.length} times`);
    const swaps = document.querySelectorAll('p [data-weft-swap]');
    assert.equal(swaps.length, applied[0]!.swaps.length, 'the words woven are not the words on the page');
    assert.equal(document.querySelector('p')!.textContent, applied[0]!.woven);
  });

  test('a re-weave in wrapped mode reaches the nodes the renderer replaced', async () => {
    // Reverting a wrapped weave puts a fresh text node back, so by then the
    // record's key is a node no longer on the page. Read by its keys, the
    // re-weave skipped every node and left the page in English after the
    // first time the density moved.
    paragraph(PARAGRAPH);
    const settings = defaultSettings(Date.now(), 'test');
    const page = open(stateFor(0.2, settings), new WrappedRenderer(settings, 'fr'));
    await settle();
    const before = document.querySelectorAll('p [data-weft-swap]').length;
    assert.ok(before > 0, 'the paragraph wove no word at 20%');
    page.applySettings(settings, 0.35, 1);
    await settle();
    const after = document.querySelectorAll('p [data-weft-swap]').length;
    assert.ok(after >= before, `the re-weave left ${after} of the ${before} words woven`);
  });
});
