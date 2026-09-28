/**
 * The landing page's demo has to show the extension a visitor will install.
 *
 * `site/index.html` carries its own `BASE`/`CEILING`/`GAIN`, because it is a
 * static page with no build step — nothing imports `src/core/settings.ts` into
 * it. That copy is free to drift from the shipped default, and it had: the
 * demo read 59.7% at forty minutes where the default reaches 33.2% and cannot
 * pass 35% at any attention at all. A visitor dragged the slider, watched the
 * passage go 60% French, installed, and got a third.
 *
 * So the guard is here rather than in the page: the demo's readout is checked
 * against `weaveRatio` on `defaultSettings`, which is what a fresh install
 * actually runs. If either moves, this names it.
 *
 * It lives in `tests/tools/` and not `tests/core/` because it reads a file off
 * disk, which that suite's no-I/O rule forbids, and not in `tests/dom/`
 * because those build their HTML in memory rather than loading the shipped
 * artefact. This suite's job is already checking shipped artefacts against the
 * sources they are supposed to agree with.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { defaultSettings } from '../../src/core/settings.ts';
import { weaveRatio } from '../../src/core/escalation.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PAGE = join(ROOT, 'site/index.html');

const settings = defaultSettings(0, 'test');
const curve = {
  baseRatio: settings.weave.baseRatio,
  ceilingRatio: settings.weave.ceilingRatio,
  gainPerMinute: settings.attention.gainPerMinute,
  escalate: true,
};

/**
 * Candidates counted from the passage's own `{english|french}` markers rather
 * than from the demo's internals, so the expected figure does not come from
 * the code under test.
 *
 * Counted inside the `PASSAGE` declaration and not across the whole file: the
 * doc comment above it writes `{english|french}` to explain the notation, and
 * counting that too gave 24 where the demo uses 23 — which moved every
 * expected percentage and was caught only because the first run printed them.
 */
function candidateCount(html: string): number {
  const passage = html.match(/var PASSAGE =\n([\s\S]*?);\n/);
  assert.ok(passage, 'the demo passage is no longer declared as `var PASSAGE =`');
  return [...passage[1]!.matchAll(/\{[^|}]+\|[^}]+\}/g)].length;
}

let dom: JSDOM;
let slider: HTMLInputElement;
let readout: HTMLElement;
let candidates: number;

/** The readout's percentage after dragging the slider to `minutes`. */
function percentAt(minutes: number): number {
  slider.value = String(minutes);
  slider.dispatchEvent(new dom.window.Event('input'));
  const text = readout.textContent ?? '';
  const m = text.match(/^(\d+)%/);
  assert.ok(m, `the readout did not start with a percentage: ${JSON.stringify(text)}`);
  return Number(m[1]);
}

/** What the readout should say: the shipped curve, rounded as the demo rounds. */
function expectedPercent(minutes: number): number {
  const ratio = weaveRatio({ ...curve, attentionSeconds: minutes * 60 });
  return Math.round((Math.round(ratio * candidates) / candidates) * 100);
}

before(() => {
  const html = readFileSync(PAGE, 'utf8');
  candidates = candidateCount(html);
  assert.ok(candidates > 10, `the demo passage has only ${candidates} candidates`);

  dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://weft.study/' });
  slider = dom.window.document.getElementById('minutes') as HTMLInputElement;
  readout = dom.window.document.getElementById('readout') as HTMLElement;
  assert.ok(slider && readout, 'the demo slider or its readout is missing from the page');
});

describe('the landing demo shows the extension that ships', () => {
  test('its curve is the shipped default preset, minute by minute', () => {
    const wrong: string[] = [];
    for (const minutes of [0, 4, 5, 10, 15, 20, 30, 40, 45]) {
      const got = percentAt(minutes);
      const want = expectedPercent(minutes);
      if (got !== want) wrong.push(`${minutes} min: demo says ${got}%, the default gives ${want}%`);
    }
    assert.deepEqual(wrong, [], `the demo is not running the shipped default:\n  ${wrong.join('\n  ')}`);
  });

  test('it never claims more than the default can reach', () => {
    const max = Number(slider.max);
    const ceiling = Math.round(settings.weave.ceilingRatio * 100);
    const got = percentAt(max);
    assert.ok(
      got <= ceiling,
      `at ${max} minutes the demo reads ${got}%, above the ${ceiling}% the shipped default ceilings at`,
    );
  });

  /*
   * The comment at the top of the demo records that an earlier passage "made
   * the demo saturate at 35% and stop responding", and that this was fixed by
   * spreading the candidates out so the minimum-gap rule stops binding. That
   * was never asserted, so the next edit to the passage could put it back —
   * and the repair applied at the time was to raise the constants, which is
   * the bug the first test here exists to catch. Assert the property instead.
   */
  test('the slider still responds across its whole range', () => {
    const seen = new Set<number>();
    for (let minutes = 0; minutes <= Number(slider.max); minutes++) seen.add(percentAt(minutes));
    assert.ok(
      seen.size >= 5,
      `dragging the slider through its whole range produces only ${seen.size} distinct readouts, ` +
        'so the demo has saturated and stopped responding',
    );
  });
});
