import { Globe, ShieldCheck, Wifi, X } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/auth-context';
import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from '@/features/auth/use-auth-mutations';
import { BreachCard } from '@/features/dashboard/breach-card';
import { SecurityChecklistCard } from '@/features/dashboard/checklist-card';
import { SessionMapCard } from '@/features/dashboard/map-card';
import { PasskeyCard } from '@/features/settings/passkey-card';
import { TotpCard } from '@/features/settings/totp-card';
import { useSettings } from '@/features/settings/queries';
import { useDashboard, useSecrets } from '@/features/vault/queries';
import { analyzePasswords } from '@/lib/audit';
import { formatRelative } from '@/lib/format';
import { countryName } from '@/lib/geo';
import { parseUserAgent } from '@/lib/user-agent';
import type { SessionDto } from '@/types/api';

function SessionsCard() {
  const sessions = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [target, setTarget] = useState<SessionDto | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        {sessions.data && sessions.data.items.length > 1 ? (
          <Button
            variant="secondary"
            size="sm"
            loading={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Sign out others
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {sessions.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sessions.data && sessions.data.items.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line">
            {sessions.data.items.map((session) => {
              const device = parseUserAgent(session.userAgent);
              return (
                <li key={session.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface-muted text-fg-subtle">
                    <device.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-fg" title={session.userAgent ?? undefined}>
                        {device.label}
                      </p>
                      {session.current ? (
                        <Badge variant="success" size="sm">
                          This device
                        </Badge>
                      ) : null}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-subtle">
                      {session.ipLabel ? (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Wifi className="size-3" />
                          {session.ipLabel}
                        </span>
                      ) : null}
                      {session.country ? (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="size-3" />
                          {countryName(session.country)}
                        </span>
                      ) : null}
                      <span>
                        active {formatRelative(session.lastSeenAt)} · expires {formatRelative(session.expiresAt)}
                      </span>
                    </p>
                  </div>
                  {!session.current ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Revoke access for ${device.label}`}
                      onClick={() => setTarget(session)}
                    >
                      <X />
                      Revoke
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-fg-muted">Could not load sessions.</p>
        )}
      </CardContent>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title="Sign out this session?"
        description={`${target?.userAgent ?? 'That device'} will be logged out immediately and will need the password to sign back in.`}
        confirmLabel="Sign out session"
        destructive
        loading={revokeSession.isPending}
        onConfirm={() => {
          if (!target) return;
          revokeSession.mutate(target.id, { onSuccess: () => setTarget(null) });
        }}
      />
    </Card>
  );
}

/**
 * Cards fed by gated endpoints (/dashboard, /secrets) - mounted only for
 * verified users so unverified sessions never fire doomed requests.
 */
function VerifiedSecurityChecklist() {
  const user = useCurrentUser();
  const dashboard = useDashboard();
  const secrets = useSecrets({ limit: 100, sort: 'title' });
  const report = secrets.data ? analyzePasswords(secrets.data.items) : null;

  return dashboard.data ? (
    <SecurityChecklistCard user={user} dashboard={dashboard.data} report={report} />
  ) : (
    <Skeleton className="h-64 w-full" />
  );
}

function VerifiedBreachWatch() {
  const user = useCurrentUser();
  const secrets = useSecrets({ limit: 100, sort: 'title' });
  const report = secrets.data ? analyzePasswords(secrets.data.items) : null;

  return <BreachCard key={user.id} report={report} userId={user.id} />;
}

function VaultProtectionCard() {
  const settings = useSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          How your vault is protected
        </CardTitle>
      </CardHeader>
      <CardContent>
        {settings.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <dl className="flex flex-col gap-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-subtle">Encryption</dt>
              <dd className="font-mono text-xs text-fg">{settings.data?.security.encryption}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-subtle">Key derivation</dt>
              <dd className="font-mono text-xs text-fg">{settings.data?.security.keyDerivation}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-subtle">Your password</dt>
              <dd className="text-xs text-fg">never sent - a derived verifier is</dd>
            </div>
            {settings.data && settings.data.stats.strandedSecrets > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-subtle">Undecryptable items</dt>
                <dd>
                  <Badge variant="danger" size="sm">
                    {settings.data.stats.strandedSecrets} lost to an old key
                  </Badge>
                </dd>
              </div>
            ) : null}
          </dl>
        )}

        {settings.data && settings.data.stats.strandedSecrets > 0 ? (
          <div className="mt-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger-soft/60 px-3 py-2.5 text-[12px] leading-5 text-danger">
            {settings.data.stats.strandedSecrets} item
            {settings.data.stats.strandedSecrets === 1 ? ' was' : 's were'} encrypted under a previous vault
            key and can no longer be decrypted. This happens when a password reset had to rotate the key
            instead of recovering it. You can delete them from the vault.
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-surface-muted/50 px-3 py-3 text-[12px] leading-5 text-fg-muted">
          <p>
            <strong className="text-fg">Recovery:</strong> your vault key is wrapped with a key derived from
            your password. A second copy is escrowed - encrypted to a server-held key - so a verified email
            reset can restore access to every saved item.
          </p>
          <p>
            <strong className="text-fg">What the server can see:</strong> titles, categories, tags and
            folders (for search). Secret values are ciphertext.
          </p>
          <p>
            <strong className="text-fg">Honest limits:</strong> this protects your data at rest and in
            transit, and the server cannot decrypt your vault - but a compromised device or browser can
            always capture what you type. There is no independent security audit yet.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SecurityPage() {
  const user = useCurrentUser();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Security"
        description="Sign-in protection, devices and monitoring for your account."
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <TotpCard />
          <PasskeyCard />
          {user.emailVerified ? <VerifiedBreachWatch /> : null}
          <VaultProtectionCard />
        </div>

        <div className="flex flex-col gap-4">
          {user.emailVerified ? <VerifiedSecurityChecklist /> : null}
          <SessionMapCard />
        </div>
      </div>

      <SessionsCard />
    </div>
  );
}
