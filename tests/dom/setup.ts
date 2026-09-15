import { JSDOM } from 'jsdom';

/**
 * Install a DOM into the global scope for tests.
 *
 * The content script reaches for `document`, `Node`, `NodeFilter` and friends
 * as globals, exactly as it does in a page, so the tests give it globals
 * rather than threading a document through the code. That keeps the
 * production path free of test-only indirection.
 */
export function installDom(html: string): JSDOM {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    pretendToBeVisual: true,
    url: 'https://example.test/page',
  });

  const g = globalThis as unknown as Record<string, unknown>;
  g['window'] = dom.window;
  g['document'] = dom.window.document;
  g['Node'] = dom.window.Node;
  g['NodeFilter'] = dom.window.NodeFilter;
  g['Element'] = dom.window.Element;
  g['HTMLElement'] = dom.window.HTMLElement;
  g['Text'] = dom.window.Text;
  g['Range'] = dom.window.Range;
  g['DocumentFragment'] = dom.window.DocumentFragment;
  g['MutationObserver'] = dom.window.MutationObserver;
  g['CSS'] = dom.window.CSS ?? {};

  // Node exposes a getter-only global `navigator`, so it has to be redefined
  // rather than assigned.
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });

  return dom;
}

export function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) out.push(node as Text);
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  walk(root);
  return out;
}
