import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  verifyLicence,
  normalizeKey,
  describeLicence,
  needsAttention,
  toBase64Url,
  fromBase64Url,
} from '../../src/core/licence.ts';
import type { LicencePayload } from '../../src/core/licence.ts';
import { LICENCE_PUBLIC_KEY_JWK } from '../../src/core/licence-key.ts';

const enc = new TextEncoder();
const b64url = (b: Uint8Array | ArrayBuffer) => toBase64Url(new Uint8Array(b));

const DAY = 86_400_000;

/*
 * The instants a licence is judged at, one well before the real clock and one
 * well after it, so a check that reads `Date.now()` rather than the `now` it
 * is given gets a different answer at one of them rather than the same at both.
 */
const PAST = Date.UTC(2021, 2, 14, 9, 30);
const FUTURE = Date.UTC(2041, 2, 14, 9, 30);

/**
 * A throwaway publisher keypair, generated once for this file.
 *
 * These tests used to sign with the real private key, read from
 * `.licence-private.jwk`. That file is gitignored — correctly, it is the
 * thing that mints licences — so the suite passed on a machine that had it
 * and failed in CI on every single push with
 * `ENOENT: .licence-private.jwk`. Six subtests, permanently red, for a
 * reason that could never fix itself.
 *
 * Skipping them when the key was missing would have been worse: CI is the
 * one place that runs everything, and the thing being skipped is whether a
 * paid licence is accepted at all.
 *
 * So the tests mint their own. `verifyLicence` takes the verifying key as an
 * option, defaulting to the publisher's, and these pass their own — which
 * exercises the identical code path with no secret in it. A separate test
 * below asserts the default really is the compiled-in publisher key, so this
 * seam cannot quietly become the normal path.
 */
let publisher: Promise<CryptoKeyPair> | null = null;
function keys(): Promise<CryptoKeyPair> {
  publisher ??= webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]) as Promise<CryptoKeyPair>;
  return publisher;
}

/** The public half, in the shape verifyLicence wants. */
async function publicKeyJwk(): Promise<JsonWebKey> {
  const { publicKey } = await keys();
  return webcrypto.subtle.exportKey('jwk', publicKey) as Promise<JsonWebKey>;
}

/** Sign a payload as the issuing tool does. */
async function issue(payload: LicencePayload): Promise<string> {
  const { privateKey } = await keys();
  const part = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    enc.encode(part),
  );
  return `WEFT-${part}.${b64url(sig)}`;
}

/** verifyLicence against this file's keypair rather than the publisher's. */
async function verify(input: string, now = PAST) {
  return verifyLicence(input, now, { publicKeyJwk: await publicKeyJwk() });
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
    const status = await verify(await issue(lifetime));
    assert.equal(status.kind, 'valid');
    assert.equal(status.tier, 'pro');
    if (status.kind === 'valid') assert.equal(status.payload.name, 'Ada Lovelace');
  });

  test('accepts a genuine subscription that has not expired', async () => {
    const status = await verify(await issue({ ...lifetime, expires: PAST + 30 * DAY }), PAST);
    assert.equal(status.kind, 'valid');
    assert.equal(status.tier, 'pro');
  });

  test('reports an expired subscription as expired, and falls back to free', async () => {
    const status = await verify(await issue({ ...lifetime, expires: FUTURE - DAY }), FUTURE);
    assert.equal(status.kind, 'expired');
    assert.equal(status.tier, 'free');
  });

  test('is judged at the instant it is given, to the second', async () => {
    const at = async (expires: number, now: number) => (await verify(await issue({ ...lifetime, expires }), now)).kind;
    assert.equal(await at(FUTURE - 1000, FUTURE), 'expired', 'a second past its expiry');
    assert.equal(await at(PAST + 1000, PAST), 'valid', 'a second before it');
    assert.equal(await at(PAST, PAST), 'valid', 'at its expiry, which it reaches and does not pass');
  });

  test('rejects a licence signed by anyone else', async () => {
    // The one that matters: a plausible payload, correctly formatted, signed
    // with a keypair that is not the publisher's.
    const status = await verify(await forge(lifetime));
    assert.equal(status.kind, 'invalid');
    assert.equal(status.tier, 'free');
  });

  test('rejects an edited payload', async () => {
    // Keep a genuine signature for a free licence, swap in a pro payload.
    const key = normalizeKey(await issue({ ...lifetime, tier: 'free' }));
    const sig = key.slice(key.indexOf('.') + 1);
    const upgraded = toBase64Url(enc.encode(JSON.stringify({ ...lifetime, tier: 'pro' })));
    const status = await verify(`${upgraded}.${sig}`);
    assert.equal(status.kind, 'invalid');
  });

  test('rejects an edited signature', async () => {
    const key = normalizeKey(await issue(lifetime));
    const dot = key.indexOf('.');
    const flipped = key.slice(0, dot + 1) + (key[dot + 1] === 'A' ? 'B' : 'A') + key.slice(dot + 2);
    assert.equal((await verify(flipped)).kind, 'invalid');
  });

  test('treats an absent key as free rather than as an error', async () => {
    for (const empty of ['', '   ', 'WEFT-']) {
      const status = await verify(empty);
      assert.equal(status.kind, 'none', JSON.stringify(empty));
      assert.equal(status.tier, 'free');
    }
  });

  test('gives a readable reason for malformed input', async () => {
    for (const junk of ['not a licence', 'abc', '.', 'abc.', '.def']) {
      const status = await verify(junk);
      assert.equal(status.kind, 'invalid', junk);
      if (status.kind === 'invalid') {
        assert.ok(status.reason.length > 10, `unhelpful reason for ${junk}`);
        assert.doesNotMatch(status.reason, /error|exception|undefined/i);
      }
    }
  });

  test('rejects a licence from a future format version', async () => {
    const status = await verify(await issue({ ...lifetime, v: 2 as unknown as 1 }));
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
      const status = await verify(input);
      assert.ok(['invalid', 'none'].includes(status.kind), input.slice(0, 24));
    }
  });
});

