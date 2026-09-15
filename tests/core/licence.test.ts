import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  verifyLicence,
  normalizeKey,
  describeLicence,
  needsAttention,
  toBase64Url,
  fromBase64Url,
} from '../../src/core/licence.ts';
import type { LicencePayload } from '../../src/core/licence.ts';

const enc = new TextEncoder();
const b64url = (b: Uint8Array | ArrayBuffer) => toBase64Url(new Uint8Array(b));

/** Sign a payload with the real private key, as the issuing tool does. */
async function issue(payload: LicencePayload): Promise<string> {
  const jwk = JSON.parse(await readFile('.licence-private.jwk', 'utf8'));
  const key = await webcrypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const part = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(part));
  return `WEFT-${part}.${b64url(sig)}`;
}

/** Sign with a keypair that is NOT the publisher's. */
async function forge(payload: LicencePayload): Promise<string> {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const part = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.privateKey,
    enc.encode(part),
  );
  return `WEFT-${part}.${b64url(sig)}`;
}

const lifetime: LicencePayload = {
  v: 1,
  id: 'abc123',
  tier: 'pro',
  name: 'Ada Lovelace',
  issued: Date.UTC(2026, 0, 1),
};

describe('base64url', () => {
  test('round-trips arbitrary bytes', () => {
    for (const len of [0, 1, 2, 3, 16, 64, 255]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 31 + 7) & 0xff;
      assert.deepEqual([...fromBase64Url(toBase64Url(bytes))], [...bytes]);
    }
  });

  test('emits no characters that need URL escaping', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    assert.match(toBase64Url(bytes), /^[A-Za-z0-9_-]+$/);
  });
});

describe('normalizeKey', () => {
  test('forgives the formatting a human will introduce', () => {
    // Licence keys get emailed, wrapped by mail clients, copied with the
    // prefix the receipt showed, and pasted with a trailing newline.
    // Rejecting any of that would generate support mail for no reason.
    const base = 'abc.def';
    for (const messy of [' abc.def ', 'WEFT-abc.def', 'weft-abc.def', 'abc.\ndef', 'abc. def']) {
      assert.equal(normalizeKey(messy), base, messy);
    }
  });

  test('an empty input normalises to empty rather than throwing', () => {
    assert.equal(normalizeKey('   '), '');
  });
});

