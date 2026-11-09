import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useVault } from '@/features/vault/vault-context';
import { ApiError } from '@/lib/api';
import { enrollPasskey, passkeySupported, passkeysApi, type PasskeyDto } from '@/lib/crypto/passkey';
import { formatRelative } from '@/lib/format';

/**
 * WebAuthn PRF enrollment: the passkey's PRF output wraps the vault key so a
 * fingerprint/Windows Hello assertion can unlock it later. Convenience only -
 * password unlock always remains available.
 */
export function PasskeyCard() {
  const { user } = useAuth();
  const { getKey } = useVault();
  const queryClient = useQueryClient();

  const passkeys = useQuery({
    queryKey: ['passkeys'],
    queryFn: passkeysApi.list,
    enabled: passkeySupported(),
  });

  const enroll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in.');
      const body = await enrollPasskey(getKey(), user, deviceLabel());
      return passkeysApi.enroll(body);
    },
    onSuccess: () => {
      toast.success('Passkey added - use it on the unlock screen');
      void queryClient.invalidateQueries({ queryKey: ['passkeys'] });
    },
    onError: (error) =>
      toast.error('Could not add the passkey', {
        description:
          error instanceof ApiError || error instanceof Error ? error.message : undefined,
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => passkeysApi.remove(id),
    onSuccess: () => {
      toast.success('Passkey removed');
      void queryClient.invalidateQueries({ queryKey: ['passkeys'] });
    },
  });

  const supported = passkeySupported();
  const items = passkeys.data?.passkeys ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Passkey unlock</CardTitle>
          <CardDescription>
            Unlock your vault with this device's biometrics or PIN instead of your password. Uses the
            WebAuthn PRF extension - Chrome, Edge and Safari; Firefox is not supported yet.
          </CardDescription>
        </div>
        {supported ? (
          <Button variant="secondary" size="sm" loading={enroll.isPending} onClick={() => enroll.mutate()}>
            <Plus />
            Add passkey
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {!supported ? (
          <p className="text-[13px] text-fg-subtle">
            Passkeys need a secure context and a compatible browser.
          </p>
        ) : passkeys.isLoading ? (
          <Skeleton className="h-11 w-full" />
        ) : items.length === 0 ? (
          <p className="text-[13px] text-fg-subtle">No passkeys yet - your password still unlocks the vault.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {items.map((passkey: PasskeyDto) => (
              <li key={passkey.id} className="flex items-center gap-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-subtle">
                  <Fingerprint className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{passkey.name ?? 'Passkey'}</p>
                  <p className="text-xs text-fg-subtle">added {formatRelative(passkey.createdAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${passkey.name ?? 'passkey'}`}
                  onClick={() => remove.mutate(passkey.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const platform = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac/i.test(ua)
      ? 'Mac'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad/i.test(ua)
          ? 'iOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Safari\//.test(ua) && !/Chrome\//.test(ua)
        ? 'Safari'
        : 'Chrome';
  return `${browser} on ${platform}`;
}
