import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyLockState,
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
