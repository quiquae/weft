#!/usr/bin/env node
/**
 * Compare PNGs in the working tree with the copies `HEAD` holds.
 *
 *   npm run png:diff -- docs/screens/*.png
 *   npm run png:diff -- docs/store/logo-edge-300x300.png --region=0,0,300,180
 *
 * For each file: byte-identical, or how many pixels differ, the largest
 * difference in any one channel, and the box every difference sits inside,
 * printed as a region so it can be passed back. `--region=x0,y0,x1,y1`
 * (exclusive ends, repeatable) counts the differences inside a box as well —
 * a mark's rectangles, a tooltip, a line of text — which is how a renderer's
 * drift is told from a change: "36 differ, all in the wordmark, 0 in the
 * mark" is a finding, and "the shots differ" is not.
 *
 * Paths are read from the directory the command runs in, which under npm is
 * the repository root. Exit 0 when every file's pixels equal `HEAD`'s, 1 when
 * any differ, 2 when a file cannot be compared — not in `HEAD`, not a PNG, a
 * region that does not fit it — as diff(1) does, and the other files are
 * still reported. The status is set rather than `exit()` called, which can
 * cut off output still queued for a pipe.
 *
 * The comparison itself is pure, in `tools/png-diff.ts`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { decodePng } from './png.ts';
import { comparePixels, describeDiff, parseRegion } from './png-diff.ts';

let status = 0;
const trouble = (line) => {
  console.error(line);
  status = 2;
};

const paths = [];
const regions = [];
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--region=')) {
    try {
      regions.push(parseRegion(arg.slice('--region='.length)));
    } catch (error) {
      trouble(error.message);
    }
  } else if (arg.startsWith('--')) {
    trouble(`unknown option ${arg}`);
  } else {
    paths.push(arg);
  }
}
if (!paths.length) trouble('usage: npm run png:diff -- <file.png>… [--region=x0,y0,x1,y1]…');

// A bad option is not a reason to report on files with half the question
// asked, so nothing is compared after one.
for (const path of status ? [] : paths) {
  let here;
  try {
    here = readFileSync(path);
  } catch {
    trouble(`${path} — not in the working tree`);
    continue;
  }

  let head;
  try {
    // `cat-file` rather than `show`, which may run a textconv filter, and
    // `./` so git reads the path from where this runs, as the file was read.
    head = execFileSync('git', ['cat-file', 'blob', `HEAD:./${relative(process.cwd(), resolve(path))}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    const said = String(error.stderr ?? '').trim().replace(/^fatal: /, '');
    trouble(
      /not in '|does not exist in '/.test(said)
        ? `${path} — not in HEAD, so there is nothing to compare it with`
        : `${path} — git cannot read it at HEAD: ${said}`,
    );
    continue;
  }

  if (here.equals(head)) {
    console.log(`${path} — byte-identical to HEAD`);
    continue;
  }

  let diff;
  try {
    diff = comparePixels(decodePng(head, `${path} at HEAD`), decodePng(here, path), regions);
  } catch (error) {
    trouble(`${path} — ${error.message}`);
    continue;
  }
  console.log(`${path} — ${head.length} bytes at HEAD, ${here.length} here`);
  for (const line of describeDiff(diff)) console.log(`  ${line}`);
  if ((diff.kind === 'sizes' || diff.differing > 0) && status < 1) status = 1;
}

process.exitCode = status;
