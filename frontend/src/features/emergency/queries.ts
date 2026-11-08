import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { bytesToBase64, base64ToBytes, wipe } from '@/lib/crypto/encoding';
import { decryptShare, encryptForRecipient, unwrapSharePrivateKey } from '@/lib/crypto/share';
import { useAuth } from '@/features/auth/auth-context';
import { useVault } from '@/features/vault/vault-context';
import type { ShareLookupResponse } from '@/types/api';

export interface EmergencyGrantDto {
  id: string;
  status: 'PENDING' | 'WAITING' | 'APPROVED' | 'CANCELLED';
  waitDays: number;
  requestedAt: string | null;
  waitUntil: string | null;
  approvedAt: string | null;
  createdAt: string;
  peer: { email: string; name: string | null } | null;
  handover?: { senderPublicKey: string | null; nonce: string | null; ciphertext: string | null } | null;
}

interface EmergencyListResponse {
  asGrantor: EmergencyGrantDto[];
  asGrantee: EmergencyGrantDto[];
}

export interface EmergencySecretDto {
  id: string;
  title: string;
  category: string;
  encVersion: 1;
  keyVersion: number;
  nonce: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
}

interface EmergencyVaultResponse {
  secrets: EmergencySecretDto[];
  attachments: unknown[];
}

export function useEmergencyGrants() {
  return useQuery({
    queryKey: ['emergency'],
    queryFn: () => api.get<EmergencyListResponse>('/emergency'),
    refetchInterval: 30_000,
  });
}

/**
 * Creates a grant: the vault key is exported in memory, ECDH-wrapped to the
 * contact's share key, and only that ciphertext is posted.
 */
export function useAddEmergencyContact() {
  const queryClient = useQueryClient();
  const { getKey } = useVault();

  return useMutation({
    mutationFn: async ({ email, waitDays }: { email: string; waitDays: number }) => {
      const recipient = await api.get<ShareLookupResponse>(
        `/shares/lookup?email=${encodeURIComponent(email)}`,
      );
      const raw = new Uint8Array(await crypto.subtle.exportKey('raw', getKey()));
      let envelope;
      try {
        envelope = await encryptForRecipient(recipient.sharePublicKey, { vaultKey: bytesToBase64(raw) });
      } finally {
        wipe(raw);
      }
      return api.post<{ id: string }>('/emergency', {
        granteeEmail: email,
        waitDays,
        handoverSenderPublicKey: envelope.senderPublicKey,
        handoverNonce: envelope.nonce,
        handoverCiphertext: envelope.ciphertext,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['emergency'] }),
  });
}

function useEmergencyAction(path: (id: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(path(id), {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['emergency'] }),
  });
}

export const useRequestEmergencyAccess = () => useEmergencyAction((id) => `/emergency/${id}/request`);
export const useApproveEmergency = () => useEmergencyAction((id) => `/emergency/${id}/approve`);
export const useCancelEmergency = () => useEmergencyAction((id) => `/emergency/${id}/cancel`);

/**
 * Claims the released handover: unwraps our share private key, decrypts the
 * ECDH envelope, and re-imports the grantor's vault key in memory.
 */
export function useClaimEmergencyAccess() {
  const { user } = useAuth();
  const { getKey } = useVault();

  return useMutation({
    mutationFn: async (grantId: string): Promise<{ grantId: string; vaultKey: CryptoKey }> => {
      if (!user?.sharePrivateKeyWrapped) throw new Error('Your share key is not available yet.');
      const released = await api.post<{ senderPublicKey: string; nonce: string; ciphertext: string }>(
        `/emergency/${grantId}/access`,
        {},
      );
      const privateKey = await unwrapSharePrivateKey(user.sharePrivateKeyWrapped, getKey());
      const { vaultKey } = await decryptShare<{ vaultKey: string }>(privateKey, released);
      const raw = base64ToBytes(vaultKey);
      const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
        'decrypt',
      ]);
      wipe(raw);
      return { grantId, vaultKey: key };
    },
  });
}

/** Read-only vault listing for an APPROVED grant - ciphertext rows only. */
export function useEmergencyVault(grantId: string | null) {
  return useQuery({
    queryKey: ['emergency-vault', grantId],
    queryFn: () => api.get<EmergencyVaultResponse>(`/emergency/${grantId}/vault`),
    enabled: grantId !== null,
  });
}
