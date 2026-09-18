import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.ts';

installDom('<p>host</p>');

const { Announcer, ANNOUNCER_ATTR } = await import('../../src/content/announce.ts');

/**
 * The live region behind `a11y.announceSwaps`.
 *
 * The setting shipped doing nothing: no region was ever created, so a reader
 * who found the toggle, understood exactly what they needed and switched it
 * on got silence. These tests are mostly about the failure modes that make a
 * live region silently useless, because every one of them looks fine in the
 * DOM inspector.
 */

const region = () => document.querySelector(`[${ANNOUNCER_ATTR}]`) as HTMLElement | null;

/** Announcements are written in a microtask, so tests have to wait one. */
const settle = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));

beforeEach(() => {
  for (const el of Array.from(document.querySelectorAll(`[${ANNOUNCER_ATTR}]`))) el.remove();
});

describe('the live region itself', () => {
  test('is created empty, before there is anything to say', () => {
    // A region inserted at the same moment its text appears is announced
    // unreliably: the region has to already exist for the text to register
    // as a change.
    const a = new Announcer(true);
    a.start();
    const el = region();
    assert.ok(el, 'no region was created');
    assert.equal(el.textContent, '', 'the region was born with text in it');
  });

  test('is polite and atomic, not assertive', () => {
    const a = new Announcer(true);
    a.start();
    const el = region();
    assert.equal(el?.getAttribute('role'), 'status');
    assert.equal(el?.getAttribute('aria-live'), 'polite');
    // Without aria-atomic a reader may hear only the changed fragment, and
    // half of "rivière — river" is no use at all.
    assert.equal(el?.getAttribute('aria-atomic'), 'true');
  });

  test('is hidden in a way that keeps it readable', () => {
    // display:none and visibility:hidden both remove the element from the
    // accessibility tree, which is precisely what must not happen here.
    const a = new Announcer(true);
    a.start();
    const style = region()?.getAttribute('style') ?? '';
    assert.ok(!/display\s*:\s*none/.test(style), 'display:none removes it from the a11y tree');
    assert.ok(!/visibility\s*:\s*hidden/.test(style), 'visibility:hidden removes it too');
    assert.match(style, /clip/, 'expected the clip-rect hiding pattern');
  });

  test('creates nothing at all when the setting is off', () => {
    const a = new Announcer(false);
    a.start();
    assert.equal(region(), null);
  });

  test('start is idempotent', () => {
    const a = new Announcer(true);
    a.start();
    a.start();
    assert.equal(document.querySelectorAll(`[${ANNOUNCER_ATTR}]`).length, 1);
  });
});

describe('what it says', () => {
  test('a revealed word is announced target first, then English', async () => {
    const a = new Announcer(true);
    a.start();
    a.reveal('rivière', 'river');
    await settle();
    assert.equal(region()?.textContent, 'rivière — river');
  });

  test('the same word revealed twice is announced twice', async () => {
    /*
     * The failure this guards: setting textContent to a string it already
     * holds is not a mutation, so the region stays silent and the reader
     * hears nothing the second time they ask. Clearing first is what makes
     * the repeat register.
     */
    const a = new Announcer(true);
    a.start();
    a.reveal('rivière', 'river');
    await settle();
    const el = region();
    assert.equal(el?.textContent, 'rivière — river');

    a.reveal('rivière', 'river');
    assert.equal(el?.textContent, '', 'the region was not cleared, so the repeat is silent');
    await settle();
    assert.equal(el?.textContent, 'rivière — river');
  });

  test('the page summary is a count, said once', async () => {
    // Announcing forty swaps individually is a denial of service, not
    // information.
    const a = new Announcer(true);
    a.start();
    a.summarise(12, 'French');
    await settle();
    assert.equal(region()?.textContent, '12 words on this page are in French.');

    a.summarise(12, 'French');
    await settle();
    assert.equal(region()?.textContent, '12 words on this page are in French.');
  });

  test('one word is singular', async () => {
    const a = new Announcer(true);
    a.start();
    a.summarise(1, 'Latin');
    await settle();
    assert.equal(region()?.textContent, '1 word on this page is in Latin.');
  });

  test('a page with nothing woven says nothing', async () => {
    const a = new Announcer(true);
    a.start();
    a.summarise(0, 'French');
    await settle();
    assert.equal(region()?.textContent, '');
  });

  test('a reweave may summarise again, because the count changed', async () => {
    const a = new Announcer(true);
    a.start();
    a.summarise(12, 'French');
    await settle();
    a.resetSummary();
    a.summarise(20, 'French');
    await settle();
    assert.equal(region()?.textContent, '20 words on this page are in French.');
  });

  test('says nothing at all when disabled', async () => {
    const a = new Announcer(false);
    a.start();
    a.reveal('rivière', 'river');
    a.summarise(12, 'French');
    await settle();
    assert.equal(region(), null);
  });
});

describe('following the setting without a reload', () => {
  test('switching it on creates the region', async () => {
    const a = new Announcer(false);
    a.start();
    assert.equal(region(), null);

    a.setEnabled(true);
    assert.ok(region(), 'turning the setting on did not create a region');
    a.reveal('hūs', 'house');
    await settle();
    assert.equal(region()?.textContent, 'hūs — house');
  });

  test('switching it off removes the region', () => {
    const a = new Announcer(true);
    a.start();
    assert.ok(region());
    a.setEnabled(false);
    assert.equal(region(), null, 'a disabled announcer left its region in the page');
  });

  test('stop cleans up after itself', () => {
    const a = new Announcer(true);
    a.start();
    a.stop();
    assert.equal(region(), null);
  });

  test('an announcement after stop does not resurrect a stale region', async () => {
    const a = new Announcer(true);
    a.start();
    a.stop();
    a.reveal('stān', 'stone');
    await settle();
    // Still enabled, so recreating is correct — what matters is that there
    // is exactly one region and it holds the new message.
    assert.equal(document.querySelectorAll(`[${ANNOUNCER_ATTR}]`).length, 1);
    assert.equal(region()?.textContent, 'stān — stone');
  });
});
