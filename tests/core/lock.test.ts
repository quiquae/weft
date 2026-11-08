import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyLockState,
  noteClock,
  requestChange,
  cancelPending,
  markQuizPassed,
  isReady,
  applyReadyChanges,
  usePanicPass,
  panicActive,
  recordTamper,
  penaltyActive,
  assessPatch,
  directionOf,
  describeWait,
  splitImportedSettings,
  TAMPER_PENALTY_HOURS,
} from '../../src/core/lock.ts';
import { settings, NOW } from '../helpers.ts';

let seq = 0;
const ids = () => `id-${++seq}`;
const MIN = 60_000;

describe('directionOf', () => {
  test('lowering the ratio is easier, raising it is harder', () => {
    assert.equal(directionOf('weave.baseRatio', 0.2, 0.1), 'easier');
    assert.equal(directionOf('weave.baseRatio', 0.1, 0.2), 'harder');
    assert.equal(directionOf('weave.baseRatio', 0.1, 0.1), 'neutral');
  });

  test('widening the gap between woven words is easier', () => {
    assert.equal(directionOf('weave.minWordGap', 2, 6), 'easier');
    assert.equal(directionOf('weave.minWordGap', 6, 2), 'harder');
  });

  test('switching the attention tax off is easier', () => {
    assert.equal(directionOf('attention.enabled', true, false), 'easier');
    assert.equal(directionOf('attention.enabled', false, true), 'harder');
  });

  test('shortening the taxed list is easier; lengthening it is harder', () => {
    const a = [{ pattern: 'x.com', enabled: true, escalate: true }];
    assert.equal(directionOf('sites.taxed', a, []), 'easier');
    assert.equal(directionOf('sites.taxed', [], a), 'harder');
  });

  test('disabling a rule in place counts as easier', () => {
    const on = [{ pattern: 'x.com', enabled: true, escalate: true }];
    const off = [{ pattern: 'x.com', enabled: false, escalate: true }];
    assert.equal(directionOf('sites.taxed', on, off), 'easier');
  });

  test('lengthening the never-weave list is easier', () => {
    assert.equal(directionOf('sites.excluded', [], ['x.com']), 'easier');
  });

  test('ungoverned paths are neutral', () => {
    assert.equal(directionOf('reveal.showIpa', true, false), 'neutral');
  });
});

describe('assessPatch', () => {
  test('summarises what will change in human terms', () => {
    const a = assessPatch(settings(), { 'weave.baseRatio': 0.02 });
    assert.equal(a.direction, 'easier');
    assert.match(a.summary, /starting density/);
  });

  test('a mixed patch is treated as easier if any part is easier', () => {
    const a = assessPatch(settings(), { 'weave.baseRatio': 0.02, 'weave.ceilingRatio': 0.9 });
    assert.equal(a.direction, 'easier');
  });

  test('changing target language is governed', () => {
    const a = assessPatch(settings(), { 'learning.activeTarget': 'la' });
    assert.equal(a.direction, 'easier');
    assert.equal(a.kind, 'change-target');
  });
});

/**
 * Every control that makes Weft easier waits, as seven pages promise.
 *
 * Until 2026-11-08 `assessPatch` judged only the paths `GOVERNED_PATHS`
 * named, and a rule list by its length and enabled count, so nine controls
 * that make Weft easier read `neutral` and `requestChange` applied them at
 * once: a taxed rule's escalation switch and its base and ceiling sliders,
 * edited in place; "Recovery while you are away"; "If stored settings are
 * edited"; the sites mode; the quiz's word count and pass mark; and the parts
 * of speech woven. Each case below names its own direction both ways, so a
 * fix that read everything as easier fails too.
 */
