/**
 * One mark, drawn once.
 *
 * `0d9910e` redrew the loom mark on 2026-09-22: the weft had crossed two of
 * four warp threads and stopped at the third, which "read as an H with a
 * stray stroke beside it rather than as one woven thing", and from then on
 * it crossed every thread but the last. That commit changed the rasters and
 * nothing else — because the mark was also written out by hand, as SVG, in
 * five other places, and nothing connected any of them to the geometry that
 * had just moved:
 *
 *   - a string in `make-icons.mjs` itself, a screen below the geometry
 *     that commit edited, which became `assets/icon.svg` and
 *     `site/icon.svg`, the favicon;
 *   - the header of the landing page, in `site/index.html`;
 *   - the header of the other 712 pages, in the site builder's template;
 *   - the social card's generator;
 *   - the generator of both Chrome Web Store tiles and the Edge store logo.
 *
 * So for nine days the store listing was set to show the redrawn icon beside
 * a tile carrying the mark it replaced. Every check was green throughout:
 * the generators reproduced their committed output byte for byte, and once
 * the tiles and the card had an artefact group at all, `artefacts:check`
 * reported them fresh — because the stale fact was *inside* each generator
 * rather than upstream of it. Provenance cannot see a copy. It was found by
 * opening the images.
 *
 * These tests are that opening, automated. The shapes are read back out of
 * the pixels and the markup, so what is compared is the drawing and not the
 * bytes — which also means none of this is the pixel-equality gate
 * `CLAUDE.md` refuses: the committed PNGs are read as committed, on any
 * platform, and nothing a browser drew is drawn again here. The four shipped
 * icons are the one exception, and the reason they can be is that no
 * browser drew them: see "the shipped icons are what the geometry draws".
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  GEOMETRY,
  WOAD,
  WOAD_LIGHT,
  markGeometry,
  iconPixels,
  iconSvg,
  LEAD_LANGUAGE,
  LEAD_PAIRS,
} from '../../tools/brand.ts';
import { artefactsFor } from '../../tools/artefacts.ts';
import { decode } from '../../tools/png.ts';
import {
  markInPixels,
  markInSvg,
  threadsCrossed,
  describeMark,
  differences,
  type MarkReading,
} from './mark-reading.ts';

const ROOT = join(import.meta.dirname, '../..');
const COLOURS = { warp: WOAD_LIGHT, weft: WOAD };

/** Tracked files matching `pathspecs`. */
const tracked = (...pathspecs: string[]): string[] =>
  execFileSync('git', ['ls-files', ...pathspecs], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

/**
 * The rule the redraw set, in the redraw's own words: "the weft always
 * reaches all but the last thread — keeping the meaning (a partly woven
 * page, never a fully translated one) while holding together as one shape."
 */
function assertWoven(reading: MarkReading, what: string): void {
  const { threads, weft } = reading;
  const crossed = threadsCrossed(reading);
  assert.ok(threads.length >= 2, `${what}: ${threads.length} warp thread(s) is not a weave`);
  assert.equal(
    crossed,
    threads.length - 1,
    `${what}: the weft crosses ${crossed} of ${threads.length} threads, and it should cross ` +
      `every one but the last (${describeMark(reading)})`,
  );
  assert.ok(
    weft.x1 <= threads[threads.length - 1]!.x0,
    `${what}: the weft touches the last thread, so nothing is left unwoven (${describeMark(reading)})`,
  );
}

describe('the mark is drawn from one geometry', () => {
  test('at every size, the weft crosses every warp thread but the last', () => {
    const sizes = Object.keys(GEOMETRY).map(Number);
    // Non-vacuity floor: the four sizes the manifest declares.
    assert.ok(sizes.length >= 4, `only ${sizes.length} sizes have a geometry`);
    for (const size of sizes) {
      const mark = markGeometry(size);
      assertWoven({ threads: mark.warps, weft: mark.weft }, `the ${size}px mark`);
    }
  });
});

/**
 * The vector is not a second design. `make-icons.mjs` called it "a vector
 * version for the landing page and the store listing", and for nine days it
 * was a version of the mark the rasters had stopped being.
 *
 * Compared against the 128px raster because that is the size the vector's
 * 128-unit box is drawn at, so one unit is one pixel and no scaling is being
 * trusted. One pixel of tolerance, because that is what a raster knows: its
 * edges land on fractional coordinates and are read back to the nearest
 * whole one. The redraw moved the outer threads, and both ends of every
 * thread, by three pixels and the end of the weft by fourteen, so one is not
 * generous.
 *
 * The list is every committed SVG rather than the two that exist, so a
 * third is held to the same drawing the moment it is added or fails here by
 * name.
 */
describe('the vector icon and the raster icon are one drawing', () => {
  const vectors = tracked('*.svg');

  test('there are committed vector icons to check', () => {
    assert.ok(vectors.length >= 2, `only ${vectors.length} committed SVG files were found`);
  });

  for (const file of vectors) {
    test(`${file} draws what assets/icon-128.png draws`, () => {
      const raster = markInPixels(decode(join(ROOT, 'assets/icon-128.png')), COLOURS);
      assert.ok(raster, 'no mark was found in assets/icon-128.png');

      const markup = readFileSync(join(ROOT, file), 'utf8');
      // What makes one unit of the vector one pixel of the 128px raster.
      assert.match(markup, /viewBox="0 0 128 128"/, `${file} is not drawn in a 128-unit box`);
      const vector = markInSvg(markup);
      assert.ok(vector, `${file} draws no mark`);

      assert.deepEqual(
        differences(vector, raster, 1, [file, 'assets/icon-128.png']),
        [],
        `${file} is not the mark that ships as the icon`,
      );
    });
  }
});

/**
 * Where an image disagrees with the pixels that belong in it, in words — how
 * many, the box they fall in, and the first of them — or `null` where it
 * does not. Both are RGBA, row by row, `size` pixels square.
 */
function pixelDifference(actual: Uint8Array, expected: Uint8Array, size: number): string | null {
  const rgba = (buf: Uint8Array, at: number): string =>
    `rgba(${[...buf.subarray(at, at + 4)].join(', ')})`;
  let count = 0;
  let first = '';
  let left = size;
  let top = size;
  let right = -1;
  let bottom = -1;
  for (let i = 0; i < size * size; i++) {
    const at = i * 4;
    if ([0, 1, 2, 3].every((c) => actual[at + c] === expected[at + c])) continue;
    const x = i % size;
    const y = Math.floor(i / size);
    if (count++ === 0) first = `(${x}, ${y}), is ${rgba(actual, at)} where ${rgba(expected, at)} belongs`;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  if (count === 0) return null;
  return (
    `${count} of ${size * size} pixels differ, all within x ${left}–${right} and y ${top}–${bottom}; ` +
    `the first, ${first}`
  );
}

/**
 * The shipped icons are the geometry, pixel for pixel.
 *
 * Every other test here reads a drawing's shape — its threads, and how many
 * the weft covers — and for the tiles and the card that is as much as can
 * be asked: Chromium drew those, and a font stack or an antialiasing change
 * on another machine moves an edge without anything being wrong. The four
 * icons were drawn by arithmetic alone, `iconPixels` in `tools/brand.ts`,
 * which is the very function `make-icons.mjs` encodes. It uses nothing but
 * the four operations and rounding, which JavaScript specifies to the bit,
 * so each icon can be drawn again here and the committed file required to
 * hold exactly those pixels.
 *
 * Decoded and compared, rather than rebuilt and `git diff`ed in CI the way
 * the lexicon packs are. That step was queued on 2026-09-30 on the grounds
 * that the tool is byte-reproducible, and measured before anyone built it:
 * the pixel data inside a PNG is `deflateSync` output, which is whatever
 * zlib the Node binary was built with, and the 128px icon comes out at 431
 * bytes under the Node that wrote the committed file and 432 under an
 * official Node 22 build, the kind CI installs, with every pixel equal. The
 * step would have failed on a correct tree. A comparison of decoded pixels
 * cannot fail for that reason, so it fails for one reason only.
 *
 * That reason is the gap the shape readings leave: an edit to the geometry
 * that nobody rebuilt. They see it only if it breaks the crossing rule, and
 * `artefacts:check` only as "nobody has checked since"; this names the icon
 * and where in it the pixels went wrong.
 *
 * The two vectors the same tool writes are held the same way, and more
 * simply: an SVG is a string, with no encoder between the geometry and the
 * file, so the committed text must be `iconSvg()` exactly. The shape reading
 * above compares each vector with the committed raster, and so cannot see
 * both of them going stale together.
 */
describe('the shipped icons are what the geometry draws', () => {
  // What `make-icons.mjs` writes, read off its artefact group, so a fifth
  // size or a third copy of the vector is held here the moment it is
  // committed.
  const written = tracked(
    ...artefactsFor('0.0.0')
      .filter((a) => a.inputs.includes('tools/make-icons.mjs'))
      .flatMap((a) => a.paths),
  );
  const icons = written.filter((f) => f.endsWith('.png'));
  const vectors = written.filter((f) => f.endsWith('.svg'));

  test('there are icons to check', () => {
    // Non-vacuity floor: the four sizes the manifest declares, and the
    // vector in `assets/` and the favicon.
    assert.ok(icons.length >= 4, `only ${icons.length} committed icons were found`);
    assert.ok(vectors.length >= 2, `only ${vectors.length} committed vector icons were found`);
  });

  for (const file of vectors) {
    test(`${file} is exactly the vector the geometry writes`, () => {
      assert.equal(
        readFileSync(join(ROOT, file), 'utf8'),
        iconSvg(),
        `${file} is not what tools/brand.ts writes. If the mark was meant to move, ` +
          '`npm run icons` rewrites it; if it was not, find what did',
      );
    });
  }

  for (const file of icons) {
    test(`${file} holds exactly the pixels the geometry draws`, () => {
      const size = Number(/icon-(\d+)\.png$/.exec(file)?.[1]);
      assert.ok(size > 0, `${file} does not say what size it is`);
      const committed = decode(join(ROOT, file));
      assert.deepEqual(
        [committed.width, committed.height, committed.bpp],
        [size, size, 4],
        `${file} is not a ${size}px square RGBA image`,
      );
      const drawn = iconPixels(size);
      assert.equal(drawn.length, size * size * 4, `the geometry did not draw a ${size}px square`);
      const wrong = pixelDifference(committed.data, drawn, size);
      assert.equal(
        wrong,
        null,
        `${file} is not what tools/brand.ts draws at ${size}px: ${wrong}. If the geometry ` +
          'was meant to move, `npm run icons` redraws it; if it was not, find what did',
      );
    });
  }
});

/**
 * The cause, policed where it lives.
 *
 * Every test in this file reads a drawing back and asks whether it is the
 * right one. None of them can see a drawing that has not been made yet — a
 * new tile, a new card — whose generator pastes the mark in as markup of
 * its own, which is precisely how four tools came to hold four copies. A
 * pasted copy is correct on the day it is pasted, so no reading of its
 * output would object until the mark next moves, by which point the output
 * is committed and reproducing itself faithfully.
 *
 * So: a tool does not write an `<svg>` at all. The mark is `markSvg()`.
 * Should a tool ever need a drawing that is not the mark, this test is
 * where to say so, in words, beside the name of the file.
 */
describe('nothing else draws the mark', () => {
  test('no tool writes an SVG of its own', () => {
    const tools = readdirSync(join(ROOT, 'tools')).filter((f) => f.endsWith('.mjs'));
    // Non-vacuity floor: a directory read that came back short would pass.
    assert.ok(tools.length >= 15, `only ${tools.length} tools were found`);
    assert.deepEqual(
      tools.filter((f) => /<svg\b/.test(readFileSync(join(ROOT, 'tools', f), 'utf8'))),
      [],
      'a tool draws an SVG by hand — if it is the mark, embed markSvg() from tools/brand.ts instead',
    );
  });
});

/** The one module the mark is drawn in, as an artefact input names it. */
const BRAND = 'tools/brand.ts';

/**
 * Why `artefacts:check` said "ok" about art showing a superseded mark.
 *
 * The tiles' group declared one input, `tools/make-store-tiles.mjs`, and
 * that was accurate: the tile generator had not changed. The mark it drew
 * had — in another file, which nothing declared, because the generator kept
 * a copy rather than a reference. Now that the copy is a reference, the
 * reference has to be an input, or the next redraw would leave the same
 * groups reported fresh for the same reason.
 *
 * Derived from who imports the module rather than from a list of groups, so
 * a fifth tool that embeds the mark is held to it without an edit here.
 */
describe('a redrawn mark stales everything that shows it', () => {
  const artefacts = artefactsFor('0.0.0');
  const drawers = readdirSync(join(ROOT, 'tools'))
    .filter((f) => f.endsWith('.mjs'))
    .filter((f) => /from '\.\/brand\.ts'/.test(readFileSync(join(ROOT, 'tools', f), 'utf8')));

  test('every artefact a mark-drawing tool writes names the mark as an input', () => {
    // Non-vacuity floor: the icons, the tiles, the card and the site.
    assert.ok(drawers.length >= 4, `only ${drawers.length} tools import ${BRAND}`);
    const undeclared: string[] = [];
    let checked = 0;
    for (const tool of drawers) {
      // A tool in no group writes nothing that is committed — the site
      // builder's output is gitignored — so nothing of its can go stale.
      for (const group of artefacts.filter((a) => a.inputs.includes(`tools/${tool}`))) {
        checked++;
        if (!group.inputs.includes(BRAND)) undeclared.push(`${group.name} (tools/${tool})`);
      }
    }
    assert.ok(checked >= 3, `only ${checked} artefact groups are written by a mark-drawing tool`);
    assert.deepEqual(
      undeclared,
      [],
      `these are drawn from ${BRAND} and do not declare it, so redrawing the mark would leave them reported fresh`,
    );
  });
});

/**
 * The opening of the file, automated — the test that would have failed on
 * 2026-09-22 and did not exist.
 *
 * Every committed image drawn from the mark is decoded and the mark is read
 * back out of its pixels: how many warp threads, and how many of them the
 * weft covers. That is a content check, which `artefacts:check` is not and
 * says it is not. It is also not the pixel-equality gate this repository
 * refuses, and the difference is the whole reason it can run in CI: nothing
 * is rendered here, so a font stack or an antialiasing difference on
 * `ubuntu-latest` has nothing to act on. The bytes read are the bytes
 * committed.
 *
 * The rule is a count rather than a set of coordinates so that it holds at
 * 34px inside a tile exactly as it does at 128px in the icon — two threads
 * at 16px, three at 32, four everywhere else, and always one left unwoven.
 *
 * The images are derived from the artefact groups that name the mark as an
 * input, and the test above derives *that* from who imports it, so an image
 * gets here by being drawn from the mark and not by anyone remembering it.
 */
describe('every committed image of the mark is the mark that ships', () => {
  const images = tracked(
    ...artefactsFor('0.0.0')
      .filter((a) => a.inputs.includes(BRAND))
      .flatMap((a) => a.paths),
  ).filter((f) => f.endsWith('.png'));

  test('there are images to read', () => {
    // Non-vacuity floor: four icons, two tiles, the Edge logo and the card.
    assert.ok(images.length >= 8, `only ${images.length} committed images are drawn from ${BRAND}`);
  });

  for (const file of images) {
    test(`${file}: the weft crosses every warp thread but the last`, () => {
      const reading = markInPixels(decode(join(ROOT, file)), COLOURS);
      // Not a skip. An image drawn from the mark in which the mark cannot
      // be found is drawn in other colours, or is not drawn from it at all.
      assert.ok(reading, `${file} is drawn from ${BRAND} and no mark in its colours was found`);
      assertWoven(reading, file);
    });
  }
});

/**
 * The artwork is a picture of the product working, so every word in it has
 * to be a word the product weaves, spelled the way it weaves it.
 *
 * Checked against the pack rather than against anything in `tools/`: the
 * pack is what a reader's page will actually show, and a tile promising
 * *forêt* over "forest" to someone who then never sees it is a small lie in
 * the one place a stranger meets the product first. PR #36 checked this by
 * eye for the four pairs then on the marquee. This is that, kept.
 */
describe('the words the artwork leads with', () => {
  test('each pair is one the lexicon weaves, in that form', () => {
    // Non-vacuity floor: the card and the marquee each show four.
    assert.ok(LEAD_PAIRS.length >= 4, `the artwork leads with only ${LEAD_PAIRS.length} pairs`);
    const pack = JSON.parse(
      readFileSync(join(ROOT, `src/lexicon/packs/en-${LEAD_LANGUAGE}.json`), 'utf8'),
    ) as { entries: Record<string, { tgt: string }[]> };
    for (const { source, target } of LEAD_PAIRS) {
      const woven = (pack.entries[source] ?? []).map((e) => e.tgt);
      assert.ok(
        woven.includes(target),
        `the artwork shows “${target}” over “${source}”, and the ${LEAD_LANGUAGE} pack ` +
          (woven.length ? `weaves “${source}” as ${woven.join(', ')}` : `does not carry “${source}”`),
      );
    }
  });
});
