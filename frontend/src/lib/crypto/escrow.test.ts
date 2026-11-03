import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, utf8ToBytes } from './encoding';
import { createResetExchange, escrowVaultKeyForServer } from './escrow';
import { createVaultKey, decryptPayload, encryptPayload } from './vault';

/**
 * The server side is simulated with WebCrypto (Node ships the same subtle API)
 * so the test exercises the exact wire format: ECDH(P-256) shared secret used
 * directly as an AES-256-GCM key, AAD = "vaultory|escrow|v1".
 */
const AAD_ESCROW = utf8ToBytes('vaultory|escrow|v1');

async function makeServer() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
  ]);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { pair, rawPub };
}

async function importRawEcdh(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

async function sharedKey(priv: CryptoKey, pub: CryptoKey, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    priv,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

/** What the server does at reset-prepare: open the escrow, re-encrypt to the client. */
async function serverUnwrapEscrow(blob: string, serverPriv: CryptoKey): Promise<Uint8Array> {
  const [, ephPubB64, nonceB64, ctB64] = blob.split('.');
  const ephPub = await importRawEcdh(base64ToBytes(ephPubB64 ?? ''));
  const shared = await sharedKey(serverPriv, ephPub, ['decrypt']);
  const pt = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(nonceB64 ?? '') as BufferSource,
      additionalData: AAD_ESCROW as BufferSource,
    },
    shared,
    base64ToBytes(ctB64 ?? '') as BufferSource,
  );
  return new Uint8Array(pt);
}

/** What the server sends back: "s1.<nonce>.<ct>" for the client's ephemeral key. */
async function serverEncryptForClient(
  vaultKeyRaw: Uint8Array,
  clientPubB64: string,
  serverPriv: CryptoKey,
): Promise<string> {
  const clientPub = await importRawEcdh(base64ToBytes(clientPubB64));
  const shared = await sharedKey(serverPriv, clientPub, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: AAD_ESCROW as BufferSource },
    shared,
    vaultKeyRaw as BufferSource,
  );
  return `s1.${bytesToBase64(nonce)}.${bytesToBase64(new Uint8Array(ct))}`;
}

describe('vault key escrow', () => {
  it('round-trips the vault key through the server escrow format', async () => {
    const server = await makeServer();
    const serverPub = await importRawEcdh(server.rawPub);

    const vaultKey = await createVaultKey();
    const originalRaw = new Uint8Array(await crypto.subtle.exportKey('raw', vaultKey));

    // Signup direction: client -> server.
    const blob = await escrowVaultKeyForServer(vaultKey, serverPub);
    expect(blob.startsWith('s1.')).toBe(true);
    const recoveredRaw = await serverUnwrapEscrow(blob, server.pair.privateKey);
    expect(bytesToBase64(recoveredRaw)).toBe(bytesToBase64(originalRaw));

    // Reset direction: server -> client's ephemeral key.
    const exchange = await createResetExchange(serverPub);
    const downlink = await serverEncryptForClient(recoveredRaw, exchange.clientPublicKey, server.pair.privateKey);
    const recoveredKey = await exchange.decryptVaultKey(downlink);

    // The recovered key decrypts payloads written before the "reset".
    const payload = await encryptPayload(vaultKey, { password: 'hunter2' });
    const decrypted = await decryptPayload<{ password: string }>(recoveredKey, payload);
    expect(decrypted.password).toBe('hunter2');
  });

  it('produces a fresh ephemeral key for every escrow blob', async () => {
    const server = await makeServer();
    const serverPub = await importRawEcdh(server.rawPub);
    const vaultKey = await createVaultKey();

    const a = await escrowVaultKeyForServer(vaultKey, serverPub);
    const b = await escrowVaultKeyForServer(vaultKey, serverPub);
    expect(a).not.toBe(b); // different ephemeral pubkey + nonce each time
  });
});