describe('every control that makes Weft easier waits', () => {
  const rule = { pattern: 'reddit.com', enabled: true, escalate: true, origin: 'user' as const };
  const taxed = (over: Record<string, unknown>) => ({ 'sites.taxed': [{ ...rule, ...over }] });
  const base = () => settings({ 'sites.taxed': [rule] });
  const dir = (s: ReturnType<typeof settings>, patch: Record<string, unknown>) =>
    assessPatch(s, patch).direction;

  test("a taxed rule's escalation switched off in place is easier, and back on harder", () => {
    assert.equal(dir(base(), taxed({ escalate: false })), 'easier');
    assert.equal(dir(settings({ 'sites.taxed': [{ ...rule, escalate: false }] }), taxed({ escalate: true })), 'harder');
  });

  test("a taxed rule's own ceiling or base lowered in place is easier, raised harder", () => {
    assert.equal(dir(base(), taxed({ ceilingRatio: 0.06 })), 'easier');
    assert.equal(dir(base(), taxed({ ceilingRatio: 0.6 })), 'harder');
    assert.equal(dir(base(), taxed({ baseRatio: 0 })), 'easier');
    assert.equal(dir(base(), taxed({ baseRatio: 0.2 })), 'harder');
    // An override equal to the setting it replaces changes nothing.
    assert.equal(dir(base(), taxed({ ceilingRatio: base().weave.ceilingRatio })), 'neutral');
  });

  test("a gentle rule's dose lowered in place is easier", () => {
    const g = { pattern: 'wikipedia.org', enabled: true, escalate: false, origin: 'user' as const };
    const s = settings({ 'sites.gentle': [g] });
    assert.equal(dir(s, { 'sites.gentle': [{ ...g, baseRatio: 0.01 }] }), 'easier');
    assert.equal(dir(s, { 'sites.gentle': [{ ...g, baseRatio: 0.2 }] }), 'harder');
  });

  test('reordering rules is neutral, and a patch with one rule easier is easier', () => {
    const other = { pattern: 'x.com', enabled: true, escalate: true, origin: 'user' as const };
    const s = settings({ 'sites.taxed': [rule, other] });
    assert.equal(dir(s, { 'sites.taxed': [other, rule] }), 'neutral');
    assert.equal(dir(s, { 'sites.taxed': [{ ...rule, ceilingRatio: 0.9 }, { ...other, escalate: false }] }), 'easier');
  });

  test('faster recovery while you are away is easier, slower harder', () => {
    assert.equal(dir(settings(), { 'attention.decayPerHourAway': 1 }), 'easier');
    assert.equal(dir(settings(), { 'attention.decayPerHourAway': 0.1 }), 'harder');
  });

  test('just noting tampering is easier than pinning the ceiling, and back is harder', () => {
    assert.equal(dir(settings(), { 'friction.tamperResponse': 'ignore' }), 'easier');
    assert.equal(dir(settings({ 'friction.tamperResponse': 'ignore' }), { 'friction.tamperResponse': 'escalate' }), 'harder');
  });

  test('weaving only my list is easier than everywhere except, and back is harder', () => {
    const everywhere = settings({ 'sites.mode': 'everywhere-except' });
    assert.equal(dir(everywhere, { 'sites.mode': 'taxed-only' }), 'easier');
    assert.equal(dir(settings({ 'sites.mode': 'taxed-only' }), { 'sites.mode': 'everywhere-except' }), 'harder');
  });

  test('a shorter quiz or a lower pass mark is easier', () => {
    assert.equal(dir(settings(), { 'friction.quizWordCount': 1 }), 'easier');
    assert.equal(dir(settings(), { 'friction.quizWordCount': 12 }), 'harder');
    assert.equal(dir(settings(), { 'friction.quizPassThreshold': 0.1 }), 'easier');
    assert.equal(dir(settings(), { 'friction.quizPassThreshold': 0.95 }), 'harder');
  });

  test('weaving fewer parts of speech is easier, more harder, a reorder neutral', () => {
    const pos = settings().learning.posPreference;
    assert.ok(pos.length >= 2, 'the default weaves more than one part of speech');
    assert.equal(dir(settings(), { 'learning.posPreference': pos.slice(0, 1) }), 'easier');
    assert.equal(dir(settings({ 'learning.posPreference': pos.slice(0, 1) }), { 'learning.posPreference': pos }), 'harder');
    assert.equal(dir(settings(), { 'learning.posPreference': [...pos].reverse() }), 'neutral');
  });

  test('requestChange queues them rather than applying them', () => {
    const s = settings({ 'sites.taxed': [rule], 'friction.cooldownMinutes': 15 });
    for (const patch of [
      taxed({ ceilingRatio: 0.06 }),
      { 'attention.decayPerHourAway': 1 },
      { 'friction.tamperResponse': 'ignore' },
    ]) {
      const res = requestChange(emptyLockState(NOW), s, patch, NOW, ids);
      assert.equal(res.applied, false, `${Object.keys(patch)[0]} applied at once`);
      assert.equal(res.state.pending.length, 1);
    }
  });
});

