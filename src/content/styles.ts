import type { Settings } from '../core/types.ts';

/**
 * Page-level styling for woven words.
 *
 * Delivered as a constructed stylesheet adopted into the document rather than
 * an injected <style> element. Two reasons, and the second is the important
 * one:
 *
 *  1. A page with `style-src 'self'` in its Content-Security-Policy blocks an
 *     inline <style>, silently. CSSOM-inserted rules are not subject to CSP,
 *     so this always applies.
 *  2. `::highlight()` rules must live in a stylesheet attached to the same
 *     document as the highlighted text. A stylesheet inside a shadow root
 *     cannot style light-DOM highlights, so the shadow-root trick that keeps
 *     our tooltip isolated is not available here.
 */

let sheet: CSSStyleSheet | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [124, 92, 255];
  return [parseInt(m[1] as string, 16), parseInt(m[2] as string, 16), parseInt(m[3] as string, 16)];
}

export function cssFor(settings: Settings): string {
  const { style } = settings.weave;
  const [r, g, b] = hexToRgb(style.tint);
  const tint = `rgb(${r} ${g} ${b} / ${style.tintOpacity})`;
  const tintStrong = `rgb(${r} ${g} ${b} / ${Math.min(1, style.tintOpacity * 3.2)})`;
  const line = style.underline === 'none' ? 'none' : `underline ${style.underline}`;
  const weight = style.weight === 'inherit' ? '' : `font-weight: ${style.weight};`;
  const italic = style.italic ? 'font-style: italic;' : '';
  const contrast = settings.a11y.highContrast;

  return `
::highlight(weft-woven) {
  background-color: ${contrast ? tintStrong : tint};
  text-decoration: ${contrast ? `underline solid` : line};
  text-decoration-color: rgb(${r} ${g} ${b} / 0.85);
  text-underline-offset: 0.18em;
  text-decoration-thickness: ${contrast ? '2px' : 'from-font'};
}

::highlight(weft-active) {
  background-color: rgb(${r} ${g} ${b} / 0.28);
  text-decoration: underline solid;
  text-decoration-color: rgb(${r} ${g} ${b} / 1);
}

::highlight(weft-retired) {
  text-decoration: ${line};
  text-decoration-color: rgb(${r} ${g} ${b} / 0.35);
  text-underline-offset: 0.18em;
}

weft-w {
  display: inline;
  background-color: ${contrast ? tintStrong : tint};
  text-decoration: ${contrast ? 'underline solid' : line};
  text-decoration-color: rgb(${r} ${g} ${b} / 0.85);
  text-underline-offset: 0.18em;
  border-radius: 2px;
  cursor: help;
  ${weight}
  ${italic}
}

weft-w[data-weft-active='1'] {
  background-color: rgb(${r} ${g} ${b} / 0.28);
  text-decoration-color: rgb(${r} ${g} ${b} / 1);
}

weft-w:focus-visible {
  outline: 2px solid rgb(${r} ${g} ${b} / 1);
  outline-offset: 1px;
}

@media (prefers-contrast: more) {
  ::highlight(weft-woven) { background-color: ${tintStrong}; }
  weft-w { background-color: ${tintStrong}; }
}
`;
}

export function applyPageStyles(settings: Settings): void {
  const css = cssFor(settings);
  try {
    if (!sheet) {
      sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
    sheet.replaceSync(css);
  } catch {
    // Older engines without constructable stylesheets: fall back to a style
    // element, accepting that a strict style-src may drop it.
    const existing = document.getElementById('weft-styles');
    const el = existing ?? document.createElement('style');
    el.id = 'weft-styles';
    el.setAttribute('data-weft', '1');
    el.textContent = css;
    if (!existing) (document.head ?? document.documentElement).append(el);
  }
}

export function removePageStyles(): void {
  if (sheet) {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    sheet = null;
  }
  document.getElementById('weft-styles')?.remove();
}
