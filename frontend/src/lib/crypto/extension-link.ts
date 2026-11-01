import { base64ToBytes, bytesToBase64, randomBytes, utf8ToBytes, wipe } from './encoding';

/**
 * Browser-extension pairing.
 *
 * The extension generates an ephemeral ECDH P-256 keypair and hands its
 * public half to /link-extension as a URL parameter. When the user confirms
 * pairing, this page wraps the raw vault key under
 * AES-256-GCM(ECDH(fresh web ephemeral, extension pub)) and the envelope
 * rides back inside the redirect fragment - it never crosses the API. The
 * extension holds the only private half, so only it can unwrap the key.
 */

const AAD_EXTENSION_LINK = utf8ToBytes('vaultory|extension-link|v1');
const NONCE_BYTES = 12;

export interface ExtensionKeyEnvelope {
  /** Ephemeral P-256 public point (raw, base64). */
  eph: string;
  nonce: string;
  /** AES-256-GCM over the raw 32-byte vault key. */
  ciphertext: string;
}

export async function wrapVaultKeyForExtension(
  vaultKey: CryptoKey,
  extensionPublicKeyB64: string,
): Promise<ExtensionKeyEnvelope> {
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', vaultKey));
  try {
    const peerPublic = await crypto.subtle.importKey(
      'raw',
      base64ToBytes(extensionPublicKeyB64) as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    const shared = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerPublic },
      eph.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const nonce = randomBytes(NONCE_BYTES);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: AAD_EXTENSION_LINK as BufferSource },
      shared,
      rawKey as BufferSource,
    );
    const ephPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
    return {
      eph: bytesToBase64(ephPub),
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  } finally {
    wipe(rawKey);
  }
}
