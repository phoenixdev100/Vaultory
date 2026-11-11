import { Download, FolderPlus, KeyRound, Plus, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportDialog } from '@/features/env-import/export-dialog';
import { ImportDialog } from '@/features/env-import/import-dialog';
import { CreateFolderDialog } from '@/features/folders/create-folder-dialog';
import { useFolders } from '@/features/folders/queries';
import {
  useDeleteSecret,
  useMoveSecret,
  useSecrets,
  useToggleFavorite,
  type SecretFilters,
} from '@/features/vault/queries';
import { SecretBulkBar } from '@/features/vault/bulk-bar';
import { SecretFiltersBar } from '@/features/vault/secret-filters';
import { SecretGrid } from '@/features/vault/secret-grid';
import { SecretList } from '@/features/vault/secret-list';
import { ViewModeToggle } from '@/components/ui/view-toggle';
import { ApiError } from '@/lib/api';
import { useViewMode } from '@/lib/view-mode';
import type { DecryptedSecret } from '@/types/api';

export default function VaultPage() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<SecretFilters>(() => ({
    sort: 'updated',
    ...(params.get('folder') ? { folderId: params.get('folder')! } : {}),
  }));
  const [importOpen, setImportOpen] = useState(params.get('import') === '1');
  const [exportOpen, setExportOpen] = useState(params.get('export') === '1');
  const [pendingDelete, setPendingDelete] = useState<DecryptedSecret | null>(null);
  const [subfolderOpen, setSubfolderOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode('vaultory.view.vault', 'list');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const secrets = useSecrets(filters);
  const folders = useFolders();
  const toggleFavorite = useToggleFavorite();
  const moveSecret = useMoveSecret();
  const deleteSecret = useDeleteSecret();

  const items = useMemo(() => secrets.data?.items ?? [], [secrets.data]);
  const folderItems = folders.data?.items ?? [];

  // Selection helpers - ids are pruned to rows still on screen so a filter
  // change can never leave phantom selections behind.
  const selectedSecrets = useMemo(
    () => items.filter((secret) => selectedIds.has(secret.id)),
    [items, selectedIds],
  );
  const selection = useMemo(
    () => ({
      selected: selectedIds,
      onToggle: (id: string) =>
        setSelectedIds((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      onToggleAll: () =>
        setSelectedIds((current) =>
          items.every((secret) => current.has(secret.id))
            ? new Set()
            : new Set(items.map((secret) => secret.id)),
        ),
    }),
    [selectedIds, items],
  );
  // Inside a real folder (not the "no folder" bucket) the user is standing in a
  // folder context - offer making a subfolder right here.
  const currentFolder =
    filters.folderId && filters.folderId !== 'none'
      ? (folderItems.find((folder) => folder.id === filters.folderId) ?? null)
      : null;

  // An empty result with no filters means the vault itself is empty - not a
  // failed search. Sort alone doesn't count as a filter.
  const filtersActive =
    filters.query !== undefined ||
    (filters.category !== undefined && filters.category !== 'ALL') ||
    filters.folderId !== undefined ||
    filters.tag !== undefined ||
    filters.favorite === true;

  // Tag options come from what is already in the vault.
  const tags = useMemo(
    () => [...new Set(items.flatMap((secret) => secret.tags))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  function handleFavorite(secret: DecryptedSecret) {
    toggleFavorite.mutate(
      { id: secret.id, isFavorite: !secret.isFavorite },
      { onError: () => toast.error('Could not update favorites') },
    );
  }

  function handleMove(secret: DecryptedSecret, folderId: string | null) {
    const name = folderId ? folderItems.find((f) => f.id === folderId)?.name : 'no folder';
    moveSecret.mutate(
      { id: secret.id, folderId },
      {
        onSuccess: () => toast.success(`Moved “${secret.title}” to ${name ?? 'no folder'}`),
        onError: () => toast.error('Could not move that item'),
      },
    );
  }

  function handleDelete() {
    if (!pendingDelete) return;
    deleteSecret.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Moved “${pendingDelete.title}” to the trash`);
        setPendingDelete(null);
      },
      onError: (error) => {
        toast.error('Could not delete that item', {
          description: error instanceof ApiError ? error.message : undefined,
        });
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Vault"
        description="Everything saved in your encrypted vault. Values are decrypted only in this browser."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} aria-label="Import">
              <Upload />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={items.length === 0}
              aria-label="Export"
            >
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" asChild>
              <Link to="/vault/new">
                <Plus />
                New secret
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SecretFiltersBar
          filters={filters}
          onChange={setFilters}
          folders={folderItems}
          tags={tags}
          className="min-w-0 flex-1"
        />
        {currentFolder ? (
          <Button variant="secondary" size="sm" onClick={() => setSubfolderOpen(true)} aria-label="New subfolder">
            <FolderPlus />
            <span className="hidden sm:inline">New subfolder</span>
          </Button>
        ) : null}
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {secrets.isError ? (
        <EmptyState
          icon={KeyRound}
          title="Could not load your vault"
          description={secrets.error instanceof ApiError ? secrets.error.message : 'Check your connection and retry.'}
          action={
            <Button size="sm" variant="secondary" onClick={() => void secrets.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        (() => {
          const emptyState = (
            <EmptyState
              icon={KeyRound}
              title={filtersActive ? 'Nothing matches those filters' : 'Your vault is empty'}
              description={
                filtersActive
                  ? 'Try clearing the search or picking another category.'
                  : 'Add your first login, API key or secure note. It is encrypted before it ever leaves this device.'
              }
              action={
                filtersActive ? undefined : (
                  <Button size="sm" asChild>
                    <Link to="/vault/new">
                      <Plus />
                      Add your first secret
                    </Link>
                  </Button>
                )
              }
            />
          );
          // Defer past the dropdown's close so its pointerup can't dismiss
          // the freshly-mounted AlertDialog as an "outside press".
          const listProps = {
            secrets: items,
            folders: folderItems,
            loading: secrets.isLoading,
            onToggleFavorite: handleFavorite,
            onMove: handleMove,
            onDelete: (secret: DecryptedSecret) => window.setTimeout(() => setPendingDelete(secret), 0),
            selection,
            empty: emptyState,
          };
          return (
            <>
              {viewMode === 'grid' ? <SecretGrid {...listProps} /> : <SecretList {...listProps} />}
              {selectedSecrets.length > 0 ? (
                <SecretBulkBar
                  secrets={selectedSecrets}
                  folders={folderItems}
                  onClear={() => setSelectedIds(new Set())}
                />
              ) : null}
            </>
          );
        })()
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} folders={folderItems} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} secrets={items} folders={folderItems} />
      <CreateFolderDialog
        open={subfolderOpen}
        onOpenChange={setSubfolderOpen}
        defaultParentId={currentFolder?.id}
        folders={folderItems}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => setPendingDelete(open ? pendingDelete : null)}
        title={`Move “${pendingDelete?.title}” to the trash?`}
        description="It stays recoverable for 30 days from the Trash page. After that it is permanently removed."
        confirmLabel="Move to trash"
        destructive
        loading={deleteSecret.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
