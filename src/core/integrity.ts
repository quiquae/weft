/**
 * Integrity signing for stored state.
 *
 * What this is: a tripwire. Difficulty settings, attention counters and pending
 * cooldowns are signed with an HMAC derived from the install id, so casually
 * editing them in devtools or via an exported/re-imported JSON file is
 * detected and answered by escalating difficulty rather than honouring the
 * edit.
 *
 * What this is not: security. The key material is derived from data that ships
 * inside the extension, so anyone willing to read the source can forge a valid
 * signature. That is fine and it is stated plainly in docs/PRIVACY.md. The goal
 * is to make the lazy bypass cost more effort than doing the reading, which is
 * exactly the same bargain every screen-time tool on a general-purpose computer
 * makes. Anyone who wants a hard guarantee should use Hard Mode, which moves
 * enforcement into an OS-level managed policy.
 */

const enc = new TextEncoder();

/** Build-time salt. Rotating this invalidates every existing signature. */
const SALT = 'weft/v1/state-integrity';

let cachedKey: { installId: string; key: CryptoKey } | null = null;

async function deriveKey(installId: string): Promise<CryptoKey> {
  if (cachedKey && cachedKey.installId === installId) return cachedKey.key;

  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${SALT}:${installId}`),
    'HKDF',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(SALT), info: enc.encode('hmac') },
    base,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
  cachedKey = { installId, key };
  return key;
}

/**
 * Stable JSON: object keys sorted recursively so that two structurally equal
 * states always produce the same signature regardless of insertion order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i] as number);
  return btoa(s);
}

export async function sign(installId: string, payload: unknown): Promise<string> {
  const key = await deriveKey(installId);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(stableStringify(payload)));
  return toBase64(sig);
}

export async function verify(
  installId: string,
  payload: unknown,
  signature: string,
): Promise<boolean> {
  if (!signature) return false;
  try {
    const expected = await sign(installId, payload);
    return timingSafeEqual(expected, signature);
  } catch {
    return false;
  }
}

/** Constant-time-ish string compare. Prevents a trivially observable oracle. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface SignedEnvelope<T> {
  v: 1;
  data: T;
  sig: string;
}

export async function seal<T>(installId: string, data: T): Promise<SignedEnvelope<T>> {
  return { v: 1, data, sig: await sign(installId, data) };
}

export interface OpenResult<T> {
  data: T | null;
  /** True when a signature was present and did not match. */
  tampered: boolean;
  /** True when no envelope was present at all (first run, or legacy data). */
  missing: boolean;
}

export async function open<T>(
  installId: string,
  envelope: unknown,
): Promise<OpenResult<T>> {
  if (!envelope || typeof envelope !== 'object') {
    return { data: null, tampered: false, missing: true };
  }
  const env = envelope as Partial<SignedEnvelope<T>>;
  if (env.v !== 1 || env.data === undefined || typeof env.sig !== 'string') {
    return { data: null, tampered: false, missing: true };
  }
  const ok = await verify(installId, env.data, env.sig);
  return ok
    ? { data: env.data as T, tampered: false, missing: false }
    : { data: env.data as T, tampered: true, missing: false };
}

/** Cryptographically random install id. */
export function newInstallId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
