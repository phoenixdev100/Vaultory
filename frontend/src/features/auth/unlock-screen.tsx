import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Fingerprint, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Field, Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { FieldError } from '@/components/ui/input';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useLogout } from '@/features/auth/use-auth-mutations';
import { passkeySupported, passkeysApi, unlockWithPasskey } from '@/lib/crypto/passkey';
import { useVault } from '@/features/vault/vault-context';

/**
 * Shown whenever the vault key is not in memory (fresh load, auto-lock, manual
 * lock). Unlocking happens entirely in the browser: Argon2id over the password
 * and an AES-GCM unwrap of the stored key - no network call is involved.
 */
export function UnlockScreen() {
  const user = useCurrentUser();
  const { unlock, unlocking, progress, adoptKey } = useVault();
  const logout = useLogout();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const passkeys = useQuery({
    queryKey: ['passkeys'],
    queryFn: passkeysApi.list,
    enabled: passkeySupported(),
    retry: false,
  });
  const enrolled = passkeys.data?.passkeys ?? [];

  async function handlePasskey() {
    setError(null);
    setPasskeyBusy(true);
    try {
      for (const passkey of enrolled) {
        try {
          const key = await unlockWithPasskey(passkey);
          adoptKey(key);
          toast.success('Vault unlocked');
          return;
        } catch {
          // Try the next enrolled credential - a non-matching or cancelled
          // assertion falls through to the password form.
        }
      }
      setError('Passkey unlock did not work - use your password instead.');
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await unlock(password);
      setPassword('');
      toast.success('Vault unlocked');
    } catch {
      setError('That password did not unlock your vault. Try again.');
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <div className="flex size-11 items-center justify-center rounded-full border border-line bg-surface shadow-subtle">
            <Lock className="size-5 text-fg-muted" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-fg">Your vault is locked</h1>
            <p className="mt-1 text-[13px] leading-5 text-fg-muted">
              Enter your password to decrypt your vault on this device.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
          <Field>
            <Label htmlFor="unlock-email">Account</Label>
            <p
              id="unlock-email"
              className="truncate rounded-[var(--radius-control)] border border-line bg-surface-muted px-3 py-2 text-[13px] text-fg-muted"
            >
              {user.email}
            </p>
          </Field>

          <Field>
            <Label htmlFor="unlock-password">Password</Label>
            <PasswordInput
              id="unlock-password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
            <FieldError>{error}</FieldError>
          </Field>

          {unlocking ? (
            <div className="flex flex-col gap-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-line-strong">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: `${Math.round(progress * 100)}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-xs text-fg-subtle">Deriving your key with Argon2id…</p>
            </div>
          ) : null}

          <Button type="submit" loading={unlocking} className="w-full">
            Unlock vault
          </Button>

          {enrolled.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              loading={passkeyBusy}
              onClick={() => void handlePasskey()}
            >
              <Fingerprint />
              Unlock with passkey
            </Button>
          ) : null}

          <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-muted/60 px-3 py-2.5">
            <ShieldCheck className="size-4 shrink-0 text-fg-subtle" />
            <p className="text-[11px] leading-4 text-fg-subtle">
              Vaultory cannot unlock your vault for you. The key is derived from your password in this browser.
            </p>
          </div>
        </form>

        <Button
          variant="ghost"
          size="sm"
          className="mx-auto mt-4 flex"
          loading={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSettled: () => void navigate('/login', { replace: true }),
            })
          }
        >
          <LogOut />
          Sign out instead
        </Button>
      </motion.div>
    </div>
  );
}
