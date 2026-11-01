import { api } from '@/lib/api';
import { base64ToBytes, bytesToBase64, randomBytes, utf8ToBytes, wipe } from './encoding';
import { DecryptionError, decryptPayload, encryptPayload } from './vault';

/**
 * Secure sharing between Vaultory users.
 *
 * Each account has an ECDH P-256 "share keypair". The public half is
 * published to the server; the private half is stored wrapped under the
 * vault key so the server can never decrypt shares. To share, the sender
 * generates a fresh ephemeral ECDH pair, derives
 * AES-256-GCM(ECDH(eph, recipientPub)) and encrypts the payload. The row
 * carries the ephemeral public point + ciphertext only - the server is a
 * dead drop, same trust model as secret rows.
 */

const AAD_SHARE = utf8ToBytes('vaultory|share|v1');
const NONCE_BYTES = 12;

interface WrappedShareKey {
  nonce: string;
  ciphertext: string;
}

export interface ShareEnvelope {
  senderPublicKey: string;
  nonce: string;
  ciphertext: string;
}

export async function generateShareKeypair(vaultKey: CryptoKey) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));

  const wrapped = await encryptPayload(vaultKey, { kind: 'share-pkcs8', pkcs8: bytesToBase64(pkcs8) });
  wipe(pkcs8);

  return {
    sharePublicKey: bytesToBase64(publicKey),
    sharePrivateKeyWrapped: { nonce: wrapped.nonce, ciphertext: wrapped.ciphertext } satisfies WrappedShareKey,
  };
}

/**
 * Publishes the user's share key on first use. Safe to call on every unlock -
 * it returns early when the account already has a key.
 */
export async function ensureShareKey(user: { sharePublicKey?: string | null }, vaultKey: CryptoKey) {
  if (user.sharePublicKey) return;
  const keys = await generateShareKeypair(vaultKey);
  await api.put('/account/share-key', keys);
  user.sharePublicKey = keys.sharePublicKey;
}

export async function unwrapSharePrivateKey(wrapped: WrappedShareKey, vaultKey: CryptoKey) {
  const data = await decryptPayload<{ kind?: string; pkcs8?: string }>(vaultKey, {
    encVersion: 1,
    ...wrapped,
  });
  if (data.kind !== 'share-pkcs8' || !data.pkcs8) {
    throw new DecryptionError('The stored share key is not usable.');
  }
  const pkcs8 = base64ToBytes(data.pkcs8);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8 as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey'],
  );
  wipe(pkcs8);
  return key;
}

function importPeerPublicKey(b64: string) {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(b64) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
}

async function deriveSharedKey(privateKey: CryptoKey, peerPublicKey: CryptoKey, usages: KeyUsage[]) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

/** Encrypts a secret payload (fields + notes) to the recipient's share key. */
export async function encryptForRecipient(recipientPublicKeyB64: string, payload: unknown): Promise<ShareEnvelope> {
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const shared = await deriveSharedKey(eph.privateKey, await importPeerPublicKey(recipientPublicKeyB64), ['encrypt']);

  const nonce = randomBytes(NONCE_BYTES);
  const plaintext = utf8ToBytes(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: AAD_SHARE as BufferSource },
    shared,
    plaintext as BufferSource,
  );
  wipe(plaintext);

  const senderPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  return {
    senderPublicKey: bytesToBase64(senderPublicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/** Decrypts an incoming share with the user's wrapped share private key. */
export async function decryptShare<T>(
  sharePrivateKey: CryptoKey,
  envelope: Pick<ShareEnvelope, 'senderPublicKey' | 'nonce' | 'ciphertext'>,
): Promise<T> {
  const shared = await deriveSharedKey(
    sharePrivateKey,
    await importPeerPublicKey(envelope.senderPublicKey),
    ['decrypt'],
  );
  let plaintext: Uint8Array;
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(envelope.nonce) as BufferSource,
        additionalData: AAD_SHARE as BufferSource,
      },
      shared,
      base64ToBytes(envelope.ciphertext) as BufferSource,
    );
    plaintext = new Uint8Array(decrypted);
  } catch {
    throw new DecryptionError('This share could not be decrypted.');
  }
  const json = JSON.parse(new TextDecoder().decode(plaintext)) as T;
  wipe(plaintext);
  return json;
}