describe('requestChange', () => {
  test('harder changes apply immediately', () => {
    const s = settings();
    const res = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.3 }, NOW, ids);
    assert.equal(res.applied, true);
    assert.equal(res.settings.weave.baseRatio, 0.3);
    assert.equal(res.state.pending.length, 0);
    assert.equal(res.state.log.at(-1)?.direction, 'harder');
  });

  test('easier changes are queued, not applied', () => {
    const s = settings({ 'friction.cooldownMinutes': 15 });
    const res = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    assert.equal(res.applied, false);
    assert.equal(res.settings.weave.baseRatio, s.weave.baseRatio, 'must not take effect yet');
    assert.equal(res.state.pending.length, 1);
    assert.equal(res.state.pending[0]?.unlocksAt, NOW + 15 * MIN);
  });

  test('re-requesting the same change does not restart the clock', () => {
    const s = settings({ 'friction.cooldownMinutes': 60 });
    const first = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    const later = requestChange(first.state, s, { 'weave.baseRatio': 0.01 }, NOW + 30 * MIN, ids);
    assert.equal(later.state.pending.length, 1);
    assert.equal(later.state.pending[0]?.unlocksAt, NOW + 60 * MIN, 'clock must not reset');
    assert.match(later.message, /Already waiting/);
  });

  test('a zero cooldown with no quiz applies at once', () => {
    const s = settings({ 'friction.cooldownMinutes': 0, 'friction.requireQuizToUnlock': false });
    const res = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    assert.equal(res.applied, true);
  });

  test('a zero cooldown with a quiz still queues, so the quiz is not skippable', () => {
    const s = settings({ 'friction.cooldownMinutes': 0, 'friction.requireQuizToUnlock': true });
    const res = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    assert.equal(res.applied, false);
    assert.equal(res.state.pending.length, 1);
  });
});

