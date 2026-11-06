import { Clock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useFolders } from '@/features/folders/queries';
import {
  useDeleteSecret,
  useMoveSecret,
  useSecrets,
  useToggleFavorite,
} from '@/features/vault/queries';
import { SecretList } from '@/features/vault/secret-list';
import { ApiError } from '@/lib/api';
import type { DecryptedSecret } from '@/types/api';

export default function RecentPage() {
  const recent = useSecrets({ sort: 'updated', limit: 25 });
  const folders = useFolders();
  const toggleFavorite = useToggleFavorite();
  const moveSecret = useMoveSecret();
  const deleteSecret = useDeleteSecret();
  const [pendingDelete, setPendingDelete] = useState<DecryptedSecret | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Recently updated"
        description="The 25 items you changed most recently."
        actions={
          <Button size="sm" asChild>
            <Link to="/vault/new">New secret</Link>
          </Button>
        }
      />

      {recent.isError ? (
        <EmptyState
          icon={Clock}
          title="Could not load recent items"
          description={recent.error instanceof ApiError ? recent.error.message : undefined}
          action={
            <Button size="sm" variant="secondary" onClick={() => void recent.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <SecretList
          secrets={recent.data?.items ?? []}
          folders={folders.data?.items ?? []}
          loading={recent.isLoading}
          onToggleFavorite={(secret) =>
            toggleFavorite.mutate(
              { id: secret.id, isFavorite: !secret.isFavorite },
              { onError: () => toast.error('Could not update favorites') },
            )
          }
          onMove={(secret, folderId) =>
            moveSecret.mutate(
              { id: secret.id, folderId },
              { onError: () => toast.error('Could not move that item') },
            )
          }
          onDelete={setPendingDelete}
          empty={
            <EmptyState
              icon={Clock}
              title="Nothing here yet"
              description="Items appear here as you create and edit them."
              action={
                <Button size="sm" asChild>
                  <Link to="/vault/new">Add a secret</Link>
                </Button>
              }
            />
          }
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => setPendingDelete(open ? pendingDelete : null)}
        title={`Move “${pendingDelete?.title}” to the trash?`}
        description="It stays recoverable for 30 days from the Trash page. After that it is permanently removed."
        confirmLabel="Move to trash"
        destructive
        loading={deleteSecret.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteSecret.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success(`Moved “${pendingDelete.title}” to the trash`);
              setPendingDelete(null);
            },
            onError: () => toast.error('Could not delete that item'),
          });
        }}
      />
    </div>
  );
}
