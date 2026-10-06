/**
 * Where two PNGs differ, by how much, and inside which box.
 *
 * Telling a renderer's drift from a real change has meant locating the
 * differing pixels: how many, how far apart their channels are, and whether
 * they sit inside the box a change was meant to move. Three sessions did it
 * with a decoder written for the occasion — a browser canvas on 2026-09-29, a
 * pure-Python decode for #50, a Node one in `/tmp` on 2026-10-03 — and threw
 * each away. `npm run png:diff` is that decoder kept: each named file against
 * its own `HEAD` blob, the largest channel difference beside the count, since
 * antialiasing moves a channel by tens and a changed glyph by hundreds.
 *
 * The comparison is tested on bitmaps written out by hand, and the command in
 * a throwaway git repository, so every blob it compares is one the test made.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { decodePng, type Bitmap } from '../../tools/png.ts';
import { comparePixels, parseRegion } from '../../tools/png-diff.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(ROOT, 'tools/png-diff.mjs');

const bitmap = (width: number, height: number, bpp: 3 | 4, bytes: number[]): Bitmap => ({
  width,
  height,
  bpp,
  data: Buffer.from(bytes),
});

/** A 4×3 RGB image, every pixel black. */
const black = (): number[] => new Array(4 * 3 * 3).fill(0);

/**
 * The same image with two pixels changed: (1, 0) by 200 in red, and (2, 1) by
 * 3 in green and 1 in blue. Three channels move and two pixels do, so a count
 * of channels rather than pixels cannot pass for the right one.
 */
const changed = (): number[] => {
  const bytes = black();
  bytes[(0 * 4 + 1) * 3 + 0] = 200;
  bytes[(1 * 4 + 2) * 3 + 1] = 3;
  bytes[(1 * 4 + 2) * 3 + 2] = 1;
  return bytes;
};