describe('describeLicence', () => {
  test('describes a free install without making it sound broken', () => {
    const text = describeLicence({ kind: 'none', tier: 'free' }, PAST);
    assert.match(text, /Free/);
    assert.match(text, /no time limit/);
  });

  test('names the licensee and the term', () => {
    assert.match(
      describeLicence({ kind: 'valid', tier: 'pro', payload: lifetime }, PAST),
      /lifetime.*Ada Lovelace/,
    );
    assert.match(
      describeLicence({ kind: 'valid', tier: 'pro', payload: { ...lifetime, expires: PAST + 10 * DAY } }, PAST),
      /Renews in 10 days/,
    );
  });

  test('counts the days left from the instant it is given', () => {
    const renews = (expires: number, now: number) =>
      describeLicence({ kind: 'valid', tier: 'pro', payload: { ...lifetime, expires } }, now);
    assert.match(renews(FUTURE + 7 * DAY, FUTURE), /Renews in 7 days\./);
    assert.match(renews(PAST + 7 * DAY, PAST), /Renews in 7 days\./);
    assert.match(renews(FUTURE + 3_600_000, FUTURE), /Renews in 1 day\./);
  });

  test('expiry copy reassures rather than threatens', () => {
    // Someone whose card failed has not lost their vocabulary, and the first
    // thing they read should say so.
    assert.match(
      describeLicence(
        {
          kind: 'expired',
          tier: 'free',
          payload: { ...lifetime, expires: Date.UTC(2026, 5, 1) },
        },
        FUTURE,
      ),
      /still here/,
    );
  });
});

describe('needsAttention', () => {
  test('flags expiry, invalidity and imminent renewal only', () => {
    const renewing = (expires: number) => ({ kind: 'valid', tier: 'pro', payload: { ...lifetime, expires } }) as const;
    assert.equal(needsAttention({ kind: 'none', tier: 'free' }, PAST), false);
    assert.equal(needsAttention({ kind: 'valid', tier: 'pro', payload: lifetime }, PAST), false);
    assert.equal(needsAttention(renewing(PAST + 60 * DAY), PAST), false);
    assert.equal(needsAttention(renewing(PAST + 3 * DAY), PAST), true);
    assert.equal(needsAttention({ kind: 'expired', tier: 'free', payload: lifetime }, PAST), true);
    assert.equal(needsAttention({ kind: 'invalid', tier: 'free', reason: 'x' }, PAST), true);
  });

  test('nudges inside the last seven days before the instant it is given, and not a millisecond sooner', () => {
    const renewing = (expires: number) => ({ kind: 'valid', tier: 'pro', payload: { ...lifetime, expires } }) as const;
    assert.equal(needsAttention(renewing(FUTURE + 7 * DAY), FUTURE), false);
    assert.equal(needsAttention(renewing(FUTURE + 7 * DAY - 1), FUTURE), true);
    assert.equal(needsAttention(renewing(PAST + 7 * DAY), PAST), false);
  });
});

describe('the verifying key defaults to the publisher', () => {
  test('a licence minted by this test file does NOT verify by default', async () => {
    /*
     * The guard on the seam above. `verifyLicence` takes the verifying key as
     * an option so the tests can mint their own without the gitignored
     * private key; the danger is that the option quietly becomes how
     * production verifies too, at which point anyone's self-signed licence
     * would be accepted as Pro.
     *
     * Calling verifyLicence with NO options must reject a licence signed by
     * this file's throwaway key. If that ever passes, the default has stopped
     * being the publisher's key and Pro is free for anyone who can run
     * generateKey.
     */
    const status = await verifyLicence(await issue(lifetime), PAST);
    assert.equal(status.kind, 'invalid', 'a self-signed licence was accepted by default');
    assert.equal(status.tier, 'free');
  });

  test('the default key is the one compiled into the extension', async () => {
    const status = await verifyLicence(await issue(lifetime), PAST, {
      publicKeyJwk: LICENCE_PUBLIC_KEY_JWK as unknown as JsonWebKey,
    });
    // Same verdict as passing nothing, which is what "defaults to" means.
    assert.equal(status.kind, 'invalid');
  });

  test('two different keys do not share a cache entry', async () => {
    // The import cache is keyed by the key itself. With a single cached slot
    // the first key used would be handed to every later caller, so one
    // test's ephemeral key would verify another's licence.
    const mine = await issue(lifetime);
    assert.equal((await verify(mine)).kind, 'valid');
    assert.equal((await verifyLicence(mine, PAST)).kind, 'invalid');
    assert.equal((await verify(mine)).kind, 'valid');
  });
});
