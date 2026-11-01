import { argon2idAsync } from '@noble/hashes/argon2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToBase64Url, utf8ToBytes, wipe } from './encoding';

export interface KdfParams {
  algorithm: 'argon2id';
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/**
 * OWASP's minimum Argon2id configuration (19 MiB, t=2, p=1).
 * Must stay in sync with `backend/src/config/constants.ts`.
 */
export const DEFAULT_KDF: KdfParams = {
  algorithm: 'argon2id',
  memoryKiB: 19_456,
  iterations: 2,
  parallelism: 1,
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Per-account Argon2id salt.
 *
 * The salt has to be known before the first request, otherwise the client
 * would need a "give me the salt for this email" endpoint, which is a user
 * enumeration oracle. Deriving it from the (globally unique) email address
 * keeps salts unique per account without that trade-off.
 */
function kdfSalt(email: string): Uint8Array {
  return sha256(utf8ToBytes(`vaultory|kdf|v1|${normalizeEmail(email)}`));
}

async function hkdf(rootKey: Uint8Array, info: string, bytes = 32): Promise<Uint8Array> {
  const ikm = await crypto.subtle.importKey('raw', rootKey as BufferSource, 'HKDF', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8ToBytes(info) },
    ikm,
    bytes * 8,
  );
  return new Uint8Array(derived);
}

export interface AccountKeys {
  /** Sent to the server in place of the password. */
  authVerifier: string;
  /** Wraps the vault key. Never leaves the browser. */
  wrappingKey: CryptoKey;
}

/**
 * Turns the account password into two independent keys.
 *
 *   rootKey      = Argon2id(password, salt(email))
 *   authVerifier = HKDF(rootKey, "vaultory|auth|v1")   -> server
 *   wrappingKey  = HKDF(rootKey, "vaultory|wrap|v1")   -> stays local
 *
 * Both are derived with separate HKDF info strings, so the verifier the server
 * stores cannot be turned back into the wrapping key.
 */
export async function deriveAccountKeys(
  password: string,
  email: string,
  kdf: KdfParams,
  onProgress?: (progress: number) => void,
): Promise<AccountKeys> {
  if (kdf.algorithm !== 'argon2id') {
    throw new Error(`Unsupported key derivation algorithm: ${kdf.algorithm as string}`);
  }

  const salt = kdfSalt(email);
  const rootKey = await argon2idAsync(utf8ToBytes(password), salt, {
    m: kdf.memoryKiB,
    t: kdf.iterations,
    p: kdf.parallelism,
    dkLen: 32,
    // Yield to the event loop so the UI can keep painting while deriving.
    asyncTick: 20,
    ...(onProgress ? { onProgress } : {}),
  });

  const verifierBytes = await hkdf(rootKey, 'vaultory|auth|v1');
  const wrapBytes = await hkdf(rootKey, 'vaultory|wrap|v1');
  wipe(rootKey);

  const wrappingKey = await crypto.subtle.importKey('raw', wrapBytes as BufferSource, 'AES-GCM', false, [
    'wrapKey',
    'unwrapKey',
    'encrypt',
    'decrypt',
  ]);
  wipe(wrapBytes);

  const authVerifier = bytesToBase64Url(verifierBytes);
  wipe(verifierBytes);

  return { authVerifier, wrappingKey };
}