describe('verifyLicence', () => {
  test('accepts a genuine lifetime licence', async () => {
    const status = await verifyLicence(await issue(lifetime));
    assert.equal(status.kind, 'valid');
    assert.equal(status.tier, 'pro');
    if (status.kind === 'valid') assert.equal(status.payload.name, 'Ada Lovelace');
  });

  test('accepts a genuine subscription that has not expired', async () => {
    const status = await verifyLicence(
      await issue({ ...lifetime, expires: Date.now() + 30 * 86_400_000 }),
    );
    assert.equal(status.kind, 'valid');
    assert.equal(status.tier, 'pro');
  });

  test('reports an expired subscription as expired, and falls back to free', async () => {
    const status = await verifyLicence(
      await issue({ ...lifetime, expires: Date.now() - 86_400_000 }),
    );
    assert.equal(status.kind, 'expired');
    assert.equal(status.tier, 'free');
  });

  test('rejects a licence signed by anyone else', async () => {
    // The one that matters: a plausible payload, correctly formatted, signed
    // with a keypair that is not the publisher's.
    const status = await verifyLicence(await forge(lifetime));
    assert.equal(status.kind, 'invalid');
    assert.equal(status.tier, 'free');
  });

  test('rejects an edited payload', async () => {
    // Keep a genuine signature for a free licence, swap in a pro payload.
    const key = normalizeKey(await issue({ ...lifetime, tier: 'free' }));
    const sig = key.slice(key.indexOf('.') + 1);
    const upgraded = toBase64Url(enc.encode(JSON.stringify({ ...lifetime, tier: 'pro' })));
    const status = await verifyLicence(`${upgraded}.${sig}`);
    assert.equal(status.kind, 'invalid');
  });

  test('rejects an edited signature', async () => {
    const key = normalizeKey(await issue(lifetime));
    const dot = key.indexOf('.');
    const flipped = key.slice(0, dot + 1) + (key[dot + 1] === 'A' ? 'B' : 'A') + key.slice(dot + 2);
    assert.equal((await verifyLicence(flipped)).kind, 'invalid');
  });

  test('treats an absent key as free rather than as an error', async () => {
    for (const empty of ['', '   ', 'WEFT-']) {
      const status = await verifyLicence(empty);
      assert.equal(status.kind, 'none', JSON.stringify(empty));
      assert.equal(status.tier, 'free');
    }
  });

  test('gives a readable reason for malformed input', async () => {
    for (const junk of ['not a licence', 'abc', '.', 'abc.', '.def']) {
      const status = await verifyLicence(junk);
      assert.equal(status.kind, 'invalid', junk);
      if (status.kind === 'invalid') {
        assert.ok(status.reason.length > 10, `unhelpful reason for ${junk}`);
        assert.doesNotMatch(status.reason, /error|exception|undefined/i);
      }
    }
  });

  test('rejects a licence from a future format version', async () => {
    const status = await verifyLicence(await issue({ ...lifetime, v: 2 as unknown as 1 }));
    assert.equal(status.kind, 'invalid');
  });

  test('never throws, whatever it is given', async () => {
    const nasty = [
      ' . ',
      'a'.repeat(10000) + '.' + 'b'.repeat(10000),
      toBase64Url(enc.encode('{"v":1,')) + '.AAAA',
      toBase64Url(enc.encode('null')) + '.AAAA',
      toBase64Url(enc.encode('[]')) + '.AAAA',
    ];
    for (const input of nasty) {
      const status = await verifyLicence(input);
      assert.ok(['invalid', 'none'].includes(status.kind), input.slice(0, 24));
    }
  });
});

describe('describeLicence', () => {
  test('describes a free install without making it sound broken', () => {
    const text = describeLicence({ kind: 'none', tier: 'free' });
    assert.match(text, /Free/);
    assert.match(text, /no time limit/);
  });

  test('names the licensee and the term', () => {
    assert.match(
      describeLicence({ kind: 'valid', tier: 'pro', payload: lifetime }),
      /lifetime.*Ada Lovelace/,
    );
    assert.match(
      describeLicence({
        kind: 'valid',
        tier: 'pro',
        payload: { ...lifetime, expires: Date.now() + 10 * 86_400_000 },
      }),
      /Renews in 10 days/,
    );
  });

  test('expiry copy reassures rather than threatens', () => {
    // Someone whose card failed has not lost their vocabulary, and the first
    // thing they read should say so.
    assert.match(
      describeLicence({
        kind: 'expired',
        tier: 'free',
        payload: { ...lifetime, expires: Date.UTC(2026, 5, 1) },
      }),
      /still here/,
    );
  });
});

describe('needsAttention', () => {
  test('flags expiry, invalidity and imminent renewal only', () => {
    assert.equal(needsAttention({ kind: 'none', tier: 'free' }), false);
    assert.equal(needsAttention({ kind: 'valid', tier: 'pro', payload: lifetime }), false);
    assert.equal(
      needsAttention({
        kind: 'valid',
        tier: 'pro',
        payload: { ...lifetime, expires: Date.now() + 60 * 86_400_000 },
      }),
      false,
    );
    assert.equal(
      needsAttention({
        kind: 'valid',
        tier: 'pro',
        payload: { ...lifetime, expires: Date.now() + 3 * 86_400_000 },
      }),
      true,
    );
    assert.equal(needsAttention({ kind: 'expired', tier: 'free', payload: lifetime }), true);
    assert.equal(needsAttention({ kind: 'invalid', tier: 'free', reason: 'x' }), true);
  });
});
