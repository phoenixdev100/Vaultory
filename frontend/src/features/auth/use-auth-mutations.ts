import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth-context';
import { useVault } from '@/features/vault/vault-context';
import { api } from '@/lib/api';
import { DEFAULT_KDF, deriveAccountKeys, type KdfParams } from '@/lib/crypto/kdf';
import { createResetExchange, escrowVaultKeyForServer } from '@/lib/crypto/escrow';
import { createVaultKey, unwrapVaultKey, wrapVaultKey } from '@/lib/crypto/vault';
import { persistVaultKey } from '@/lib/crypto/key-store';
import type { AuthResponse, KdfParamsDto, LoginResponse, SessionDto, UserDto } from '@/types/api';

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Sign in.
 *
 * 1. ask the server which KDF parameters this account uses
 * 2. derive the auth verifier + wrapping key locally (the password never leaves)
 * 3. exchange the verifier for a session
 * 4. unwrap the vault key in the browser
 */
/**
 * The password half of sign-in. When the account has TOTP 2FA enabled the
 * server answers with an MFA challenge instead of a session; the wrapping key
 * is carried forward so the code step can finish the unlock.
 */
export function useLogin() {
  const { setSession } = useAuth();
  const { adoptKey } = useVault();

  return useMutation({
    mutationFn: async ({ email, password }: Credentials) => {
      const { kdf } = await api.post<{ kdf: KdfParamsDto }>('/auth/prelogin', { email });
      const { authVerifier, wrappingKey } = await deriveAccountKeys(password, email, kdf as KdfParams);

      const response = await api.post<LoginResponse>('/auth/login', { email, authVerifier });
      if ('mfaRequired' in response) {
        return { mfa: true as const, mfaToken: response.mfaToken, wrappingKey };
      }

      const vaultKey = await unwrapVaultKey(response.user.wrappedVaultKey, wrappingKey);
      // Persist must complete before the mutation resolves, otherwise the vault
      // provider's restore probe won't find the key on navigation.
      if (response.user.id) {
        await persistVaultKey(response.user.id, vaultKey);
      }
      return { mfa: false as const, response, vaultKey };
    },
    onSuccess: (result) => {
      if (result.mfa) return;
      setSession(result.response.user, result.response.csrfToken, result.response.sessionToken);
      adoptKey(result.vaultKey);
    },
  });
}

/** Second login step: the 6-digit authenticator code. */
export function useLoginMfa() {
  const { setSession } = useAuth();
  const { adoptKey } = useVault();

  return useMutation({
    mutationFn: async ({
      mfaToken,
      code,
      wrappingKey,
    }: {
      mfaToken: string;
      code: string;
      wrappingKey: CryptoKey;
    }) => {
      const response = await api.post<AuthResponse>('/auth/login/mfa', { mfaToken, code });
      const vaultKey = await unwrapVaultKey(response.user.wrappedVaultKey, wrappingKey);
      if (response.user.id) {
        await persistVaultKey(response.user.id, vaultKey);
      }
      return { response, vaultKey };
    },
    onSuccess: ({ response, vaultKey }) => {
      setSession(response.user, response.csrfToken, response.sessionToken);
      adoptKey(vaultKey);
    },
  });
}

export function useSignup() {
  const { setSession } = useAuth();
  const { adoptKey } = useVault();

  return useMutation({
    mutationFn: async ({ email, password, name, website }: Credentials & { name?: string; website?: string }) => {
      const { authVerifier, wrappingKey } = await deriveAccountKeys(password, email, DEFAULT_KDF);

      // A fresh random vault key, wrapped with the password-derived key, plus
      // an escrow copy encrypted to the server key so a password reset can
      // recover it instead of orphaning the vault.
      const vaultKey = await createVaultKey();
      const wrappedVaultKey = await wrapVaultKey(vaultKey, wrappingKey);
      const serverWrappedVaultKey = await escrowVaultKeyForServer(vaultKey);

      const response = await api.post<AuthResponse>('/auth/signup', {
        email,
        ...(name ? { name } : {}),
        authVerifier,
        kdf: DEFAULT_KDF,
        wrappedVaultKey,
        serverWrappedVaultKey,
        ...(website ? { website } : {}),
      });

      if (response.user.id) {
        await persistVaultKey(response.user.id, vaultKey);
      }
      return { response, vaultKey };
    },
    onSuccess: ({ response, vaultKey }) => {
      setSession(response.user, response.csrfToken, response.sessionToken);
      adoptKey(vaultKey);
    },
  });
}

export function useLogout() {
  const { clearSession } = useAuth();
  const { lock } = useVault();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post<void>('/auth/logout');
    },
    // Even if the request fails, drop local state: the user asked to leave.
    onSettled: () => {
      lock('session');
      clearSession();
      queryClient.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api.post<{ message: string; transport: string; previewUrl?: string; delivered?: boolean }>(
        '/auth/forgot-password',
        { email },
      ),
  });
}