describe('cooldown expiry', () => {
  test('nothing is ready before the cooldown elapses', () => {
    const s = settings({ 'friction.cooldownMinutes': 15 });
    const q = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    assert.equal(applyReadyChanges(q.state, s, NOW + 14 * MIN).applied.length, 0);
  });

  test('the change applies once the cooldown elapses', () => {
    const s = settings({ 'friction.cooldownMinutes': 15 });
    const q = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    const done = applyReadyChanges(q.state, s, NOW + 15 * MIN);
    assert.equal(done.applied.length, 1);
    assert.equal(done.settings.weave.baseRatio, 0.01);
    assert.equal(done.state.pending.length, 0);
    assert.equal(done.state.log.at(-1)?.via, 'cooldown');
  });

  test('a patch applied later does not clobber unrelated edits made in between', () => {
    // This is why pending changes are stored as patches, not snapshots.
    const s = settings({ 'friction.cooldownMinutes': 15 });
    const q = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    const meanwhile = requestChange(q.state, s, { 'weave.ceilingRatio': 0.9 }, NOW + MIN, ids);
    const done = applyReadyChanges(meanwhile.state, meanwhile.settings, NOW + 16 * MIN);
    assert.equal(done.settings.weave.baseRatio, 0.01, 'queued change applied');
    assert.equal(done.settings.weave.ceilingRatio, 0.9, 'intervening change preserved');
  });

  test('a request that changes nothing is not queued', () => {
    // Requesting the value a setting already has is neutral, not "easier",
    // so it must not occupy a cooldown slot the user then has to wait out.
    const s = settings({ 'friction.cooldownMinutes': 60 });
    const res = requestChange(emptyLockState(NOW), s, { 'learning.level': s.learning.level }, NOW, ids);
    assert.equal(res.applied, true);
    assert.equal(res.state.pending.length, 0);
  });

  test('several queued changes all apply', () => {
    const s = settings({ 'friction.cooldownMinutes': 5 });
    let state = emptyLockState(NOW);
    state = requestChange(state, s, { 'weave.baseRatio': 0.01 }, NOW, ids).state;
    state = requestChange(state, s, { 'learning.introduceNewPerDay': 2 }, NOW, ids).state;
    state = requestChange(state, s, { 'weave.minWordGap': 8 }, NOW, ids).state;
    const done = applyReadyChanges(state, s, NOW + 10 * MIN);
    assert.equal(done.applied.length, 3);
    assert.equal(done.settings.weave.minWordGap, 8);
  });
});

describe('quiz gate', () => {
  test('the cooldown alone is not enough when a quiz is required', () => {
    const s = settings({ 'friction.cooldownMinutes': 5, 'friction.requireQuizToUnlock': true });
    const q = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    const change = q.state.pending[0];
    assert.ok(change);
    assert.equal(isReady(change, s, NOW + 10 * MIN), false);
    assert.equal(applyReadyChanges(q.state, s, NOW + 10 * MIN).applied.length, 0);
  });

  test('passing the quiz unlocks it once the cooldown has also elapsed', () => {
    const s = settings({ 'friction.cooldownMinutes': 5, 'friction.requireQuizToUnlock': true });
    const q = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    const id = q.state.pending[0]?.id as string;
    const passed = markQuizPassed(q.state, id, NOW + MIN);
    assert.equal(applyReadyChanges(passed, s, NOW + 2 * MIN).applied.length, 0, 'cooldown still running');
    assert.equal(applyReadyChanges(passed, s, NOW + 6 * MIN).applied.length, 1);
  });
});

describe('cancelling', () => {
  test('is immediate and free', () => {
    const s = settings({ 'friction.cooldownMinutes': 720 });
    const q = requestChange(emptyLockState(NOW), s, { 'weave.baseRatio': 0.01 }, NOW, ids);
    const id = q.state.pending[0]?.id as string;
    const cancelled = cancelPending(q.state, id, NOW + MIN);
    assert.equal(cancelled.pending.length, 0);
    assert.equal(cancelled.log.at(-1)?.via, 'cancelled');
  });

  test('cancelling an unknown id is a no-op', () => {
    const state = emptyLockState(NOW);
    assert.deepEqual(cancelPending(state, 'nope', NOW).pending, []);
  });
});

