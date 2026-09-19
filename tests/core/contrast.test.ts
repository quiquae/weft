import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The tooltip has to be readable, and "looks fine to me" is not a measurement.
 *
 * It lives in a closed shadow root with its own fixed palette, so no page
 * stylesheet and no browser dark-mode setting can rescue it: whatever is
 * hardcoded in that CSS is exactly what every reader gets. That makes it the
 * one surface in the product where a contrast failure is unconditional.
 *
 * One was real. `.hint` was #6f6f7c on #16161c — 3.64:1 against a 4.5:1
 * requirement — and it was simultaneously the smallest text in the card at
 * 0.78em. It also carried the pronunciation note, which for Latin or Old
 * English is the substance of the tooltip rather than a decoration, so the
 * least readable thing on the surface was a paragraph someone needed to
 * read. The note moved to `.note` and the hint colour moved up to a token
 * already in the palette.
 *
 * The second test below is the one that keeps this honest: it fails when a
 * colour is added to the stylesheet and not listed here, so the table cannot
 * quietly fall behind the CSS it is supposed to describe.
 */

const CSS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/content/tooltip.ts',
);

/** The tooltip's stylesheet, as shipped. */
function tooltipCss(): string {
  const src = readFileSync(CSS_PATH, 'utf8');
  const start = src.indexOf('const CSS = `');
  assert.ok(start >= 0, 'could not find the tooltip stylesheet');
  const end = src.indexOf('`;', start);
  assert.ok(end > start, 'tooltip stylesheet is not terminated');
  return src.slice(start + 'const CSS = `'.length, end);
}

/* ------------------------------------------------------------ WCAG maths */

function channels(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const v = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return [v[0] as number, v[1] as number, v[2] as number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/* --------------------------------------------------------------- the table */

/** The card background every foreground here is painted on. */
const CARD_BG = '#16161c';

/**
 * Every foreground colour in the tooltip, with the size it renders at.
 *
 * Sizes are computed from the 13px default (`a11y.minTooltipFontPx`) times
 * the em multiplier in the CSS. The default is the floor — a reader can only
 * raise it — so checking the smallest case checks every case.
 */
const FOREGROUNDS: Array<{ colour: string; where: string; px: number; bold?: boolean }> = [
  { colour: '#f2f2f5', where: '.card body text', px: 13 },
  { colour: '#f2f2f5', where: '.english', px: 14.6, bold: true },
  { colour: '#a79bff', where: '.target', px: 12.4 },
  { colour: '#9a9aa8', where: '.pos', px: 10.7 },
  { colour: '#c9c9d4', where: '.row', px: 11.3 },
  { colour: '#82828f', where: '.key', px: 11.3 },
  { colour: '#ded9ff', where: '.etymon', px: 11.3 },
  { colour: '#fff', where: '.etymon b', px: 11.3, bold: true },
  { colour: '#a8a8b6', where: '.note (and the pronunciation note)', px: 11.1 },
  { colour: '#9a9aa8', where: '.why', px: 10.7 },
  { colour: '#c9c9d4', where: '.example', px: 11.3 },
  { colour: '#82828f', where: '.hint', px: 10.1 },
  { colour: '#d8d8e2', where: 'button label', px: 11.1 },
  { colour: '#e9e6ff', where: 'primary button label', px: 11.1 },
];

/**
 * Colours that are not text, so the 4.5:1 text rule does not apply.
 *
 * Listed rather than ignored, so the completeness check below still forces
 * a decision about every colour in the file.
 */
const NON_TEXT = new Set([
  '#16161c', // the card background itself
  '#33333d', // card border
  '#3a3a46', // button border
  '#22222a', // button background
  '#2c2c36', // button hover background, and the .why divider
  '#4a4a58', // button hover border
  '#2f2a52', // primary button background
  '#4e4585', // primary button border
  '#a79bff', // also the focus ring and the etymon rule
]);

/** WCAG 2.x: 18.66px bold or 24px counts as large text. */
const isLarge = (px: number, bold = false): boolean => px >= 24 || (bold && px >= 18.66);

describe('tooltip contrast', () => {
  test('every foreground meets WCAG AA on the card', () => {
    const failures: string[] = [];
    for (const { colour, where, px, bold } of FOREGROUNDS) {
      const need = isLarge(px, bold) ? 3 : 4.5;
      const got = contrastRatio(colour, CARD_BG);
      if (got < need) {
        failures.push(`${where}: ${colour} on ${CARD_BG} is ${got.toFixed(2)}:1, needs ${need}:1`);
      }
    }
    assert.deepEqual(failures, [], `contrast failures:\n  ${failures.join('\n  ')}`);
  });

  test('the table covers every colour in the stylesheet', () => {
    /*
     * Without this, the table above is a snapshot of whatever the CSS looked
     * like on the day it was written, and the next colour added is simply
     * unchecked. A test that silently stops covering the thing it names is
     * worse than no test.
     */
    const css = tooltipCss();
    const inCss = new Set((css.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).map((c) => c.toLowerCase()));
    const accounted = new Set([
      ...FOREGROUNDS.map((f) => f.colour.toLowerCase()),
      ...[...NON_TEXT].map((c) => c.toLowerCase()),
    ]);

    const unaccounted = [...inCss].filter((c) => !accounted.has(c));
    assert.deepEqual(
      unaccounted,
      [],
      `colours in tooltip.ts that no contrast test covers: ${unaccounted.join(', ')}\n` +
        'Add each to FOREGROUNDS (with its rendered px) or to NON_TEXT.',
    );
  });

  test('the stylesheet no longer contains the colour that failed', () => {
    // Belt and braces: the table could be edited to match a regression.
    assert.ok(
      !tooltipCss().includes('#6f6f7c'),
      '#6f6f7c is back; it is 3.64:1 on the card and fails AA',
    );
  });

  test('the maths agrees with known reference values', () => {
    // A contrast checker that is wrong passes everything. Black on white is
    // exactly 21:1 and a colour against itself is exactly 1:1.
    assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
    assert.equal(contrastRatio('#16161c', '#16161c'), 1);
    // A midpoint grey on white, from the WCAG worked examples.
    assert.ok(Math.abs(contrastRatio('#767676', '#ffffff') - 4.54) < 0.05);
  });
});