/** An 8-bit PNG of `image`, every row unfiltered, deflated at `level`. */
function encode({ width, height, bpp, data }: Bitmap, level = 9): Buffer {
  const chunk = (type: string, body: Buffer): Buffer => {
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = bpp === 3 ? 2 : 6;
  const stride = width * bpp;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) data.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('reading a PNG from memory', () => {
  test('decodePng returns the pixels a buffer holds', () => {
    // A blob read out of git never touches the disk, so the decoder takes
    // bytes; reading a path is a wrapper round this.
    const image = bitmap(3, 2, 4, [
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120,
    ]);
    assert.deepEqual(decodePng(encode(image), 'in memory'), image);
  });

  test('decodePng refuses bytes that are not a PNG, and names them', () => {
    // A path an SVG sits at in HEAD must say so, not fail inside zlib.
    assert.throws(
      () => decodePng(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'icon.svg'),
      /icon\.svg: not a PNG/,
    );
  });
});

describe('comparing two bitmaps', () => {
  test('identical pixels differ nowhere and have no box', () => {
    const result = comparePixels(bitmap(4, 3, 3, black()), bitmap(4, 3, 3, black()));
    assert.deepEqual(result, { kind: 'pixels', width: 4, height: 3, differing: 0, largest: 0, box: null, regions: [] });
  });

  test('counts differing pixels, not channels, and boxes them with exclusive ends', () => {
    const result = comparePixels(bitmap(4, 3, 3, black()), bitmap(4, 3, 3, changed()));
    assert.equal(result.kind, 'pixels');
    if (result.kind !== 'pixels') return;
    assert.equal(result.differing, 2, 'three channels moved, in two pixels');
    assert.equal(result.largest, 200, 'the largest channel difference, not a sum');
    assert.deepEqual(result.box, { x0: 1, y0: 0, x1: 3, y1: 2 });
  });

  test('counts the differing pixels inside each region asked about', () => {
    const result = comparePixels(bitmap(4, 3, 3, black()), bitmap(4, 3, 3, changed()), [
      { x0: 0, y0: 0, x1: 2, y1: 1 },
      { x0: 0, y0: 2, x1: 4, y1: 3 },
      { x0: 2, y0: 1, x1: 3, y1: 2 },
    ]);
    assert.equal(result.kind, 'pixels');
    if (result.kind !== 'pixels') return;
    assert.deepEqual(
      result.regions.map(({ differing, total }) => [differing, total]),
      [
        [1, 2],
        [0, 4],
        [1, 1],
      ],
    );
  });

  test('an opaque RGBA image equals the RGB one with the same colours, and alpha counts', () => {
    // A screenshot re-encoded with an alpha channel has a different stride;
    // comparing the raw buffers would call every pixel changed.
    const rgb = bitmap(2, 1, 3, [10, 20, 30, 40, 50, 60]);
    const opaque = bitmap(2, 1, 4, [10, 20, 30, 255, 40, 50, 60, 255]);
    const result = comparePixels(rgb, opaque);
    assert.equal(result.kind === 'pixels' && result.differing, 0);

    const halfClear = bitmap(2, 1, 4, [10, 20, 30, 255, 40, 50, 60, 128]);
    const alpha = comparePixels(opaque, halfClear);
    assert.equal(alpha.kind === 'pixels' && alpha.differing, 1);
    assert.equal(alpha.kind === 'pixels' && alpha.largest, 127);
  });

  test('images of different sizes are reported as such, not compared', () => {
    const result = comparePixels(bitmap(4, 3, 3, black()), bitmap(2, 1, 3, [0, 0, 0, 0, 0, 0]));
    assert.deepEqual(result, {
      kind: 'sizes',
      before: { width: 4, height: 3 },
      after: { width: 2, height: 1 },
    });
  });

  test('a region that runs off the image is refused rather than clipped', () => {
    // Clipped, a mistyped box counts nothing and reads as "0 differ", which
    // is the answer a drift check hopes for.
    assert.throws(
      () => comparePixels(bitmap(4, 3, 3, black()), bitmap(4, 3, 3, changed()), [{ x0: 0, y0: 0, x1: 5, y1: 3 }]),
      /0,0,5,3.*4×3/,
    );
  });

  test('parseRegion reads x0,y0,x1,y1 and refuses anything that is not a box', () => {
    assert.deepEqual(parseRegion('389,135,704,186'), { x0: 389, y0: 135, x1: 704, y1: 186 });
    for (const bad of ['10,20,30', '1,2,x,4', '1,2,3,4,5', '5,0,5,1', '0,4,1,2', '-1,0,2,2', '1.5,0,2,2', '']) {
      assert.throws(() => parseRegion(bad), /region/, `"${bad}" was taken for a box`);
    }
  });
});

describe('npm run png:diff, against HEAD', () => {
  function git(root: string, args: string[]): string {
    return execFileSync('git', ['-c', 'user.email=test@weft.invalid', '-c', 'user.name=Weft test', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  }

  /** A repository holding `a.png` and `c.png`, both black, committed. */
  function withRepo(body: (root: string) => void): void {
    const root = mkdtempSync(join(tmpdir(), 'weft-png-diff-'));
    try {
      git(root, ['init', '--quiet', '-b', 'main']);
      writeFileSync(join(root, 'a.png'), encode(bitmap(4, 3, 3, black())));
      writeFileSync(join(root, 'c.png'), encode(bitmap(4, 3, 3, black())));
      git(root, ['add', '--all']);
      git(root, ['commit', '--quiet', '-m', 'two black images']);
      body(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const run = (root: string, args: string[]) => {
    const { status, stdout, stderr } = spawnSync(process.execPath, ['--experimental-strip-types', CLI, ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    return { status, output: stdout + stderr };
  };

  test('names each changed pixel count, its largest difference and its box, and exits 1', () => {
    withRepo((root) => {
      writeFileSync(join(root, 'a.png'), encode(bitmap(4, 3, 3, changed())));
      const { status, output } = run(root, ['a.png', 'c.png', '--region=0,0,2,1']);
      assert.equal(status, 1, output);
      assert.match(output, /a\.png[^]*\b2 of 12 pixels differ/);
      assert.match(output, /\b200\b/);
      assert.match(output, /1,0,3,2/);
      assert.match(output, /0,0,2,1: 1 of 2/);
      assert.match(output, /c\.png[^]*byte-identical/);
    });
  });

  test('a file re-encoded with the same pixels is the same picture, and exits 0', () => {
    // The 128px icon is 431 bytes under one zlib and 432 under another, every
    // pixel equal; a byte comparison calls that a change.
    withRepo((root) => {
      const recompressed = encode(bitmap(4, 3, 3, black()), 0);
      assert.notDeepEqual(recompressed, encode(bitmap(4, 3, 3, black())), 'the fixture must differ in its bytes');
      writeFileSync(join(root, 'a.png'), recompressed);
      const { status, output } = run(root, ['a.png']);
      assert.equal(status, 0, output);
      assert.match(output, /pixels are identical/);
    });
  });

  test('a file HEAD does not have cannot be compared, and exits 2', () => {
    withRepo((root) => {
      writeFileSync(join(root, 'b.png'), encode(bitmap(4, 3, 3, black())));
      const { status, output } = run(root, ['b.png', 'c.png']);
      assert.equal(status, 2, output);
      assert.match(output, /b\.png[^]*not in HEAD/);
      assert.match(output, /c\.png[^]*byte-identical/, 'one file it cannot read does not stop the others');
    });
  });

  test('a run naming no file is refused', () => {
    withRepo((root) => {
      const { status, output } = run(root, ['--region=0,0,1,1']);
      assert.equal(status, 2, output);
    });
  });
});
