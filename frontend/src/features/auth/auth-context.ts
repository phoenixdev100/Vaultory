import { createContext, use } from 'react';
import type { UserDto } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** Called after signup/login once the server has issued a session. */
  setSession: (user: UserDto, csrfToken: string, sessionToken?: string) => void;
  /** Replaces the cached user after a profile or password change. */
  updateUser: (user: UserDto) => void;
  refresh: () => Promise<void>;
  /** Drops client-side auth state. Does not call the API. */
  clearSession: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Narrowed accessor for screens that are already behind the auth guard. */
export function useCurrentUser(): UserDto {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser must be used inside an authenticated route');
  return user;
}
