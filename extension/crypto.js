import { argon2idAsync } from './vendor/noble/argon2.js';
import { sha256 } from './vendor/noble/sha2.js';

/**
 * The same client-side crypto the web app runs - duplicated because an
 * extension page cannot import the frontend bundle. Keep in sync with
 * frontend/src/lib/crypto/{kdf,vault,encoding}.ts.
 */

const AAD_SECRET = new TextEncoder().encode('vaultory|secret|v1');
const AAD_WRAP = new TextEncoder().encode('vaultory|vault-key|v1');

const utf8 = new TextEncoder();
const b64 = {
  encode: (bytes) => btoa(String.fromCharCode(...bytes)),
  decode: (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
  encodeUrl: (bytes) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
};

function kdfSalt(email) {
  return sha256(utf8.encode(`vaultory|kdf|v1|${email.trim().toLowerCase()}`));
}

async function hkdf(rootKey, info, bytes = 32) {
  const ikm = await crypto.subtle.importKey('raw', rootKey, 'HKDF', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8.encode(info) },
    ikm,
    bytes * 8,
  );
  return new Uint8Array(derived);
}

/** password → {authVerifier (sent to API), wrappingKey (unwraps vault key)} */
export async function deriveAccountKeys(password, email, kdf, onProgress) {
  const rootKey = await argon2idAsync(utf8.encode(password), kdfSalt(email), {
    m: kdf.memoryKiB,
    t: kdf.iterations,
    p: kdf.parallelism,
    dkLen: 32,
    asyncTick: 20,
    ...(onProgress ? { onProgress } : {}),
  });

  const verifierBytes = await hkdf(rootKey, 'vaultory|auth|v1');
  const wrapBytes = await hkdf(rootKey, 'vaultory|wrap|v1');
  rootKey.fill(0);

  const wrappingKey = await crypto.subtle.importKey('raw', wrapBytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  wrapBytes.fill(0);
  const authVerifier = b64.encodeUrl(verifierBytes);
  verifierBytes.fill(0);
  return { authVerifier, wrappingKey };
}

/** `v1.<b64 nonce>.<b64 ct>` → vault CryptoKey (wrap AAD). */
export async function unwrapVaultKey(wrapped, wrappingKey) {
  const parts = wrapped.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Unrecognised wrapped key format.');
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64.decode(parts[1]), additionalData: AAD_WRAP },
    wrappingKey,
    b64.decode(parts[2]),
  );
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

/** Secret row {nonce, ciphertext} → parsed payload object. */
export async function decryptPayload(vaultKey, row) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64.decode(row.nonce), additionalData: AAD_SECRET },
    vaultKey,
    b64.decode(row.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/** Encrypts a new secret payload for capture-save (fields + notes). */
export async function encryptPayload(vaultKey, value) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: AAD_SECRET },
    vaultKey,
    plaintext,
  );
  return { nonce: b64.encode(nonce), ciphertext: b64.encode(new Uint8Array(ciphertext)), encVersion: 1 };
}
