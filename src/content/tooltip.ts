import type { Grade, LangCode, LexEntry, Settings } from '../core/types.ts';
import { getLanguage } from '../core/languages.ts';
import { cognateReason } from '../core/similarity.ts';
import { WEFT_ATTR } from './walker.ts';

/**
 * The reveal tooltip.
 *
 * Lives in a closed shadow root so no page stylesheet can reach it, and so no
 * page script can read it. Reset with `all: initial` on the host, because a
 * surprising number of sites set `* { font-family: ... !important }`.
 *
 * What it shows is a pedagogical decision, not a layout one. The English word
 * comes first and largest, because that is what the reader stopped for. Then
 * the things that make the word stick: gender, because you cannot use a noun
 * without it; IPA, for languages with no voice; and the etymon, which for a
 * historical language is the whole reason to be here — "hus" is not a foreign
 * word to be memorised, it is where "house" came from.
 */

const POS_LABELS: Record<string, string> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  num: 'number',
  pron: 'pronoun',
  prep: 'preposition',
  conj: 'conjunction',
  det: 'determiner',
  intj: 'interjection',
  phrase: 'phrase',
};

const GENDER_LABELS: Record<string, string> = {
  m: 'masculine',
  f: 'feminine',
  n: 'neuter',
  c: 'common',
};

