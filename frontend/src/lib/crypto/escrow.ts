import { api } from '@/lib/api';
import { base64ToBytes, bytesToBase64, randomBytes, utf8ToBytes, wipe } from './encoding';
import { DecryptionError } from './vault';

/**
 * Vault-key escrow.
 *
 * At signup the vault key is additionally encrypted to the server's public
 * key so that an email-verified password reset can hand it back - otherwise a
 * forgotten password would permanently orphan every stored secret.
 *
 * ECDH(P-256) shared secret is used directly as the AES-256-GCM key, matching
 * WebCrypto `deriveKey` bit-for-bit with the Node implementation server-side.
 * The raw vault key never travels the wire in either direction.
 */

const AAD_ESCROW = utf8ToBytes('vaultory|escrow|v1');
const NONCE_BYTES = 12;

let serverKeyRequest: Promise<CryptoKey> | null = null;

async function serverPublicKey(): Promise<CryptoKey> {
  serverKeyRequest ??= api
    .get<{ publicKey: string }>('/auth/server-key')
    .then(({ publicKey }) =>
      crypto.subtle.importKey(
        'raw',
        base64ToBytes(publicKey) as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      ),
    );
  return serverKeyRequest;
}

async function ephemeralPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
}

async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

/**
 * Encrypts the vault key to the server's escrow key.
 * Format: `s1.<base64 ephPub>.<base64 nonce>.<base64 ciphertext>`.
 */
export async function escrowVaultKeyForServer(vaultKey: CryptoKey, serverPub?: CryptoKey): Promise<string> {
  const server = serverPub ?? (await serverPublicKey());
  const eph = await ephemeralPair();
  const shared = await deriveSharedKey(eph.privateKey, server, ['encrypt']);

  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', vaultKey));
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: AAD_ESCROW as BufferSource },
    shared,
    raw as BufferSource,
  );
  wipe(raw);

  const ephPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  return `s1.${bytesToBase64(ephPub)}.${bytesToBase64(nonce)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export interface ResetExchange {
  /** base64 raw P-256 public point - sent to /auth/reset-prepare. */
  clientPublicKey: string;
  /** Decrypts `s1.<nonce>.<ct>` the server produced for this exchange. */
  decryptVaultKey: (blob: string) => Promise<CryptoKey>;
}

/** Fresh ephemeral keypair for the reset handshake. */
export async function createResetExchange(serverPub?: CryptoKey): Promise<ResetExchange> {
  const server = serverPub ?? (await serverPublicKey());
  const eph = await ephemeralPair();
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));

  return {
    clientPublicKey: bytesToBase64(rawPub),
    async decryptVaultKey(blob) {
      const parts = blob.split('.');
      if (parts.length !== 3 || parts[0] !== 's1') {
        throw new DecryptionError('Unsupported escrowed key format.');
      }
      const shared = await deriveSharedKey(eph.privateKey, server, ['decrypt']);
      let raw: Uint8Array;
      try {
        const plaintext = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: base64ToBytes(parts[1] ?? '') as BufferSource,
            additionalData: AAD_ESCROW as BufferSource,
          },
          shared,
          base64ToBytes(parts[2] ?? '') as BufferSource,
        );
        raw = new Uint8Array(plaintext);
      } catch {
        throw new DecryptionError('The escrowed vault key could not be decrypted.');
      }
      const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', true, ['encrypt', 'decrypt']);
      wipe(raw);
      return key;
    },
  };
}
