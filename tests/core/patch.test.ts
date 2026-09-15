import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getPath, setPath, applyPatch, patchKey, diffPaths } from '../../src/core/patch.ts';

describe('getPath', () => {
  test('reads nested values', () => {
    assert.equal(getPath({ a: { b: { c: 7 } } }, 'a.b.c'), 7);
  });

  test('returns undefined for missing paths without throwing', () => {
    assert.equal(getPath({ a: 1 }, 'a.b.c'), undefined);
    assert.equal(getPath(null, 'a'), undefined);
    assert.equal(getPath(undefined, 'a.b'), undefined);
  });
});

describe('setPath', () => {
  test('sets nested values without mutating the input', () => {
    const before = { a: { b: 1 }, keep: true };
    const after = setPath(before, 'a.b', 2);
    assert.equal(after.a.b, 2);
    assert.equal(before.a.b, 1, 'input must not be mutated');
    assert.equal(after.keep, true);
  });

  test('creates intermediate objects', () => {
    const out = setPath({} as Record<string, unknown>, 'x.y.z', 1);
    assert.equal(getPath(out, 'x.y.z'), 1);
  });

  test('replaces arrays wholesale rather than merging', () => {
    const before = { list: [1, 2, 3] };
    const after = setPath(before, 'list', [9]);
    assert.deepEqual(after.list, [9]);
    assert.deepEqual(before.list, [1, 2, 3]);
  });

  test('copies arrays along the path instead of sharing them', () => {
    const before = { rules: [{ enabled: true }] };
    const after = setPath(before, 'rules.0.enabled', false);
    assert.equal(before.rules[0]?.enabled, true);
    assert.equal((after.rules[0] as { enabled: boolean }).enabled, false);
  });
});

describe('applyPatch', () => {
  test('applies several paths at once', () => {
    const out = applyPatch({ a: 1, b: { c: 2 } }, { a: 9, 'b.c': 8 });
    assert.deepEqual(out, { a: 9, b: { c: 8 } });
  });

  test('an empty patch is the identity', () => {
    const before = { a: 1 };
    assert.deepEqual(applyPatch(before, {}), before);
  });
});

describe('patchKey', () => {
  test('is order-independent', () => {
    assert.equal(patchKey({ a: 1, b: 2 }), patchKey({ b: 2, a: 1 }));
  });

  test('differs for different path sets', () => {
    assert.notEqual(patchKey({ a: 1 }), patchKey({ a: 1, b: 2 }));
  });
});

describe('diffPaths', () => {
  test('reports only the paths that actually changed', () => {
    const a = { x: 1, y: { z: 2 }, list: [1] };
    const b = { x: 1, y: { z: 3 }, list: [1] };
    assert.deepEqual(diffPaths(a, b, ['x', 'y.z', 'list']), ['y.z']);
  });

  test('detects array changes by value, not identity', () => {
    assert.deepEqual(diffPaths({ l: [1, 2] }, { l: [1, 2] }, ['l']), []);
    assert.deepEqual(diffPaths({ l: [1, 2] }, { l: [2, 1] }, ['l']), ['l']);
  });
});