describe('panic passes', () => {
  test('grants a pass and counts it', () => {
    const s = settings({ 'friction.panicPassesPerDay': 2, 'friction.panicMinutes': 5 });
    const res = usePanicPass(emptyLockState(NOW), s, NOW);
    assert.equal(res.granted, true);
    assert.equal(res.activeUntil, NOW + 5 * MIN);
    assert.equal(res.state.panic.used, 1);
    assert.equal(panicActive(res.state, NOW + MIN), true);
    assert.equal(panicActive(res.state, NOW + 6 * MIN), false);
  });

  test('refuses once the daily allowance is spent', () => {
    const s = settings({ 'friction.panicPassesPerDay': 1, 'friction.panicMinutes': 5 });
    const first = usePanicPass(emptyLockState(NOW), s, NOW);
    const second = usePanicPass(first.state, s, NOW + 10 * MIN);
    assert.equal(second.granted, false);
    assert.match(second.message, /used all/);
  });

  test('an already-running pass is reported, not double-counted', () => {
    const s = settings({ 'friction.panicPassesPerDay': 3, 'friction.panicMinutes': 10 });
    const first = usePanicPass(emptyLockState(NOW), s, NOW);
    const again = usePanicPass(first.state, s, NOW + MIN);
    assert.equal(again.granted, true);
    assert.equal(again.state.panic.used, 1, 'must not consume a second pass');
  });

  test('resets on the next day', () => {
    const s = settings({ 'friction.panicPassesPerDay': 1, 'friction.panicMinutes': 5 });
    const first = usePanicPass(emptyLockState(NOW), s, NOW);
    const tomorrow = usePanicPass(first.state, s, NOW + 25 * 3_600_000);
    assert.equal(tomorrow.granted, true);
    assert.equal(tomorrow.state.panic.used, 1);
  });

  test('zero passes means the valve is closed', () => {
    const s = settings({ 'friction.panicPassesPerDay': 0 });
    const res = usePanicPass(emptyLockState(NOW), s, NOW);
    assert.equal(res.granted, false);
    assert.match(res.message, /switched off/);
  });
});

describe('tamper response', () => {
  test('escalate pins a penalty window', () => {
    const s = settings({ 'friction.tamperResponse': 'escalate' });
    const state = recordTamper(emptyLockState(NOW), s, NOW);
    assert.equal(state.tamperCount, 1);
    assert.equal(penaltyActive(state, NOW + 3_600_000), true);
    assert.equal(penaltyActive(state, NOW + 13 * 3_600_000), false);
  });

  test('ignore records the event without penalty', () => {
    const s = settings({ 'friction.tamperResponse': 'ignore' });
    const state = recordTamper(emptyLockState(NOW), s, NOW);
    assert.equal(state.tamperCount, 1);
    assert.equal(penaltyActive(state, NOW + 60_000), false);
  });

  test('repeated tampering extends rather than resets the penalty', () => {
    const s = settings({ 'friction.tamperResponse': 'escalate' });
    let state = recordTamper(emptyLockState(NOW), s, NOW);
    const firstEnd = state.penaltyUntil as number;
    state = recordTamper(state, s, NOW + 3_600_000);
    assert.ok((state.penaltyUntil as number) > firstEnd);
  });

  test('the penalty holds TAMPER_PENALTY_HOURS from the last time it was noticed', () => {
    // The settings page, the popup and the privacy page say how long, and
    // tests/tools/penalty-copy.test.ts holds them to this number.
    const s = settings({ 'friction.tamperResponse': 'escalate' });
    const first = recordTamper(emptyLockState(NOW), s, NOW);
    assert.equal(first.penaltyUntil, NOW + TAMPER_PENALTY_HOURS * 3_600_000);
    const again = recordTamper(first, s, NOW + 3_600_000);
    assert.equal(again.penaltyUntil, NOW + 3_600_000 + TAMPER_PENALTY_HOURS * 3_600_000);
    const rewound = noteClock(noteClock(emptyLockState(NOW), s, NOW).state, s, NOW - 3 * 3_600_000);
    assert.equal(rewound.state.penaltyUntil, NOW - 3 * 3_600_000 + TAMPER_PENALTY_HOURS * 3_600_000);
  });
});

describe('describeWait', () => {
  test('reads naturally at every scale', () => {
    assert.equal(describeWait(0), 'now');
    assert.equal(describeWait(15 * MIN), 'in 15 min');
    assert.equal(describeWait(60 * MIN), 'in 1h');
    assert.equal(describeWait(95 * MIN), 'in 1h 35m');
    assert.equal(describeWait(48 * 3_600_000), 'in 2 days');
    assert.equal(describeWait(-1000), 'now');
  });
});

