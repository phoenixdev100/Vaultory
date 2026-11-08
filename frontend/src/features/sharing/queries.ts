import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { decryptShare, encryptForRecipient, unwrapSharePrivateKey } from '@/lib/crypto/share';
import { useAuth } from '@/features/auth/auth-context';
import { useCreateSecret } from '@/features/vault/queries';
import { useVault } from '@/features/vault/vault-context';
import type { ShareDto, ShareListResponse, ShareLookupResponse, SecretPayload } from '@/types/api';

export function useShares() {
  return useQuery({
    queryKey: ['shares'],
    queryFn: () => api.get<ShareListResponse>('/shares'),
    refetchInterval: 30_000,
  });
}

export function useLookupRecipient() {
  return useMutation({
    mutationFn: (email: string) =>
      api.get<ShareLookupResponse>(`/shares/lookup?email=${encodeURIComponent(email)}`),
  });
}

interface SendShareInput {
  recipientEmail: string;
  title: string;
  category: string;
  payload: SecretPayload;
  expiresInDays?: number;
}

export function useSendShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendShareInput) => {
      const recipient = await api.get<ShareLookupResponse>(
        `/shares/lookup?email=${encodeURIComponent(input.recipientEmail)}`,
      );
      const envelope = await encryptForRecipient(recipient.sharePublicKey, input.payload);
      return api.post<{ id: string }>('/shares', {
        recipientEmail: input.recipientEmail,
        title: input.title,
        category: input.category,
        expiresInDays: input.expiresInDays,
        ...envelope,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shares'] }),
  });
}

/**
 * Accept: decrypt the share with our wrapped share key, save it as a normal
 * secret in our own vault, then mark it accepted. If saving fails the share
 * stays PENDING so nothing is lost.
 */
export function useAcceptShare() {
  const { user } = useAuth();
  const createSecret = useCreateSecret();
  const queryClient = useQueryClient();
  const { getKey } = useVault();

  return useMutation({
    mutationFn: async (share: ShareDto) => {
      if (!user?.sharePrivateKeyWrapped) throw new Error('Your share key is not available yet.');
      const privateKey = await unwrapSharePrivateKey(user.sharePrivateKeyWrapped, getKey());
      const payload = await decryptShare<SecretPayload>(privateKey, share);
      await createSecret.mutateAsync({ title: share.title, category: share.category, payload });
      return api.post(`/shares/${share.id}/accept`, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shares'] });
    },
  });
}

export function useDeclineShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/shares/${id}/decline`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shares'] }),
  });
}

export function useRevokeShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/shares/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shares'] }),
  });
}
