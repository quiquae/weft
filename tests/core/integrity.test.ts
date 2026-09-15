import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, seal, open, stableStringify, newInstallId } from '../../src/core/integrity.ts';

const ID = 'install-abc';

describe('stableStringify', () => {
  test('is insensitive to key order', () => {
    assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  });

  test('is sensitive to values and nesting', () => {
    assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
    assert.notEqual(stableStringify({ a: { b: 1 } }), stableStringify({ a: { b: 2 } }));
  });

  test('preserves array order, which is meaningful', () => {
    assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
  });

  test('omits undefined members rather than emitting invalid JSON', () => {
    assert.equal(stableStringify({ a: 1, b: undefined }), '{"a":1}');
  });

  test('handles primitives and null', () => {
    assert.equal(stableStringify(null), 'null');
    assert.equal(stableStringify(5), '5');
    assert.equal(stableStringify('x'), '"x"');
    assert.equal(stableStringify(true), 'true');
  });
});

describe('sign and verify', () => {
  test('a signature verifies against its own payload', async () => {
    const payload = { ratio: 0.3, level: 2 };
    const sig = await sign(ID, payload);
    assert.equal(await verify(ID, payload, sig), true);
  });

  test('a modified payload fails', async () => {
    const sig = await sign(ID, { ratio: 0.3 });
    assert.equal(await verify(ID, { ratio: 0.05 }, sig), false);
  });

  test('a different install id fails', async () => {
    const sig = await sign(ID, { ratio: 0.3 });
    assert.equal(await verify('other-install', { ratio: 0.3 }, sig), false);
  });

  test('key order in the payload does not change the result', async () => {
    const sig = await sign(ID, { a: 1, b: 2 });
    assert.equal(await verify(ID, { b: 2, a: 1 }, sig), true);
  });

  test('an empty or malformed signature fails rather than throwing', async () => {
    assert.equal(await verify(ID, { a: 1 }, ''), false);
    assert.equal(await verify(ID, { a: 1 }, 'not-base64!!!'), false);
  });
});

describe('seal and open', () => {
  test('round-trips intact data', async () => {
    const env = await seal(ID, { level: 3 });
    const res = await open<{ level: number }>(ID, env);
    assert.deepEqual(res.data, { level: 3 });
    assert.equal(res.tampered, false);
    assert.equal(res.missing, false);
  });

  test('flags edited data as tampered but still returns it', async () => {
    const env = await seal(ID, { level: 3 });
    const edited = { ...env, data: { level: 1 } };
    const res = await open<{ level: number }>(ID, edited);
    assert.equal(res.tampered, true);
    assert.deepEqual(res.data, { level: 1 }, 'caller decides what to do with it');
  });

  test('flags a stripped signature as tampered, not missing', async () => {
    const env = await seal(ID, { level: 3 });
    const res = await open(ID, { ...env, sig: 'AAAA' });
    assert.equal(res.tampered, true);
  });

  test('reports genuinely absent data as missing, not tampered', async () => {
    for (const input of [undefined, null, {}, { v: 2, data: {}, sig: 'x' }, 'nope']) {
      const res = await open(ID, input);
      assert.equal(res.missing, true, `${JSON.stringify(input)} should be missing`);
      assert.equal(res.tampered, false);
    }
  });
});

describe('newInstallId', () => {
  test('is a 32-character hex string', () => {
    assert.match(newInstallId(), /^[0-9a-f]{32}$/);
  });

  test('does not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newInstallId()));
    assert.equal(ids.size, 200);
  });
});