describe('audit log', () => {
  test('is capped so it cannot grow without bound', () => {
    const s = settings();
    let state = emptyLockState(NOW);
    for (let i = 0; i < 400; i++) {
      state = requestChange(state, s, { 'weave.baseRatio': 0.2 + i / 10000 }, NOW + i, ids).state;
    }
    assert.ok(state.log.length <= 200, `log grew to ${state.log.length}`);
  });
});

describe('noteClock', () => {
  /*
   * Winding the system clock forward clears a pending cooldown, and that
   * cannot be detected without a trusted time source — which would mean a
   * network request, the one thing Weft promises never to make. The return
   * trip can be detected, because time does not run backwards on its own.
   */
  const base = settings();

  test('the first observation is never suspicious', () => {
    const { state, rewound } = noteClock(emptyLockState(NOW), base, NOW);
    assert.equal(rewound, false);
    assert.equal(state.lastSeenAt, NOW);
    assert.equal(state.tamperCount, 0);
  });

  test('time moving forward is normal, and advances the baseline', () => {
    const first = noteClock(emptyLockState(NOW), base, NOW).state;
    const { state, rewound } = noteClock(first, base, NOW + 7 * 24 * 3_600_000);
    assert.equal(rewound, false, 'a week of a closed browser is not tampering');
    assert.equal(state.lastSeenAt, NOW + 7 * 24 * 3_600_000);
    assert.equal(state.tamperCount, 0);
  });

  test('a small backwards correction is tolerated', () => {
    // NTP and suspend/resume produce sub-second to second-scale skew. A
    // penalty for that would fire on ordinary machines doing nothing wrong.
    const first = noteClock(emptyLockState(NOW), base, NOW).state;
    const { rewound, state } = noteClock(first, base, NOW - 30_000);
    assert.equal(rewound, false);
    assert.equal(state.tamperCount, 0);
    assert.equal(state.lastSeenAt, NOW, 'the baseline must not drop on tolerated skew');
  });

  test('a large backwards jump is recorded as tampering', () => {
    const first = noteClock(emptyLockState(NOW), base, NOW).state;
    const { state, rewound } = noteClock(first, base, NOW - 3 * 3_600_000);
    assert.equal(rewound, true);
    assert.equal(state.tamperCount, 1);
    assert.ok(state.penaltyUntil && state.penaltyUntil > NOW, 'no penalty was applied');
  });

  test('the audit log says what happened, not "integrity check"', () => {
    // The user reads this log. Blaming the integrity check for a clock
    // change would send them looking for corrupted storage.
    const first = noteClock(emptyLockState(NOW), base, NOW).state;
    const { state } = noteClock(first, base, NOW - 3 * 3_600_000);
    assert.equal(state.log.at(-1)?.summary, 'the clock moved backwards');
  });

  test('one jump is penalised once, not on every later wake', () => {
    /*
     * The bug this guards: keeping the high-water mark as the baseline means
     * a single jump a year ahead leaves every subsequent wake for a year
     * reporting a rewind — one act, hundreds of penalties.
     */
    const year = 365 * 24 * 3_600_000;
    const jumped = noteClock(emptyLockState(NOW), base, NOW + year).state;
    const returned = noteClock(jumped, base, NOW);
    assert.equal(returned.rewound, true);
    assert.equal(returned.state.tamperCount, 1);

    const later = noteClock(returned.state, base, NOW + 60_000);
    assert.equal(later.rewound, false, 'penalised twice for one jump');
    assert.equal(later.state.tamperCount, 1);
  });

  test('a repeat attempt is still caught', () => {
    const year = 365 * 24 * 3_600_000;
    let state = noteClock(emptyLockState(NOW), base, NOW + year).state;
    state = noteClock(state, base, NOW).state;
    assert.equal(state.tamperCount, 1);
    // Round two.
    state = noteClock(state, base, NOW + year).state;
    const again = noteClock(state, base, NOW);
    assert.equal(again.rewound, true, 'accepting the corrected time must not grant amnesty');
    assert.equal(again.state.tamperCount, 2);
  });

  test("respects the user's choice to ignore tampering", () => {
    const ignoring = settings({ 'friction.tamperResponse': 'ignore' });
    const first = noteClock(emptyLockState(NOW), ignoring, NOW).state;
    const { state, rewound } = noteClock(first, ignoring, NOW - 3 * 3_600_000);
    assert.equal(rewound, true, 'still observed');
    assert.equal(state.tamperCount, 1, 'still counted');
    assert.equal(state.penaltyUntil, undefined, 'but not penalised');
  });
});

