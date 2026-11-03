import { describe, expect, it } from 'vitest';
import {
  decryptShare,
  encryptForRecipient,
  generateShareKeypair,
  unwrapSharePrivateKey,
} from './share';
import { createVaultKey } from './vault';

/**
 * Round-trips the exact wire format the server relays: recipient publishes
 * an ECDH P-256 share key, the sender encrypts with an ephemeral pair, and
 * the recipient unwraps their private key (stored vault-wrapped) to decrypt.
 */
describe('secure sharing crypto', () => {
  it('encrypts a payload to the recipient share key and back', async () => {
    const vaultKey = await createVaultKey();
    const keys = await generateShareKeypair(vaultKey);

    // The share private key arrives wrapped; the recipient unwraps it with
    // their own vault key - the server never holds it raw.
    const privateKey = await unwrapSharePrivateKey(keys.sharePrivateKeyWrapped, vaultKey);

    const payload = { fields: { username: 'deploy@prod', password: 's3cret!' }, notes: 'rotate monthly' };
    const envelope = await encryptForRecipient(keys.sharePublicKey, payload);

    // Envelope contains only public material + ciphertext.
    expect(envelope.senderPublicKey).not.toBe(keys.sharePublicKey);
    expect(JSON.stringify(envelope)).not.toContain('s3cret');

    const decrypted = await decryptShare<typeof payload>(privateKey, envelope);
    expect(decrypted).toEqual(payload);
  });

  it('fails to decrypt with a different recipient key', async () => {
    const vaultKey = await createVaultKey();
    const recipient = await generateShareKeypair(vaultKey);
    const stranger = await generateShareKeypair(vaultKey);

    const envelope = await encryptForRecipient(recipient.sharePublicKey, { fields: { password: 'x' } });
    const wrongKey = await unwrapSharePrivateKey(stranger.sharePrivateKeyWrapped, vaultKey);

    await expect(decryptShare(wrongKey, envelope)).rejects.toThrow();
  });
});
