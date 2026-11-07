/**
 * How long a tamper penalty holds difficulty at the ceiling, said as the code
 * holds it.
 *
 * `recordTamper()` pins the ratio at the ceiling for `TAMPER_PENALTY_HOURS`
 * from the last time tampering was noticed — stored settings that fail their
 * integrity check, or the clock turned back — and a second notice holds it
 * that long again from then. Until 2026-11-07 every place that said how long
 * said "the day": the options row and the choice under it, the popup's notice
 * ("for today"), the privacy page, `docs/ARCHITECTURE.md` and the doc comment
 * above the function, whose variable was named `endOfDayPenalty` and held
 * twelve hours. A penalty noticed at 08:00 was lifted at 20:00 and one noticed
 * at 22:00 held until 10:00 the next morning, so no reading of "the day" was
 * true.
 *
 * So a sentence that says difficulty is pinned at the ceiling for a length of
 * time says the code's length, in every file a reader or a contributor reads
 * it in: the source, the README, every tracked Markdown file under `docs/` and
 * the hand-written pages under `site/`. And the popup's notice, which shows
 * for either cause, names the clock, where it said "Stored settings failed
 * their integrity check" when the clock was what moved: the misattribution
 * `tests/core/lock.test.ts` refuses in the audit log.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAMPER_PENALTY_HOURS } from '../../src/core/lock.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** "Pinned at the ceiling for …": a hold, and the words after it. */
const HOLD =
  /\bpin(?:s|ned|ning)?\b[^.;!?]{0,60}?\bceiling\b[^.;!?]{0,30}?\b(?:for|until|till|through)\s+([^.;!?]{0,40})/gi;

/** The words after a hold, when they are a length of time. */
const LENGTH =
  /^(?:the\s+(?:rest\s+of\s+the\s+)?day|today|tonight|tomorrow|midnight|(?:\d+|an?|one|two|six|twelve|twenty-four)\s+(?:hours?|days?|minutes?))\b/i;

/** The length the code holds it for, as the copy writes it. */
const HELD = new RegExp(`^${TAMPER_PENALTY_HOURS} hours\\b`);

interface Statement {
  where: string;
  length: string;
}

/** Every length a text says the ceiling is held for. */
function statements(where: string, text: string): Statement[] {
  const flat = text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\*|\/\/|>)\s?/, ''))
    .join(' ')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ');
  const out: Statement[] = [];
  for (const m of flat.matchAll(HOLD)) {
    const length = LENGTH.exec(m[1]!.trim());
    if (length) out.push({ where, length: length[0] });
  }
  return out;
}

const misstated = (s: Statement) => !HELD.test(s.length);

const FILES = execFileSync(
  'git',
  ['ls-files', 'src/*.ts', 'src/*.tsx', 'README.md', 'docs/*.md', 'site/*.html'],
  { cwd: ROOT, encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

const found = FILES.flatMap((file) => statements(file, readFileSync(join(ROOT, file), 'utf8')));

describe('how long a tamper penalty is said to last', () => {
  test('the reader refuses every length but the code’s, and reads no hold where there is none', () => {
    const refused = [
      'Escalating pins difficulty at the ceiling for the day, which makes editing storage a losing move.',
      'Stored settings failed their integrity check, so difficulty is pinned at the ceiling for today.',
      'finds it pinned at the ceiling for the rest of the day; the incentive to try is negative',
      'A forged setting pins it to the ceiling for 24 hours.',
      'difficulty is pinned at the ceiling until tomorrow.',
    ];
    for (const text of refused) {
      const said = statements('probe', text);
      assert.equal(said.length, 1, `no length was read in “${text}”`);
      assert.ok(misstated(said[0]!), `“${text}” was accepted`);
    }
    const held = statements('probe', `pin at the ceiling for ${TAMPER_PENALTY_HOURS} hours`);
    assert.equal(held.length, 1);
    assert.ok(!misstated(held[0]!), 'the code’s own length was refused');
    for (const text of [
      'You have reached the ceiling for this site.',
      'True when a tamper penalty is pinning difficulty to the ceiling.',
      'Raising the ceiling for a site pins nothing.',
    ]) {
      assert.deepEqual(statements('probe', text), [], `“${text}” was read as a length`);
    }
  });

  test('the copy is read, and the settings page says how long', () => {
    // 85 files on 2026-11-07: the source, the README, docs/ and site/.
    assert.ok(FILES.length >= 70, `only ${FILES.length} files were read`);
    assert.ok(found.length >= 5, `only ${found.length} statements of how long were found`);
    assert.ok(
      found.some((s) => s.where === 'src/ui/options/commitment.tsx'),
      'the settings row that chooses the response says nothing of how long it lasts',
    );
  });

  test('every sentence that says how long the ceiling is held says the code’s length', () => {
    assert.deepEqual(
      found.filter(misstated).map((s) => `${s.where}: for ${s.length}`),
      [],
      `recordTamper() holds the ceiling for ${TAMPER_PENALTY_HOURS} hours from the last time it noticed`,
    );
  });

  test('the popup’s notice names the clock, which is one of the two things it is shown for', () => {
    const lock = readFileSync(join(ROOT, 'src/core/lock.ts'), 'utf8');
    assert.match(lock, /recordTamper\([^)]*'the clock moved backwards'\)/, 'a clock turned back no longer penalises');
    const popup = readFileSync(join(ROOT, 'src/ui/popup/index.tsx'), 'utf8');
    const start = popup.indexOf('state.penaltyActive ?');
    assert.ok(start >= 0, 'the popup shows no notice for a penalty');
    const notice = popup.slice(start, popup.indexOf(': null}', start)).replace(/\s+/g, ' ');
    assert.match(notice, /\bclock\b/i, `the notice blames the stored settings alone: ${notice}`);
    assert.match(notice, /\bsettings\b/i, `the notice no longer names the stored settings: ${notice}`);
  });
});