describe('the clock attack, end to end', () => {
  /*
   * An executable statement of the threat model, including the half that
   * works. Written down because the limitation is real and a future reader
   * should meet it here rather than discover it in a bug report — and
   * because a test asserting a known limitation stops someone "fixing" the
   * detector into something that also fires on a closed browser.
   */
  const base = settings({ 'friction.cooldownMinutes': 60 });

  test('winding the clock forward DOES clear a cooldown — this is not prevented', () => {
    const queued = requestChange(emptyLockState(NOW), base, { 'weave.baseRatio': 0.01 }, NOW, ids);
    const pending = queued.state.pending[0];
    assert.ok(pending, 'nothing was queued');
    assert.equal(isReady(pending, base, NOW + 30 * 60_000), false, 'ready too early');

    // The clock is now a day ahead. Nothing offline can tell this from a
    // browser that was simply closed for a day, which is exactly why it
    // works and why detecting it would need a trusted time source.
    assert.equal(
      isReady(pending, base, NOW + 24 * 3_600_000),
      true,
      'a forward clock jump clears the wait; if this ever fails, the ' +
        'cooldown model changed and the honesty note in docs/HARD-MODE.md ' +
        'needs revisiting',
    );
  });

  test('but coming back to the real time is recorded', () => {
    const day = 24 * 3_600_000;
    // Move forward, do the deed, then restore the clock so that mail,
    // calendars and TLS keep working. That second move is the evidence.
    let lock = noteClock(emptyLockState(NOW), base, NOW + day).state;
    assert.equal(lock.tamperCount, 0, 'the forward jump alone is invisible');

    const back = noteClock(lock, base, NOW);
    assert.equal(back.rewound, true);
    assert.equal(back.state.tamperCount, 1);
    assert.equal(back.state.log.at(-1)?.summary, 'the clock moved backwards');
  });

  test('leaving the clock wrong forever avoids detection, at a price', () => {
    // The one way to escape the footprint is to never come back — and a
    // machine permanently a day ahead is its own punishment. Weft does not
    // need to win this; it needs the cheap bypass to cost something.
    const day = 24 * 3_600_000;
    let lock = noteClock(emptyLockState(NOW), base, NOW + day).state;
    const later = noteClock(lock, base, NOW + day + 60_000);
    assert.equal(later.rewound, false);
    assert.equal(later.state.tamperCount, 0);
  });
});

/**
 * What an imported settings file is allowed to do at once.
 *
 * `importAll`'s doc comment has always promised that an import "is not a way
 * to install a forged difficulty setting", because "any reduction in
 * difficulty relative to the current state still has to pass the cooldown".
 * It did not: the import wrote the whole settings object straight to storage
 * and never touched the lock, so a file was a complete bypass of every
 * cooldown in `GOVERNED_PATHS` — the one path the commitment layer exists to
 * hold shut. Exporting on a fresh install, or editing one number in a JSON
 * file, applied instantly.
 *
 * The split is the same rule the rest of the product follows: harder now,
 * easier waits. Everything ungoverned — themes, tooltip contents,
 * accessibility — is not difficulty and is never held.
 */
