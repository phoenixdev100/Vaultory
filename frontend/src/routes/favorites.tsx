import { Star } from 'lucide-react';
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
  useFavoriteSecrets,
  useMoveSecret,
  useToggleFavorite,
} from '@/features/vault/queries';
import { SecretList } from '@/features/vault/secret-list';
import { ApiError } from '@/lib/api';
import type { DecryptedSecret } from '@/types/api';

export default function FavoritesPage() {
  const favorites = useFavoriteSecrets();
  const folders = useFolders();
  const toggleFavorite = useToggleFavorite();
  const moveSecret = useMoveSecret();
  const deleteSecret = useDeleteSecret();
  const [pendingDelete, setPendingDelete] = useState<DecryptedSecret | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Favorites"
        description="The items you reach for most. Star anything in the vault to pin it here."
        actions={
          <Button size="sm" asChild>
            <Link to="/vault/new">New secret</Link>
          </Button>
        }
      />

      {favorites.isError ? (
        <EmptyState
          icon={Star}
          title="Could not load favorites"
          description={favorites.error instanceof ApiError ? favorites.error.message : undefined}
          action={
            <Button size="sm" variant="secondary" onClick={() => void favorites.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <SecretList
          secrets={favorites.data ?? []}
          folders={folders.data?.items ?? []}
          loading={favorites.isLoading}
          onToggleFavorite={(secret) =>
            toggleFavorite.mutate(
              { id: secret.id, isFavorite: false },
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
              icon={Star}
              title="No favorites yet"
              description="Star the credentials you use every day and they will be one click away."
              action={
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/vault">Browse the vault</Link>
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
