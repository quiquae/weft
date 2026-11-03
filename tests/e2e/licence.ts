import { webcrypto } from 'node:crypto';
import { TEST_LICENCE_PRIVATE_JWK } from '../fixtures/licence-keypair.ts';

/**
 * A licence key, signed as the extension under test will accept one.
 *
 * Signed with the throwaway private key whose public half `build.mjs --test`
 * compiles in, never the publisher's: see `licensing.spec.ts`. Shared since
 * 2026-11-03, when `privacy.spec.ts` needed Pro to switch a translation
 * service on, the panel it reads printing nothing about one on Free.
 */

const b64url = (b: Buffer | ArrayBuffer) =>
  Buffer.from(b as Buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function issue(payload: Record<string, unknown>, forged = false): Promise<string> {
  let key: CryptoKey;
  if (forged) {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ]);
    key = pair.privateKey;
  } else {
    key = await webcrypto.subtle.importKey(
      'jwk',
      TEST_LICENCE_PRIVATE_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  }
  const part = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    Buffer.from(part, 'utf8'),
  );
  return `WEFT-${part}.${b64url(sig)}`;
}

export const proPayload = {
  v: 1,
  id: 'e2e-test',
  tier: 'pro',
  name: 'End To End',
  issued: Date.now(),
};