const BAND_LABELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const CSS = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  pointer-events: none;
}
.card {
  pointer-events: auto;
  box-sizing: border-box;
  max-width: 21rem;
  min-width: 11rem;
  padding: 0.7rem 0.8rem 0.6rem;
  border-radius: 0.6rem;
  background: #16161c;
  color: #f2f2f5;
  border: 1px solid #33333d;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.45), 0 1px 2px rgb(0 0 0 / 0.4);
  font: 400 var(--weft-font-size, 13px)/1.45 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
  text-align: left;
  opacity: 0;
  transform: translateY(3px);
  transition: opacity 120ms ease-out, transform 120ms ease-out;
}
.card[data-shown='1'] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .card { transition: none; transform: none; }
}
.head { display: flex; align-items: baseline; gap: 0.45rem; flex-wrap: wrap; }
.english { font-size: 1.12em; font-weight: 600; letter-spacing: -0.005em; }
.target { color: #a79bff; font-size: 0.95em; }
.pos { color: #9a9aa8; font-size: 0.82em; font-style: italic; }
.rows { margin-top: 0.4rem; display: grid; gap: 0.18rem; }
.row { display: flex; gap: 0.4rem; font-size: 0.87em; color: #c9c9d4; }
.key { color: #82828f; min-width: 4.2rem; flex: none; }
.ipa { font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0; }
.etymon {
  margin-top: 0.45rem;
  padding: 0.35rem 0.45rem;
  border-radius: 0.35rem;
  background: rgb(167 155 255 / 0.12);
  border-left: 2px solid #a79bff;
  font-size: 0.87em;
  color: #ded9ff;
}
.etymon b { color: #fff; font-weight: 600; }
.note { margin-top: 0.4rem; font-size: 0.85em; color: #a8a8b6; }
.example { margin-top: 0.4rem; font-size: 0.87em; color: #c9c9d4; font-style: italic; }
.actions { margin-top: 0.55rem; display: flex; gap: 0.35rem; align-items: center; }
button {
  all: unset;
  cursor: pointer;
  font: inherit;
  font-size: 0.85em;
  padding: 0.22rem 0.5rem;
  border-radius: 0.3rem;
  border: 1px solid #3a3a46;
  color: #d8d8e2;
  background: #22222a;
}
button:hover { background: #2c2c36; border-color: #4a4a58; }
button:focus-visible { outline: 2px solid #a79bff; outline-offset: 1px; }
button[data-primary='1'] { background: #2f2a52; border-color: #4e4585; color: #e9e6ff; }
.spacer { flex: 1; }
.hint { color: #6f6f7c; font-size: 0.78em; }
.speak { font-size: 1em; line-height: 1; padding: 0.22rem 0.42rem; }
`;

export interface TooltipContent {
  entry: LexEntry;
  target: LangCode;
  /** The English text actually on the page, case included. */
  original: string;
  /** The woven text actually on the page. */
  replacement: string;
}

export interface TooltipCallbacks {
  onGrade(lemma: string, grade: Grade): void;
  onSpeak(text: string, lang: string | null): void;
}

export class Tooltip {
  private host: HTMLElement;
  private root: ShadowRoot;
  private card: HTMLElement;
  private shown = false;
  private currentLemma: string | null = null;

  private settings: Settings;
  private callbacks: TooltipCallbacks;

  constructor(settings: Settings, callbacks: TooltipCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.host = document.createElement('weft-tooltip');
    this.host.setAttribute(WEFT_ATTR, '1');
    this.root = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = CSS;
    this.card = document.createElement('div');
    this.card.className = 'card';
    this.card.setAttribute('role', 'tooltip');
    this.root.append(style, this.card);

    this.host.style.top = '-9999px';
    this.host.style.left = '-9999px';
    this.applyFontSize();
  }

  attach(): void {
    if (!this.host.isConnected) (document.body ?? document.documentElement).append(this.host);
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.applyFontSize();
  }

  private applyFontSize(): void {
    this.host.style.setProperty('--weft-font-size', `${this.settings.a11y.minTooltipFontPx}px`);
  }

  isOpen(): boolean {
    return this.shown;
  }

  /** True when the pointer is inside the tooltip itself. */
  containsPoint(x: number, y: number): boolean {
    if (!this.shown) return false;
    const rect = this.card.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  show(content: TooltipContent, anchor: DOMRect, viaKeyboard: boolean): void {
    this.render(content);
    this.attach();
    this.currentLemma = content.entry.tgtLemma;
    this.position(anchor);
    this.shown = true;
    this.card.setAttribute('data-shown', '1');
    if (viaKeyboard) {
      const first = this.card.querySelector('button');
      (first as HTMLElement | null)?.focus({ preventScroll: true });
    }
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.currentLemma = null;
    this.card.removeAttribute('data-shown');
    this.host.style.top = '-9999px';
    this.host.style.left = '-9999px';
  }

  destroy(): void {
    this.host.remove();
  }

  private position(anchor: DOMRect): void {
    // Measure off-screen first so the flip decision uses the real height.
    this.host.style.top = '0px';
    this.host.style.left = '0px';
    const card = this.card.getBoundingClientRect();
    const margin = 8;
    const gap = 6;

    let top = anchor.top - card.height - gap;
    if (top < margin) top = anchor.bottom + gap;
    if (top + card.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - card.height - margin);
    }

    let left = anchor.left + anchor.width / 2 - card.width / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - card.width - margin);

    this.host.style.top = `${Math.round(top)}px`;
    this.host.style.left = `${Math.round(left)}px`;
  }

  private render(content: TooltipContent): void {
    const { entry, target, original, replacement } = content;
    const meta = getLanguage(target);
    const reveal = this.settings.reveal;
    const card = this.card;
    card.textContent = '';

    const head = el('div', 'head');
    head.append(el('span', 'english', original));
    head.append(el('span', 'target', replacement));
    if (reveal.showPos) {
      head.append(el('span', 'pos', POS_LABELS[entry.pos] ?? entry.pos));
    }
    card.append(head);

    const rows = el('div', 'rows');
    const addRow = (key: string, value: string, valueClass = '') => {
      const row = el('div', 'row');
      row.append(el('span', 'key', key));
      row.append(el('span', valueClass, value));
      rows.append(row);
    };

    if (reveal.showGender && entry.gender) {
      addRow('gender', GENDER_LABELS[entry.gender] ?? entry.gender);
    }
    if (reveal.showIpa && entry.ipa) addRow('sound', entry.ipa, 'ipa');
    if (reveal.showBand) addRow('level', BAND_LABELS[entry.band] ?? String(entry.band));
    if (rows.children.length) card.append(rows);

    if (reveal.showEtymon && entry.etymonOf) {
      const box = el('div', 'etymon');
      box.append(document.createTextNode(`${meta.historical ? 'Ancestor of' : 'Related to'} English `));
      const strong = document.createElement('b');
      strong.textContent = entry.etymonOf;
      box.append(strong);
      card.append(box);
    } else if (reveal.showEtymon) {
      const reason = cognateReason(entry);
      if (reason) card.append(el('div', 'note', reason.charAt(0).toUpperCase() + reason.slice(1)));
    }

    if (entry.note) card.append(el('div', 'note', entry.note));

    if (reveal.showExample && entry.example) {
      const box = el('div', 'example');
      box.textContent = entry.example;
      if (entry.exampleGloss) {
        box.append(document.createElement('br'));
        box.append(document.createTextNode(entry.exampleGloss));
      }
      card.append(box);
    }

    if (meta.historical && meta.pronunciationNote && reveal.showIpa) {
      card.append(el('div', 'hint', meta.pronunciationNote));
    }

    const actions = el('div', 'actions');
    if (reveal.grading !== 'off') {
      const knew = button('I knew it', true);
      knew.addEventListener('click', () => {
        if (this.currentLemma) this.callbacks.onGrade(this.currentLemma, 4 as Grade);
        this.hide();
      });
      const unsure = button('Not sure');
      unsure.addEventListener('click', () => {
        if (this.currentLemma) this.callbacks.onGrade(this.currentLemma, 2 as Grade);
        this.hide();
      });
      actions.append(knew, unsure);
    }
    actions.append(el('span', 'spacer'));

    if (reveal.tts) {
      if (meta.ttsLang) {
        const speak = button('🔊');
        speak.classList.add('speak');
        speak.setAttribute('aria-label', `Pronounce ${replacement}`);
        speak.addEventListener('click', () => this.callbacks.onSpeak(replacement, meta.ttsLang));
        actions.append(speak);
      } else {
        actions.append(el('span', 'hint', 'no voice for this language'));
      }
    }
    card.append(actions);
  }
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (primary) b.setAttribute('data-primary', '1');
  return b;
}