describe('splitImportedSettings', () => {
  const base = settings();

  test('an import identical to what is here defers nothing', () => {
    const { immediate, deferred } = splitImportedSettings(base, settings());
    assert.deepEqual(deferred, {});
    assert.deepEqual(immediate, base);
  });

  test('a harder setting lands at once, like every other harder change', () => {
    const incoming = settings({ 'weave.ceilingRatio': 0.6 });
    const { immediate, deferred } = splitImportedSettings(base, incoming);
    assert.deepEqual(deferred, {});
    assert.equal(immediate.weave.ceilingRatio, 0.6);
  });

  test('an easier setting is held back, and the current value stays', () => {
    const incoming = settings({ 'weave.ceilingRatio': 0.01 });
    const { immediate, deferred } = splitImportedSettings(base, incoming);
    assert.deepEqual(deferred, { 'weave.ceilingRatio': 0.01 });
    assert.equal(
      immediate.weave.ceilingRatio,
      base.weave.ceilingRatio,
      'the easier value was written anyway',
    );
  });

  test('turning the attention tax off is held back', () => {
    const { deferred } = splitImportedSettings(base, settings({ 'attention.enabled': false }));
    assert.deepEqual(deferred, { 'attention.enabled': false });
  });

  test('a longer never-weave list is held back, a shorter one is not', () => {
    const longer = settings({ 'sites.excluded': [...base.sites.excluded, 'extra.test'] });
    assert.deepEqual(splitImportedSettings(base, longer).deferred, {
      'sites.excluded': longer.sites.excluded,
    });

    const shorter = settings({ 'sites.excluded': base.sites.excluded.slice(1) });
    assert.deepEqual(splitImportedSettings(base, shorter).deferred, {});
  });

  test('settings that are not difficulty are never held', () => {
    const incoming = settings({
      'reveal.showIpa': false,
      'a11y.highContrast': true,
      'weave.style.tint': '#ff0000',
    });
    const { immediate, deferred } = splitImportedSettings(base, incoming);
    assert.deepEqual(deferred, {}, 'a cosmetic setting was put behind a cooldown');
    assert.equal(immediate.reveal.showIpa, false);
    assert.equal(immediate.a11y.highContrast, true);
    assert.equal(immediate.weave.style.tint, '#ff0000');
  });

  test('a mixed file is split rather than taken or refused whole', () => {
    const incoming = settings({
      'weave.baseRatio': 0.2, // harder
      'friction.cooldownMinutes': 1, // easier
      'reveal.showIpa': false, // neither
    });
    const { immediate, deferred } = splitImportedSettings(base, incoming);
    assert.equal(immediate.weave.baseRatio, 0.2, 'the harder half was held back');
    assert.equal(immediate.reveal.showIpa, false, 'the cosmetic half was held back');
    assert.equal(
      immediate.friction.cooldownMinutes,
      base.friction.cooldownMinutes,
      'the easier half landed anyway',
    );
    assert.deepEqual(deferred, { 'friction.cooldownMinutes': 1 });
  });

  test('the deferred half is a patch requestChange can actually take', () => {
    const incoming = settings({ 'weave.ceilingRatio': 0.01 });
    const { immediate, deferred } = splitImportedSettings(base, incoming);
    const result = requestChange(emptyLockState(NOW), immediate, deferred, NOW, () => 'id');
    assert.equal(result.applied, false, 'the reduction applied without waiting');
    assert.equal(result.state.pending.length, 1);
    assert.match(result.message, /Queued/);
  });
});

describe('splitImportedSettings and the target language', () => {
  test('switching target language is held back, though its direction is neutral', () => {
    // directionOf scores a non-numeric governed path 'neutral'; assessPatch
    // knows that switching target resets vocabulary exposure and treats it
    // as easier. The split has to agree with assessPatch, not directionOf.
    const base = settings({ 'learning.targetLangs': ['fr', 'es'] });
    const incoming = settings({ 'learning.targetLangs': ['fr', 'es'], 'learning.activeTarget': 'es' });
    assert.equal(directionOf('learning.activeTarget', 'fr', 'es'), 'neutral');
    assert.deepEqual(splitImportedSettings(base, incoming).deferred, {
      'learning.activeTarget': 'es',
    });
  });
});