export function useResetTokenInfo(token: string | null) {
  return useQuery({
    queryKey: ['reset-token', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: () =>
      api.post<{ email: string; kdf: KdfParamsDto; vaultRecoverable: boolean }>('/auth/reset-token-info', {
        token,
      }),
  });
}

/**
 * Completing a reset tries to keep the existing vault key: the browser does a
 * short ECDH exchange with the server's escrow key, unwraps the key, and
 * re-wraps it to the new password - so every stored secret stays decryptable.
 * Accounts created before escrow existed rotate to a fresh key instead.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ token, email, password }: { token: string; email: string; password: string }) => {
      const exchange = await createResetExchange();
      const prepare = await api.post<{ recoverable: boolean; blob?: string }>('/auth/reset-prepare', {
        token,
        clientPublicKey: exchange.clientPublicKey,
      });

      let vaultKeyPreserved = false;
      let vaultKey: CryptoKey;
      if (prepare.recoverable && prepare.blob) {
        vaultKey = await exchange.decryptVaultKey(prepare.blob);
        vaultKeyPreserved = true;
      } else {
        vaultKey = await createVaultKey();
      }

      const { authVerifier, wrappingKey } = await deriveAccountKeys(password, email, DEFAULT_KDF);
      const wrappedVaultKey = await wrapVaultKey(vaultKey, wrappingKey);
      // Escrow whichever key protects the vault going forward.
      const serverWrappedVaultKey = await escrowVaultKeyForServer(vaultKey);

      return api.post<{ vaultKeyVersion: number; vaultKeyPreserved: boolean; strandedSecrets: number }>(
        '/auth/reset-password',
        {
          token,
          authVerifier,
          kdf: DEFAULT_KDF,
          wrappedVaultKey,
          serverWrappedVaultKey,
          vaultKeyPreserved,
          ...(vaultKeyPreserved ? {} : { acknowledgeVaultLoss: true }),
        },
      );
    },
  });
}

/** Changing the password re-wraps the *same* vault key, so nothing is lost. */
export function useChangePassword() {
  const { user, updateUser, refresh } = useAuth();
  const { getKey } = useVault();

  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
      revokeOtherSessions,
    }: {
      currentPassword: string;
      newPassword: string;
      revokeOtherSessions: boolean;
    }) => {
      if (!user) throw new Error('You are not signed in.');

      const current = await deriveAccountKeys(currentPassword, user.email, user.kdf as KdfParams);
      const next = await deriveAccountKeys(newPassword, user.email, DEFAULT_KDF);
      // Reuse the wrapping key we just derived - a second Argon2id pass here
      // would double the cost of the whole flow.
      const newWrappedVaultKey = await wrapVaultKey(getKey(), next.wrappingKey);

      const result = await api.post<{ revokedSessions: number }>('/auth/change-password', {
        currentAuthVerifier: current.authVerifier,
        newAuthVerifier: next.authVerifier,
        kdf: DEFAULT_KDF,
        newWrappedVaultKey,
        revokeOtherSessions,
      });

      return { ...result, newWrappedVaultKey };
    },
    onSuccess: ({ newWrappedVaultKey }) => {
      // Keep the cached user consistent with the new wrapped key.
      if (user) updateUser({ ...user, wrappedVaultKey: newWrappedVaultKey, kdf: DEFAULT_KDF });
      void refresh();
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => api.post<{ verified: boolean }>('/auth/verify-email', { token }),
  });
}

/** Sends (or resends) the verification email - link + 6-digit code. */
export function useResendVerification() {
  return useMutation({
    mutationFn: () =>
      api.post<{ required: boolean; delivered: boolean; previewUrl?: string; previewCode?: string }>(
        '/auth/resend-verification',
      ),
  });
}

/** The in-app half of verification: the code from the email, typed while signed in. */
export function useVerifyEmailCode() {
  const { refresh } = useAuth();

  return useMutation({
    mutationFn: (code: string) => api.post<{ verified: boolean }>('/auth/verify-email-code', { code }),
    onSuccess: () => void refresh(),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<{ items: SessionDto[] }>('/auth/sessions'),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ revoked: boolean; wasCurrentSession: boolean }>(`/auth/sessions/${id}`),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (!result.wasCurrentSession) toast.success('Session signed out');
    },
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<{ revoked: number }>('/auth/sessions/revoke-others'),
    onSuccess: ({ revoked }) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(revoked === 0 ? 'No other sessions were active' : `Signed out ${revoked} other session(s)`);
    },
  });
}

export function useDeleteAccount() {
  const { user, clearSession } = useAuth();
  const { lock } = useVault();

  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      if (!user) throw new Error('You are not signed in.');
      const { authVerifier } = await deriveAccountKeys(password, user.email, user.kdf as KdfParams);
      return api.delete<{ deleted: boolean }>('/account', {
        body: { authVerifier, confirm: 'DELETE MY VAULT' },
      });
    },
    onSuccess: () => {
      lock('session');
      clearSession();
    },
  });
}

// ---------------------------------------------------------------------------
// Account-level TOTP two-factor authentication
// ---------------------------------------------------------------------------

/** Starts enrolment: returns the secret + otpauth URI to show once. */
export function useTotpSetup() {
  return useMutation({
    mutationFn: () => api.post<{ secret: string; otpauthUrl: string }>('/auth/totp/setup'),
  });
}

/** Confirms enrolment with a live code from the authenticator app. */
export function useTotpConfirm() {
  const { refresh } = useAuth();

  return useMutation({
    mutationFn: (code: string) => api.post<{ enabled: boolean }>('/auth/totp/confirm', { code }),
    onSuccess: () => void refresh(),
  });
}

export function useTotpDisable() {
  const { refresh } = useAuth();

  return useMutation({
    mutationFn: (code: string) => api.post<{ enabled: boolean }>('/auth/totp/disable', { code }),
    onSuccess: () => void refresh(),
  });
}

export function useUpdateProfile() {
  const { updateUser } = useAuth();

  return useMutation({
    mutationFn: (body: { name?: string | null; autoLockMinutes?: number; theme?: string }) =>
      api.patch<{ user: UserDto }>('/settings', body),
    onSuccess: ({ user }) => updateUser(user),
  });
}
