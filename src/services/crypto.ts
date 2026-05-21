/**
 * Password hashing — PBKDF2-SHA256 via the Web Crypto API.
 *
 * Why PBKDF2 (and not bcrypt/argon2):
 *  - Web Crypto ships PBKDF2 natively in every modern browser → zero deps.
 *  - 200 000 iterations × SHA-256 is the OWASP 2025 baseline; tunable below.
 *
 * SECURITY NOTE — local-first context:
 *  DOINg.AI stores its DB in a plain JSON file readable by anyone on the host.
 *  Hashing passwords prevents casual disclosure (db.json snapshots, backups,
 *  cross-tab leaks) but it is NOT a substitute for filesystem-level
 *  protection. Treat this as defence-in-depth, not authentication hardening.
 */

const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32; // 256-bit derived key

const enc = new TextEncoder();

/** base64 ↔ Uint8Array helpers (the standard `btoa` won't handle binary safely). */
const toB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const fromB64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Constant-time string comparison to defeat timing attacks. */
const constantTimeEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/**
 * Derive a PBKDF2 hash for a plaintext password.
 * If `salt` is omitted, a fresh 16-byte random salt is generated.
 * Returns both fields base64-encoded for safe JSON storage.
 */
export const hashPassword = async (
  plain: string,
  salt?: string
): Promise<{ hash: string; salt: string }> => {
  const saltBytes = salt
    ? fromB64(salt)
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(plain),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    KEY_BYTES * 8
  );

  return { hash: toB64(derived), salt: toB64(saltBytes) };
};

/** Verify a plaintext password against a stored hash + salt. */
export const verifyPassword = async (
  plain: string,
  hash: string,
  salt: string
): Promise<boolean> => {
  try {
    const { hash: computed } = await hashPassword(plain, salt);
    return constantTimeEq(computed, hash);
  } catch {
    return false;
  }
};

/**
 * Generate a human-readable temporary password.
 * Excludes ambiguous characters (0/O, 1/l/I) for transcription over chat/email.
 * Default 12 chars ≈ 70 bits of entropy — fine for a one-shot reset.
 */
export const generateTempPassword = (length = 12): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
};
