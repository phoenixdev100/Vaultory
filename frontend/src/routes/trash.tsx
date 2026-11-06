import { RotateCcw, Trash, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { categoryMeta } from '@/features/vault/categories';
import { useEmptyTrash, usePurgeSecret, useRestoreSecret, useTrash } from '@/features/vault/queries';
import { ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import type { DecryptedSecret } from '@/types/api';

function daysLeft(deletedAt: string | null, retentionDays: number): number {
  if (!deletedAt) return retentionDays;
  const elapsed = Math.floor((Date.now() - Date.parse(deletedAt)) / (24 * 60 * 60 * 1000));
  return Math.max(0, retentionDays - elapsed);
}

export default function TrashPage() {
  const trash = useTrash();
  const restore = useRestoreSecret();
  const purge = usePurgeSecret();
  const emptyTrash = useEmptyTrash();

  const [pendingPurge, setPendingPurge] = useState<DecryptedSecret | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);

  const items = trash.data?.items ?? [];
  const retentionDays = trash.data?.retentionDays ?? 30;

  function handleRestore(item: DecryptedSecret) {
    restore.mutate(item.id, {
      onSuccess: () => toast.success(`Restored “${item.title}”`),
      onError: (error) =>
        toast.error('Could not restore that item', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  }

  function handlePurge() {
    if (!pendingPurge) return;
    purge.mutate(pendingPurge.id, {
      onSuccess: () => {
        toast.success(`Permanently deleted “${pendingPurge.title}”`);
        setPendingPurge(null);
      },
      onError: (error) =>
        toast.error('Could not delete that item', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  }

  function handleEmpty() {
    emptyTrash.mutate(undefined, {
      onSuccess: ({ purged }) => {
        toast.success(`Emptied the trash - ${purged} ${purged === 1 ? 'item' : 'items'} permanently deleted`);
        setEmptyOpen(false);
      },
      onError: (error) =>
        toast.error('Could not empty the trash', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Trash"
        description={`Deleted items stay recoverable for ${retentionDays} days, then are permanently removed.`}
        actions={
          items.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setEmptyOpen(true)}>
              <Trash2 />
              Empty trash
            </Button>
          ) : undefined
        }
      />

      {trash.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trash}
          title="The trash is empty"
          description="Items you delete land here first. You can restore them or erase them for good."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((item) => {
            const meta = categoryMeta(item.category);
            const left = daysLeft(item.deletedAt, retentionDays);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border ${meta.accent}`}
                >
                  <meta.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-fg">{item.title}</p>
                    <Badge variant={left <= 7 ? 'warning' : 'neutral'} size="sm">
                      {left} {left === 1 ? 'day' : 'days'} left
                    </Badge>
                  </div>
                  <p className="text-xs text-fg-subtle">
                    {meta.short} · deleted {item.deletedAt ? formatRelative(item.deletedAt) : 'recently'}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={restore.isPending && restore.variables === item.id}
                    onClick={() => handleRestore(item)}
                  >
                    <RotateCcw />
                    Restore
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPendingPurge(item)}>
                    Delete forever
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingPurge !== null}
        onOpenChange={(open) => setPendingPurge(open ? pendingPurge : null)}
        title={`Permanently delete “${pendingPurge?.title}”?`}
        description="This erases the encrypted item, its version history and attached files. There is no recovery after this."
        confirmLabel="Delete forever"
        destructive
        loading={purge.isPending}
        onConfirm={handlePurge}
      />

      <ConfirmDialog
        open={emptyOpen}
        onOpenChange={setEmptyOpen}
        title={`Empty the trash (${items.length} ${items.length === 1 ? 'item' : 'items'})?`}
        description="Every item in the trash will be permanently erased, including version history and attachments. There is no recovery."
        confirmLabel="Empty trash"
        destructive
        loading={emptyTrash.isPending}
        onConfirm={handleEmpty}
      />
    </div>
  );
}
