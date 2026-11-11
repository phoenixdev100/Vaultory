import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/features/auth/auth-context';
import { api, getBearerToken, setActiveWorkspaceId, setBearerToken, setCsrfToken, UNAUTHORIZED_EVENT } from '@/lib/api';
import type { MeResponse, UserDto } from '@/types/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDto | null>(null);
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    setCsrfToken(null);
    setBearerToken(null);
    // Drop the workspace scope too - the next account's requests must never
    // carry a workspace id that belongs to the previous user.
    setActiveWorkspaceId(null);
    // Drop the whole query cache: on a shared browser the next sign-in must
    // not render the previous account's workspaces, secrets or activity.
    queryClient.clear();
    setUser(null);
    setStatus('anonymous');
  }, [queryClient]);

  const setSession = useCallback((nextUser: UserDto, csrfToken: string, sessionToken?: string) => {
    setCsrfToken(csrfToken);
    if (sessionToken) setBearerToken(sessionToken);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const refresh = useCallback(async () => {
    // Cross-site deployment: without a Bearer token in sessionStorage there is
    // no session to restore - skip the network round-trip and go anonymous
    // immediately so public pages never fire a guaranteed-401 /auth/me call.
    if (!getBearerToken()) {
      setStatus('anonymous');
      return;
    }
    try {
      const response = await api.get<MeResponse>('/auth/me', { silentUnauthorized: true });
      setCsrfToken(response.csrfToken);
      setUser(response.user);
      setStatus('authenticated');
    } catch {
      clearSession();
    }
  }, [clearSession]);

  // Boot: the session cookie is httpOnly, so the only way to know whether we
  // are signed in is to ask the API. refresh() sets state only after its
  // first await, so there is no synchronous state write inside the effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async boot fetch, not a render cascade
    void refresh();
  }, [refresh]);

  // Any 401 from anywhere in the app means the session is gone.
  useEffect(() => {
    const onUnauthorized = () => clearSession();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, setSession, updateUser: setUser, refresh, clearSession }),
    [status, user, setSession, refresh, clearSession],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
