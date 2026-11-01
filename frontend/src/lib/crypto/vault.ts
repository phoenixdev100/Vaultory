import { base64ToBytes, bytesToBase64, bytesToUtf8, randomBytes, utf8ToBytes, wipe } from './encoding';

/** AES-GCM nonce length in bytes (96 bits - the only size NIST recommends for GCM). */
const NONCE_BYTES = 12;

/** Encrypted-data format version stored alongside every ciphertext. */
export const ENC_VERSION = 1 as const;

/**
 * Context separation. Additional authenticated data binds a ciphertext to the
 * purpose it was produced for, so a wrapped key blob can never be replayed as
 * a secret payload (or vice versa).
 */
const AAD_VAULT_KEY = utf8ToBytes('vaultory|vault-key|v1');
const AAD_SECRET = utf8ToBytes('vaultory|secret|v1');
const AAD_ATTACHMENT = utf8ToBytes('vaultory|attachment|v1');

export interface EncryptedPayload {
  encVersion: typeof ENC_VERSION;
  /** base64, 12 random bytes, generated fresh for every single write. */
  nonce: string;
  /** base64 AES-256-GCM ciphertext with the 16-byte tag appended. */
  ciphertext: string;
}

export class DecryptionError extends Error {
  constructor(message = 'The data could not be decrypted with this key.') {
    super(message);
    this.name = 'DecryptionError';
  }
}

/** Fresh 256-bit vault data key. Created once, at signup. */
export async function createVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Wraps the vault key with the password-derived key.
 * Format: `v1.<base64 nonce>.<base64 ciphertext>` - opaque to the server.
 */
export async function wrapVaultKey(vaultKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', vaultKey));
  const nonce = randomBytes(NONCE_BYTES);

  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: AAD_VAULT_KEY as BufferSource },
    wrappingKey,
    raw as BufferSource,
  );
  wipe(raw);

  return `v1.${bytesToBase64(nonce)}.${bytesToBase64(new Uint8Array(wrapped))}`;
}

/**
 * Unwraps the vault key. A wrong password fails here, on the GCM
 * authentication tag - the server is not consulted and cannot be tricked into
 * accepting an incorrect password.
 */
export async function unwrapVaultKey(wrapped: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const parts = wrapped.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new DecryptionError('Unsupported wrapped key format.');
  }

  let raw: Uint8Array;
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(parts[1] ?? '') as BufferSource,
        additionalData: AAD_VAULT_KEY as BufferSource,
      },
      wrappingKey,
      base64ToBytes(parts[2] ?? '') as BufferSource,
    );
    raw = new Uint8Array(decrypted);
  } catch {
    throw new DecryptionError('Incorrect password.');
  }

  const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', true, ['encrypt', 'decrypt']);
  wipe(raw);
  return key;
}

/** Encrypts a secret's sensitive fields. Never reuses a nonce under one key. */
export async function encryptPayload(vaultKey: CryptoKey, value: unknown): Promise<EncryptedPayload> {
  const nonce = randomBytes(NONCE_BYTES);
  const plaintext = utf8ToBytes(JSON.stringify(value));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: AAD_SECRET as BufferSource },
    vaultKey,
    plaintext as BufferSource,
  );
  wipe(plaintext);

  return {
    encVersion: ENC_VERSION,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypts a secret payload. The GCM tag is verified by Web Crypto before any
 * plaintext is returned, so tampered ciphertext throws instead of yielding
 * attacker-chosen data.
 */
export async function decryptPayload<T>(vaultKey: CryptoKey, payload: EncryptedPayload): Promise<T> {
  if (payload.encVersion !== ENC_VERSION) {
    throw new DecryptionError(`Unsupported encrypted payload version: ${String(payload.encVersion)}`);
  }

  let plaintext: Uint8Array;
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(payload.nonce) as BufferSource,
        additionalData: AAD_SECRET as BufferSource,
      },
      vaultKey,
      base64ToBytes(payload.ciphertext) as BufferSource,
    );
    plaintext = new Uint8Array(decrypted);
  } catch {
    throw new DecryptionError();
  }

  const json = bytesToUtf8(plaintext);
  wipe(plaintext);
  return JSON.parse(json) as T;
}

/**
 * Encrypts a file attachment's raw bytes (.env, PEM/PPK keys, keystores…).
 * Separate AAD from secret payloads so an attachment blob can never be
 * substituted where a JSON payload is expected.
 */
export async function encryptFileBytes(vaultKey: CryptoKey, data: Uint8Array): Promise<EncryptedPayload> {
  const nonce = randomBytes(NONCE_BYTES);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: AAD_ATTACHMENT as BufferSource },
    vaultKey,
    data as BufferSource,
  );

  return {
    encVersion: ENC_VERSION,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/** Decrypts an attachment blob back to its raw file bytes. */
export async function decryptFileBytes(vaultKey: CryptoKey, payload: EncryptedPayload): Promise<Uint8Array> {
  if (payload.encVersion !== ENC_VERSION) {
    throw new DecryptionError(`Unsupported encrypted payload version: ${String(payload.encVersion)}`);
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(payload.nonce) as BufferSource,
        additionalData: AAD_ATTACHMENT as BufferSource,
      },
      vaultKey,
      base64ToBytes(payload.ciphertext) as BufferSource,
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new DecryptionError();
  }
}
