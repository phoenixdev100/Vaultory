import { History, RotateCcw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useRestoreVersion, useSecretVersions } from '@/features/vault/queries';
import { ApiError } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { DecryptedSecret } from '@/types/api';

interface VersionsDialogProps {
  secret: DecryptedSecret | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Previous versions stay encrypted server-side; they are decrypted here on
 * demand and restoring copies the old ciphertext back into place.
 */
export function VersionsDialog({ secret, open, onOpenChange }: VersionsDialogProps) {
  const versions = useSecretVersions(open ? secret?.id : undefined);
  const restore = useRestoreVersion();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleRestore(versionId: string) {
    if (!secret) return;
    restore.mutate(
      { id: secret.id, versionId },
      {
        onSuccess: () => {
          toast.success('Version restored', { description: 'The item now matches the selected version.' });
          setConfirmId(null);
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('Could not restore that version', {
            description: error instanceof ApiError ? error.message : undefined,
          });
        },
      },
    );
  }

  return (
    <AnimatedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Version history"
        description={`Earlier encrypted snapshots of "${secret?.title ?? ''}". Restoring replaces the current values.`}
        className="max-w-xl"
      >
        {versions.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : versions.isError ? (
          <EmptyState
            dense
            icon={ShieldAlert}
            title="Could not load version history"
            description={versions.error instanceof ApiError ? versions.error.message : undefined}
          />
        ) : versions.data && versions.data.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {versions.data.map((version) => (
              <li
                key={version.id}
                className="flex items-center gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-subtle">
                  <History className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-fg">Version {version.version}</p>
                    {version.keyVersion !== secret?.keyVersion ? (
                      <Badge variant="warning" size="sm">
                        Older vault key
                      </Badge>
                    ) : null}
                    {version.payload === null ? (
                      <Badge variant="danger" size="sm">
                        Undecryptable
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-fg-subtle" title={formatDateTime(version.createdAt)}>
                    Saved {formatRelative(version.createdAt)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={version.payload === null || restore.isPending}
                  onClick={() => setConfirmId(version.id)}
                >
                  <RotateCcw />
                  Restore
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            dense
            icon={History}
            title="No previous versions"
            description="A snapshot is saved each time this item is edited. Make a change and it will show up here."
          />
        )}
      </DialogContent>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(next) => setConfirmId(next ? confirmId : null)}
        title="Restore this version?"
        description="The current values will be replaced by this snapshot. A new version of the current state is kept automatically, so nothing is lost."
        confirmLabel="Restore"
        loading={restore.isPending}
        onConfirm={() => {
          if (confirmId) handleRestore(confirmId);
        }}
      />
    </AnimatedDialog>
  );
}
