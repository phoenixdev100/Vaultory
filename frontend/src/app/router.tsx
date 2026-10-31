import { Loader2 } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PublicOnly, RequireAuth, RequireVault, RequireVerified } from '@/features/auth/guards';

// Public marketing + auth screens are split out of the app bundle.
const LandingPage = lazy(() => import('@/routes/landing'));
const LoginPage = lazy(() => import('@/routes/login'));
const SignupPage = lazy(() => import('@/routes/signup'));
const ForgotPasswordPage = lazy(() => import('@/routes/forgot-password'));
const ResetPasswordPage = lazy(() => import('@/routes/reset-password'));
const VerifyEmailPage = lazy(() => import('@/routes/verify-email'));

const DashboardPage = lazy(() => import('@/routes/dashboard'));
const VaultPage = lazy(() => import('@/routes/vault'));
const SecretNewPage = lazy(() => import('@/routes/secret-new'));
const SecretDetailPage = lazy(() => import('@/routes/secret-detail'));
const SecretEditPage = lazy(() => import('@/routes/secret-edit'));
const FoldersPage = lazy(() => import('@/routes/folders'));
const FavoritesPage = lazy(() => import('@/routes/favorites'));
const RecentPage = lazy(() => import('@/routes/recent'));
const ActivityPage = lazy(() => import('@/routes/activity'));
const AuditPage = lazy(() => import('@/routes/audit'));
const SharingPage = lazy(() => import('@/routes/sharing'));
const TrashPage = lazy(() => import('@/routes/trash'));
const SecurityPage = lazy(() => import('@/routes/security'));
const SettingsPage = lazy(() => import('@/routes/settings'));
const LinkExtensionPage = lazy(() => import('@/routes/link-extension'));
const NotFoundPage = lazy(() => import('@/routes/not-found'));

/**
 * Per-route Suspense: a lazy chunk that is still downloading only suspends the
 * page element itself, so the shell, guards and chrome stay mounted - no
 * full-screen blank flash while a route loads.
 */
function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="size-5 animate-spin text-fg-subtle" />
    </div>
  );
}

const lazyRoute = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>;

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={lazyRoute(<LandingPage />)} />

      <Route element={<PublicOnly />}>
        <Route path="/login" element={lazyRoute(<LoginPage />)} />
        <Route path="/signup" element={lazyRoute(<SignupPage />)} />
        <Route path="/forgot-password" element={lazyRoute(<ForgotPasswordPage />)} />
        <Route path="/reset-password" element={lazyRoute(<ResetPasswordPage />)} />
      </Route>

      <Route path="/verify-email" element={lazyRoute(<VerifyEmailPage />)} />

      {/* Signed in AND unlocked; a reload restores the key from IndexedDB. */}
      <Route element={<RequireAuth />}>
        {/* Extension pairing consent: focused screen, no app shell. */}
        <Route
          path="/link-extension"
          element={lazyRoute(
            <RequireVault>
              <LinkExtensionPage />
            </RequireVault>,
          )}
        />
        <Route
          element={
            <RequireVault>
              <AppShell />
            </RequireVault>
          }
        >
          {/* Vault + security features are walled until the email is verified. */}
          <Route element={<RequireVerified />}>
            <Route path="/dashboard" element={lazyRoute(<DashboardPage />)} />
            <Route path="/vault" element={lazyRoute(<VaultPage />)} />
            <Route path="/vault/new" element={lazyRoute(<SecretNewPage />)} />
            <Route path="/vault/:id" element={lazyRoute(<SecretDetailPage />)} />
            <Route path="/vault/:id/edit" element={lazyRoute(<SecretEditPage />)} />
            <Route path="/folders" element={lazyRoute(<FoldersPage />)} />
            <Route path="/favorites" element={lazyRoute(<FavoritesPage />)} />
            <Route path="/recent" element={lazyRoute(<RecentPage />)} />
            <Route path="/activity" element={lazyRoute(<ActivityPage />)} />
            <Route path="/audit" element={lazyRoute(<AuditPage />)} />
            <Route path="/sharing" element={lazyRoute(<SharingPage />)} />
            <Route path="/trash" element={lazyRoute(<TrashPage />)} />
            <Route path="/security" element={lazyRoute(<SecurityPage />)} />
          </Route>
          {/* Account settings stay open pre-verification (verify card lives here). */}
          <Route path="/settings" element={lazyRoute(<SettingsPage />)} />
        </Route>
      </Route>

      <Route path="*" element={lazyRoute(<NotFoundPage />)} />
    </Routes>
  );
}
