import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './encoding';
import { DEFAULT_KDF, deriveAccountKeys, type KdfParams } from './kdf';
import {
  createVaultKey,
  DecryptionError,
  decryptFileBytes,
  decryptPayload,
  encryptFileBytes,
  encryptPayload,
  unwrapVaultKey,
  wrapVaultKey,
} from './vault';

/** Cheap parameters keep the suite fast; one test exercises the real defaults. */
const FAST_KDF: KdfParams = { algorithm: 'argon2id', memoryKiB: 1024, iterations: 1, parallelism: 1 };

const PASSWORD = 'correct horse battery staple 42';
const EMAIL = 'dana@example.com';

describe('key derivation', () => {
  it('derives a deterministic verifier for the same password and email', async () => {
    const a = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const b = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    expect(a.authVerifier).toBe(b.authVerifier);
  });

  it('normalises the email so casing and padding do not change the keys', async () => {
    const a = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const b = await deriveAccountKeys(PASSWORD, '  Dana@Example.COM ', FAST_KDF);
    expect(a.authVerifier).toBe(b.authVerifier);
  });

  it('produces a different verifier for a different password', async () => {
    const a = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const b = await deriveAccountKeys(`${PASSWORD}!`, EMAIL, FAST_KDF);
    expect(a.authVerifier).not.toBe(b.authVerifier);
  });

  it('salts per account, so the same password on two accounts differs', async () => {
    const a = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const b = await deriveAccountKeys(PASSWORD, 'someone.else@example.com', FAST_KDF);
    expect(a.authVerifier).not.toBe(b.authVerifier);
  });

  it('emits a 32-byte base64url verifier that does not contain the password', async () => {
    const { authVerifier } = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    expect(authVerifier).toHaveLength(43);
    expect(authVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authVerifier.toLowerCase()).not.toContain('horse');
  });

  it('keeps the wrapping key non-extractable', async () => {
    const { wrappingKey } = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    expect(wrappingKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', wrappingKey)).rejects.toThrow();
  });

  it('works with the production KDF parameters', async () => {
    const keys = await deriveAccountKeys(PASSWORD, EMAIL, DEFAULT_KDF);
    expect(keys.authVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  }, 30_000);

  it('rejects unknown algorithms instead of silently downgrading', async () => {
    await expect(
      deriveAccountKeys(PASSWORD, EMAIL, { ...FAST_KDF, algorithm: 'pbkdf2' as 'argon2id' }),
    ).rejects.toThrow(/Unsupported key derivation/);
  });
});

describe('vault key wrapping', () => {
  it('round-trips the vault key through the password-derived key', async () => {
    const { wrappingKey } = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const vaultKey = await createVaultKey();
    const wrapped = await wrapVaultKey(vaultKey, wrappingKey);

    expect(wrapped).toMatch(/^v1\.[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/=]+$/);

    const unwrapped = await unwrapVaultKey(wrapped, wrappingKey);
    const payload = await encryptPayload(vaultKey, { token: 'hunter2' });
    await expect(decryptPayload(unwrapped, payload)).resolves.toEqual({ token: 'hunter2' });
  });

  it('fails to unwrap with the wrong password', async () => {
    const right = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const wrong = await deriveAccountKeys('not-the-password', EMAIL, FAST_KDF);

    const wrapped = await wrapVaultKey(await createVaultKey(), right.wrappingKey);
    await expect(unwrapVaultKey(wrapped, wrong.wrappingKey)).rejects.toThrow(DecryptionError);
  });

  it('rejects a tampered wrapped key', async () => {
    const { wrappingKey } = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const wrapped = await wrapVaultKey(await createVaultKey(), wrappingKey);

    const [, nonce, ciphertext] = wrapped.split('.');
    const bytes = base64ToBytes(ciphertext ?? '');
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;

    await expect(unwrapVaultKey(`v1.${nonce}.${bytesToBase64(bytes)}`, wrappingKey)).rejects.toThrow(
      DecryptionError,
    );
  });

  it('rejects an unsupported wrapped key format', async () => {
    const { wrappingKey } = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    await expect(unwrapVaultKey('v2.AAAA.BBBB', wrappingKey)).rejects.toThrow(/Unsupported wrapped key format/);
  });

  it('survives a password change: the same vault key is re-wrapped', async () => {
    const oldKeys = await deriveAccountKeys(PASSWORD, EMAIL, FAST_KDF);
    const vaultKey = await createVaultKey();
    const payload = await encryptPayload(vaultKey, { password: 's3cret' });

    const wrappedOld = await wrapVaultKey(vaultKey, oldKeys.wrappingKey);

    // Change password: unwrap with the old key, re-wrap with the new one.
    const newKeys = await deriveAccountKeys('a-brand-new-password', EMAIL, FAST_KDF);
    const unwrapped = await unwrapVaultKey(wrappedOld, oldKeys.wrappingKey);
    const wrappedNew = await wrapVaultKey(unwrapped, newKeys.wrappingKey);

    const afterChange = await unwrapVaultKey(wrappedNew, newKeys.wrappingKey);
    await expect(decryptPayload(afterChange, payload)).resolves.toEqual({ password: 's3cret' });

    // The old password no longer opens the vault.
    await expect(unwrapVaultKey(wrappedNew, oldKeys.wrappingKey)).rejects.toThrow(DecryptionError);
  });

  it('cannot decrypt old data after a reset-style key rotation', async () => {
    const vaultKey = await createVaultKey();
    const payload = await encryptPayload(vaultKey, { password: 'old-vault' });

    const rotated = await createVaultKey();
    await expect(decryptPayload(rotated, payload)).rejects.toThrow(DecryptionError);
  });
});

describe('payload encryption', () => {
  it('round-trips structured secret payloads', async () => {
    const vaultKey = await createVaultKey();
    const value = {
      v: 1,
      fields: { username: 'dana', password: 'p@ssw0rd', url: 'https://github.com' },
      notes: 'line one\nline two',
    };

    const encrypted = await encryptPayload(vaultKey, value);
    expect(encrypted.encVersion).toBe(1);
    await expect(decryptPayload(vaultKey, encrypted)).resolves.toEqual(value);
  });

  it('never stores the plaintext inside the ciphertext', async () => {
    const vaultKey = await createVaultKey();
    const encrypted = await encryptPayload(vaultKey, { token: 'ghp_SUPERSECRETVALUE' });

    const decoded = new TextDecoder().decode(base64ToBytes(encrypted.ciphertext));
    expect(decoded).not.toContain('ghp_SUPERSECRETVALUE');
    expect(encrypted.ciphertext).not.toContain('ghp_SUPERSECRETVALUE');
  });

  it('uses a fresh 96-bit nonce for every write', async () => {
    const vaultKey = await createVaultKey();
    const nonces = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      const encrypted = await encryptPayload(vaultKey, { i });
      expect(base64ToBytes(encrypted.nonce)).toHaveLength(12);
      nonces.add(encrypted.nonce);
    }

    expect(nonces.size).toBe(200);
  });

  it('produces different ciphertext for identical plaintext', async () => {
    const vaultKey = await createVaultKey();
    const a = await encryptPayload(vaultKey, { same: 'value' });
    const b = await encryptPayload(vaultKey, { same: 'value' });
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects tampered ciphertext instead of returning garbage', async () => {
    const vaultKey = await createVaultKey();
    const encrypted = await encryptPayload(vaultKey, { password: 'do-not-change-me' });

    const bytes = base64ToBytes(encrypted.ciphertext);
    bytes[2] = (bytes[2] ?? 0) ^ 0x01;

    await expect(decryptPayload(vaultKey, { ...encrypted, ciphertext: bytesToBase64(bytes) })).rejects.toThrow(
      DecryptionError,
    );
  });

  it('rejects a swapped nonce', async () => {
    const vaultKey = await createVaultKey();
    const a = await encryptPayload(vaultKey, { password: 'first' });
    const b = await encryptPayload(vaultKey, { password: 'second' });

    await expect(decryptPayload(vaultKey, { ...a, nonce: b.nonce })).rejects.toThrow(DecryptionError);
  });

  it('rejects a truncated tag', async () => {
    const vaultKey = await createVaultKey();
    const encrypted = await encryptPayload(vaultKey, { password: 'full-value' });
    const bytes = base64ToBytes(encrypted.ciphertext).slice(0, -4);

    await expect(decryptPayload(vaultKey, { ...encrypted, ciphertext: bytesToBase64(bytes) })).rejects.toThrow(
      DecryptionError,
    );
  });

  it('refuses unknown payload versions', async () => {
    const vaultKey = await createVaultKey();
    const encrypted = await encryptPayload(vaultKey, { a: 1 });

    await expect(
      decryptPayload(vaultKey, { ...encrypted, encVersion: 2 as unknown as 1 }),
    ).rejects.toThrow(/Unsupported encrypted payload version/);
  });
});

describe('attachment encryption', () => {
  it('round-trips raw file bytes', async () => {
    const vaultKey = await createVaultKey();
    const content = new TextEncoder().encode('DATABASE_URL=postgres://u:p@host/db\nJWT_SECRET=abc123\n');

    const encrypted = await encryptFileBytes(vaultKey, content);
    const decrypted = await decryptFileBytes(vaultKey, encrypted);

    expect(new TextDecoder().decode(decrypted)).toBe(new TextDecoder().decode(content));
  });

  it('handles binary content byte-for-byte', async () => {
    const vaultKey = await createVaultKey();
    const binary = new Uint8Array(4096);
    for (let i = 0; i < binary.length; i += 1) binary[i] = i % 256;

    const encrypted = await encryptFileBytes(vaultKey, binary);
    const decrypted = await decryptFileBytes(vaultKey, encrypted);

    expect(decrypted).toEqual(binary);
  });

  it('attachment blobs cannot be replayed as secret payloads (AAD separation)', async () => {
    const vaultKey = await createVaultKey();
    const fileBlob = await encryptFileBytes(vaultKey, new TextEncoder().encode('{"v":1,"fields":{}}'));

    await expect(decryptPayload(vaultKey, fileBlob)).rejects.toThrow(DecryptionError);

    const payload = await encryptPayload(vaultKey, { token: 'x' });
    await expect(decryptFileBytes(vaultKey, payload)).rejects.toThrow(DecryptionError);
  });

  it('never embeds the plaintext in the ciphertext', async () => {
    const vaultKey = await createVaultKey();
    const marker = 'BEGIN SUPER PRIVATE KEY MARKER';
    const encrypted = await encryptFileBytes(vaultKey, new TextEncoder().encode(marker));

    expect(encrypted.ciphertext).not.toContain(marker);
    expect(new TextDecoder().decode(base64ToBytes(encrypted.ciphertext))).not.toContain(marker);
  });

  it('rejects a tampered ciphertext', async () => {
    const vaultKey = await createVaultKey();
    const encrypted = await encryptFileBytes(vaultKey, new TextEncoder().encode('secret-file'));

    const bytes = base64ToBytes(encrypted.ciphertext);
    bytes[0] = (bytes[0] ?? 0) ^ 0x01;

    await expect(decryptFileBytes(vaultKey, { ...encrypted, ciphertext: bytesToBase64(bytes) })).rejects.toThrow(
      DecryptionError,
    );
  });
});
