import type { Tier } from './entitlements.ts';
import { LICENCE_PUBLIC_KEY_JWK } from './licence-key.ts';

/**
 * Licence verification, entirely offline.
 *
 * A licence is a signed statement, not a token to be checked against a
 * server. It carries its own proof: the payload is signed with a private key
 * that only the publisher holds, and the extension verifies it against an
 * embedded public key using WebCrypto.
 *
 * That choice is a feature rather than an implementation detail. Weft's whole
 * pitch is that nothing leaves your machine, and an activation server would
 * put a lie in the middle of it — every launch phoning home with a licence
 * key is a per-user identifier and a log of when you use the product. This
 * way there is no account, no activation, no server, and no request to block.
 * You can verify that claim by watching the network panel.
 *
 * The honest cost: **a licence cannot be revoked.** Without a server there is
 * nowhere to publish a revocation. Subscriptions therefore carry an `expires`
 * date and simply stop verifying; a lifetime key is trusted forever. A leaked
 * lifetime key would work until the signing key is rotated, which invalidates
 * every licence and means reissuing them. That is the trade, and it is stated
 * in docs/PRICING.md rather than buried.
 *
 * ECDSA P-256 rather than Ed25519, which is tidier but only reached
 * WebCrypto in Chrome 137 and would have excluded browsers Weft otherwise
 * supports.
 */

export interface LicencePayload {
  /** Format version. */
  v: 1;
  /** Opaque licence id, for the publisher's own records. */
  id: string;
  tier: Tier;
  /** Who it was issued to, shown back to them in settings. */
  name: string;
  /** Epoch ms. */
  issued: number;
  /** Epoch ms. Absent means a lifetime licence. */
  expires?: number;
}

export type LicenceStatus =
  | { kind: 'none'; tier: 'free' }
  | { kind: 'valid'; tier: Tier; payload: LicencePayload }
  | { kind: 'expired'; tier: 'free'; payload: LicencePayload }
  | { kind: 'invalid'; tier: 'free'; reason: string };

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ------------------------------------------------------------ base64url */

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] as number);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* -------------------------------------------------------------- verify */

let cachedKey: CryptoKey | null = null;

async function publicKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    'jwk',
    LICENCE_PUBLIC_KEY_JWK,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return cachedKey;
}

/**
 * Strip the formatting a human will inevitably introduce.
 *
 * Licence keys get emailed, wrapped by mail clients, copied with a trailing
 * newline, and pasted with the "WEFT-" prefix the receipt showed. Rejecting
 * any of that would generate support mail for no reason.
 */
export function normalizeKey(input: string): string {
  return input
    .trim()
    .replace(/^WEFT-/i, '')
    .replace(/\s+/g, '');
}

export async function verifyLicence(input: string): Promise<LicenceStatus> {
  const key = normalizeKey(input);
  if (!key) return { kind: 'none', tier: 'free' };

  const dot = key.indexOf('.');
  if (dot <= 0 || dot === key.length - 1) {
    return { kind: 'invalid', tier: 'free', reason: 'That does not look like a Weft licence key.' };
  }

  const payloadPart = key.slice(0, dot);
  const signaturePart = key.slice(dot + 1);

  let payload: LicencePayload;
  try {
    payload = JSON.parse(dec.decode(fromBase64Url(payloadPart))) as LicencePayload;
  } catch {
    return { kind: 'invalid', tier: 'free', reason: 'The licence key is damaged. Paste it again?' };
  }

  if (payload?.v !== 1 || (payload.tier !== 'pro' && payload.tier !== 'free')) {
    return { kind: 'invalid', tier: 'free', reason: 'That licence was issued for a different version of Weft.' };
  }

  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      await publicKey(),
      fromBase64Url(signaturePart) as unknown as ArrayBuffer,
      enc.encode(payloadPart) as unknown as ArrayBuffer,
    );
  } catch {
    ok = false;
  }

  if (!ok) {
    return {
      kind: 'invalid',
      tier: 'free',
      reason: 'That licence key did not verify. Check for a missing character, or get in touch.',
    };
  }

  if (payload.expires !== undefined && Date.now() > payload.expires) {
    return { kind: 'expired', tier: 'free', payload };
  }

  return { kind: 'valid', tier: payload.tier, payload };
}

/** Human summary for the settings page. */
export function describeLicence(status: LicenceStatus): string {
  switch (status.kind) {
    case 'none':
      return 'Weft Free. One language, the whole lexicon for it, and no time limit.';
    case 'valid': {
      const { payload } = status;
      if (payload.tier === 'free') return 'Weft Free.';
      if (payload.expires === undefined) {
        return `Weft Pro, lifetime. Licensed to ${payload.name}.`;
      }
      const days = Math.ceil((payload.expires - Date.now()) / 86_400_000);
      return `Weft Pro, licensed to ${payload.name}. Renews in ${days} day${days === 1 ? '' : 's'}.`;
    }
    case 'expired': {
      const on = new Date(status.payload.expires ?? 0).toLocaleDateString();
      return `This licence ended on ${on}. Everything you learned is still here, and one language stays active.`;
    }
    case 'invalid':
      return status.reason;
  }
}

/** Whether the status should prompt a renewal nudge. Deliberately narrow. */
export function needsAttention(status: LicenceStatus): boolean {
  if (status.kind === 'expired' || status.kind === 'invalid') return true;
  if (status.kind === 'valid' && status.payload.expires !== undefined) {
    return status.payload.expires - Date.now() < 7 * 86_400_000;
  }
  return false;
}
