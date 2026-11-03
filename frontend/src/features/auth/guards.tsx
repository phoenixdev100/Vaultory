import { Loader2, MailWarning } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogoMark } from '@/components/layout/logo';
import { useAuth, useCurrentUser } from '@/features/auth/auth-context';
import { UnlockScreen } from '@/features/auth/unlock-screen';
import { VerifyEmailCard } from '@/features/auth/verify-email-card';
import { useVault } from '@/features/vault/vault-context';

function BootScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-canvas" role="status">
      <LogoMark className="size-10" />
      <span className="flex items-center gap-2 text-[13px] text-fg-muted">
        <Loader2 className="size-3.5 animate-spin" />
        Checking your session…
      </span>
    </div>
  );
}

/**
 * Client-side gate. It is a UX affordance only - every API route independently
 * authenticates the session cookie and checks row ownership server-side.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <BootScreen />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

/** Signed-in users never see the login/signup screens. */
export function PublicOnly() {
  const { status } = useAuth();

  if (status === 'loading') return <BootScreen />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/**
 * Being signed in is not the same as having an unlocked vault. The key is
 * persisted in IndexedDB while unlocked, so a reload restores it silently -
 * `restoring` covers that probe. Auto-lock, manual lock and logout clear it.
 */
export function RequireVault({ children }: { children?: ReactNode }) {
  const { locked, restoring } = useVault();

  if (restoring) return <BootScreen />;
  if (locked) return <UnlockScreen />;
  return <>{children ?? <Outlet />}</>;
}

/**
 * Features that touch vault or security data require a verified email. The
 * API enforces this with `requireVerifiedEmail` (403 email_not_verified); this
 * guard is the matching UX wall - an unverified user sees the verify panel
 * instead of a dead page. Settings stays reachable so the user can verify,
 * rename the account or delete it.
 */
export function RequireVerified({ children }: { children?: ReactNode }) {
  const user = useCurrentUser();

  if (!user.emailVerified) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-warning/40 bg-warning-soft px-4 py-3">
          <MailWarning className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="text-[13px] leading-5 text-fg">
            <p className="font-semibold">Your email address is not verified</p>
            <p className="text-fg-muted">
              Verify {user.email} to unlock the vault, folders, sharing and every other feature.
            </p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-lg">
          <VerifyEmailCard />
        </div>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
