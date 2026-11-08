import { Check, Share2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAcceptShare,
  useDeclineShare,
  useRevokeShare,
  useShares,
} from '@/features/sharing/queries';
import { EmergencySection } from '@/features/emergency/emergency-section';
import { categoryMeta } from '@/features/vault/categories';
import { ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import type { ShareDto } from '@/types/api';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function SharingPage() {
  const shares = useShares();
  const accept = useAcceptShare();
  const decline = useDeclineShare();
  const revoke = useRevokeShare();

  const incoming = shares.data?.incoming ?? [];
  const outgoing = shares.data?.outgoing ?? [];
  const pending = incoming.filter((s) => s.status === 'PENDING');
  const [contactOpen, setContactOpen] = useState(false);

  function handleAccept(share: ShareDto) {
    accept.mutate(share, {
      onSuccess: () => toast.success(`Saved “${share.title}” to your vault`),
      onError: (error) => toast.error('Could not accept that share', { description: errorMessage(error, '') }),
    });
  }

  function handleDecline(share: ShareDto) {
    decline.mutate(share.id, {
      onSuccess: () => toast.success('Share declined'),
      onError: (error) => toast.error('Could not decline', { description: errorMessage(error, '') }),
    });
  }

  function handleRevoke(share: ShareDto) {
    revoke.mutate(share.id, {
      onSuccess: () => toast.success(`Revoked “${share.title}”`),
      onError: (error) => toast.error('Could not revoke', { description: errorMessage(error, '') }),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sharing"
        description="Secrets other Vaultory users have shared with you, end-to-end encrypted. The server only ever sees ciphertext."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setContactOpen(true)}>
            <UserPlus />
            Add contact
          </Button>
        }
      />

      {shares.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : incoming.length === 0 && outgoing.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Nothing shared yet"
          description="When someone shares a secret with your email it shows up here. Open any item and use Share to send one yourself."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Shared with you {pending.length > 0 ? `(${pending.length})` : ''}</CardTitle>
              <CardDescription>Accept a share to save a copy into your own vault.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {incoming.length === 0 ? (
                <p className="text-[13px] text-fg-subtle">No incoming shares.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {incoming.map((share) => {
                    const meta = categoryMeta(share.category);
                    return (
                      <li key={share.id} className="flex flex-wrap items-center gap-3 py-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border ${meta.accent}`}
                        >
                          <meta.icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-medium text-fg">{share.title}</p>
                            {share.status === 'ACCEPTED' ? <Badge variant="success" size="sm">Accepted</Badge> : null}
                          </div>
                          <p className="truncate text-xs text-fg-subtle">
                            {meta.label} · from {share.peer.name ? `${share.peer.name} (${share.peer.email})` : share.peer.email} · {formatRelative(share.createdAt)}
                            {share.expiresAt ? ` · expires ${formatRelative(share.expiresAt)}` : ''}
                          </p>
                        </div>
                        {share.status === 'PENDING' ? (
                          <div className="ml-auto flex shrink-0 items-center gap-1.5">
                            <Button
                              size="sm"
                              loading={accept.isPending && accept.variables?.id === share.id}
                              onClick={() => handleAccept(share)}
                            >
                              <Check />
                              Accept
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDecline(share)}>
                              <X />
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto shrink-0"
                            onClick={() => handleRevoke(share)}
                          >
                            Dismiss
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sent by you</CardTitle>
              <CardDescription>Revoking removes the encrypted copy - accepted recipients keep theirs.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {outgoing.length === 0 ? (
                <p className="text-[13px] text-fg-subtle">You have not shared anything yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {outgoing.map((share) => {
                    const meta = categoryMeta(share.category);
                    return (
                      <li key={share.id} className="flex flex-wrap items-center gap-3 py-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border ${meta.accent}`}
                        >
                          <meta.icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-medium text-fg">{share.title}</p>
                            <Badge variant={share.status === 'ACCEPTED' ? 'success' : 'neutral'} size="sm">
                              {share.status === 'ACCEPTED' ? 'Accepted' : 'Pending'}
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-fg-subtle">
                            to {share.peer.name ? `${share.peer.name} (${share.peer.email})` : share.peer.email} · {formatRelative(share.createdAt)}
                            {share.expiresAt ? ` · expires ${formatRelative(share.expiresAt)}` : ''}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(share)}>
                          Revoke
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <EmergencySection addOpen={contactOpen} onAddOpenChange={setContactOpen} />
    </div>
  );
}
