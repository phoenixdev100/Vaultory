import { api } from '@/lib/api';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToBase64Url,
  randomBytes,
  utf8ToBytes,
  wipe,
} from './encoding';
import { DecryptionError } from './vault';

/**
 * Passkey vault unlock via the WebAuthn PRF extension.
 *
 * A platform authenticator (Windows Hello, Touch ID, Android biometrics)
 * derives a deterministic 32-byte secret for (credential, salt). That secret
 * becomes an AES-256-GCM key that wraps the vault key; only the wrapped blob
 * + salt go to the server. Unlock needs a live user-verifying assertion, so
 * the wrapped copy is useless to anyone who steals the database row.
 *
 * This is a *convenience unlock* - sessions still come from password login.
 * PRF support: Chrome/Edge 118+, Safari 18+; not Firefox (enroll is hidden).
 */

const AAD = 'vaultory|passkey|v1';
const RP_NAME = 'Vaultory';

/** base64url → bytes (credential ids travel base64url-encoded). */
function base64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(b64);
}

interface PrfExtensionResults {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
}

export function passkeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    window.isSecureContext
  );
}

export interface PasskeyDto {
  id: string;
  credentialId: string;
  name: string | null;
  prfSalt: string;
  wrappedVaultKey: { nonce: string; ciphertext: string };
  createdAt: string;
}

async function prfKey(prfOutput: ArrayBuffer | Uint8Array, usages: KeyUsage[]) {
  const bytes = new Uint8Array(prfOutput);
  if (bytes.length < 32) throw new Error('The authenticator did not return a usable PRF secret.');
  return crypto.subtle.importKey('raw', bytes.subarray(0, 32) as BufferSource, 'AES-GCM', false, usages);
}

/** Creates a platform passkey and returns the row to POST to the backend. */
export async function enrollPasskey(
  vaultKey: CryptoKey,
  user: { id: string; email: string; name: string | null },
  deviceName?: string,
): Promise<Omit<PasskeyDto, 'id' | 'createdAt'>> {
  const salt = randomBytes(32);
  const userHandle = new Uint8Array(16);
  crypto.getRandomValues(userHandle);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32) as BufferSource,
      rp: { name: RP_NAME },
      user: {
        id: userHandle as BufferSource,
        name: user.email,
        displayName: user.name ?? user.email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
      extensions: { prf: { eval: { first: salt as BufferSource } } },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey creation was cancelled.');

  const ext = credential.getClientExtensionResults() as PrfExtensionResults;
  const prfOutput = ext.prf?.results?.first ?? (ext.prf?.enabled ? undefined : null);
  if (!prfOutput) {
    throw new Error('This authenticator does not support the PRF extension - try Chrome, Edge or Safari.');
  }

  const key = await prfKey(prfOutput, ['encrypt']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', vaultKey));
  const nonce = randomBytes(12);
  let wrapped;
  try {
    const aad = utf8ToBytes(AAD);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: aad as BufferSource },
      key,
      raw as BufferSource,
    );
    wrapped = { nonce: bytesToBase64(nonce), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
  } finally {
    wipe(raw);
  }

  return {
    credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    name: deviceName ?? null,
    prfSalt: bytesToBase64(salt),
    wrappedVaultKey: wrapped,
  };
}

/**
 * Asserts a passkey and unwraps the vault key. Throws DecryptionError when
 * the stored blob doesn't match (e.g. after a vault key rotation).
 */
export async function unlockWithPasskey(passkey: PasskeyDto): Promise<CryptoKey> {
  const salt = base64ToBytes(passkey.prfSalt);
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as BufferSource,
      allowCredentials: [
        { type: 'public-key', id: base64urlToBytes(passkey.credentialId) as BufferSource },
      ],
      userVerification: 'required',
      extensions: { prf: { eval: { first: salt as BufferSource } } },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey assertion was cancelled.');
  const ext = assertion.getClientExtensionResults() as PrfExtensionResults;
  const prfOutput = ext.prf?.results?.first;
  if (!prfOutput) throw new Error('The authenticator did not return a PRF secret.');

  const key = await prfKey(prfOutput, ['decrypt']);
  const aad = utf8ToBytes(AAD);
  let raw: Uint8Array;
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(passkey.wrappedVaultKey.nonce) as BufferSource,
        additionalData: aad as BufferSource,
      },
      key,
      base64ToBytes(passkey.wrappedVaultKey.ciphertext) as BufferSource,
    );
    raw = new Uint8Array(plaintext);
  } catch {
    throw new DecryptionError('This passkey can no longer unlock the vault - re-enroll it.');
  }
  const vaultKey = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', true, [
    'encrypt',
    'decrypt',
  ]);
  wipe(raw);
  return vaultKey;
}

export const passkeysApi = {
  list: () => api.get<{ passkeys: PasskeyDto[] }>('/account/passkeys'),
  enroll: (body: Omit<PasskeyDto, 'id' | 'createdAt'>) => api.post('/account/passkeys', body),
  remove: (id: string) => api.delete(`/account/passkeys/${id}`),
};
