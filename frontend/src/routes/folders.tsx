import { CornerDownRight, Folder, FolderPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldError, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewModeToggle } from '@/components/ui/view-toggle';
import { CreateFolderDialog } from '@/features/folders/create-folder-dialog';
import {
  useBulkDeleteFolders,
  useBulkMoveFolders,
  useDeleteFolder,
  useFolders,
  useUpdateFolder,
} from '@/features/folders/queries';
import { flattenFolderTree, folderPath, folderSubtreeIds, type TreeFolder } from '@/features/folders/tree';
import { ApiError } from '@/lib/api';
import { formatRelative, pluralize } from '@/lib/format';
import { useViewMode } from '@/lib/view-mode';
import { cn } from '@/lib/utils';
import type { FolderDto } from '@/types/api';

/** Parents can only hold children up to this depth (matches backend cap). */
const MAX_FOLDER_DEPTH = 3;

export default function FoldersPage() {
  const folders = useFolders();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const [viewMode, setViewMode] = useViewMode('vaultory.view.folders', 'grid');

  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FolderDto | null>(null);
  const [deleting, setDeleting] = useState<FolderDto | null>(null);
  const [name, setName] = useState('');
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteStrategy, setDeleteStrategy] = useState<'detach' | 'delete-secrets'>('detach');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkParentId, setBulkParentId] = useState<string>('root');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteStrategy, setBulkDeleteStrategy] = useState<'detach' | 'delete-secrets'>('detach');
  const bulkMove = useBulkMoveFolders();
  const bulkDelete = useBulkDeleteFolders();

  const items = useMemo(() => folders.data?.items ?? [], [folders.data]);
  const tree = useMemo(() => flattenFolderTree(items), [items]);
  const byId = useMemo(() => new Map(items.map((folder) => [folder.id, folder])), [items]);

  function openCreate(parent: FolderDto | null = null) {
    setCreateParentId(parent?.id ?? null);
    setCreateOpen(true);
  }

  function openEdit(folder: FolderDto) {
    setName(folder.name);
    setEditParentId(folder.parentId);
    setNameError(null);
    setEditing(folder);
  }

  function submitEdit() {
    if (!editing) return;
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError('Give the folder a name');
      return;
    }
    updateFolder.mutate(
      { id: editing.id, name: trimmed, parentId: editParentId },
      {
        onSuccess: () => {
          toast.success(`Saved “${trimmed}”`);
          setEditing(null);
        },
        onError: (error) => {
          setNameError(error instanceof ApiError ? error.message : 'Could not update the folder');
        },
      },
    );
  }

  function submitDelete() {
    if (!deleting) return;
    deleteFolder.mutate(
      { id: deleting.id, strategy: deleteStrategy },
      {
        onSuccess: (result) => {
          const parts: string[] = [];
          if (result.detachedSecrets > 0) {
            parts.push(`${result.detachedSecrets} ${result.detachedSecrets === 1 ? 'item was' : 'items were'} moved to “No folder”`);
          }
          if (result.deletedSecrets > 0) {
            parts.push(`${result.deletedSecrets} ${result.deletedSecrets === 1 ? 'item was' : 'items were'} permanently deleted`);
          }
          if (result.detachedFolders > 0) {
            parts.push(
              `${result.detachedFolders} subfolder${result.detachedFolders === 1 ? '' : 's'} moved up a level`,
            );
          }
          toast.success(`Deleted folder “${deleting.name}”`, { description: parts.join('. ') || undefined });
          setDeleting(null);
        },
        onError: (error) => {
          toast.error('Could not delete the folder', {
            description: error instanceof ApiError ? error.message : undefined,
          });
        },
      },
    );
  }

  const folderMenu = (folder: FolderDto, allowSubfolder = true) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          aria-label={`Actions for ${folder.name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {allowSubfolder ? (
          <DropdownMenuItem onSelect={() => openCreate(folder)}>
            <FolderPlus />
            New subfolder
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => openEdit(folder)}>
          <Pencil />
          Edit / move
        </DropdownMenuItem>
        <DropdownMenuItem
          destructive
          onSelect={() => {
            setDeleteStrategy('detach');
            setDeleting(folder);
          }}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const selectedFolders = items.filter((folder) => selectedIds.has(folder.id));
  const bulkBusy = bulkMove.isPending || bulkDelete.isPending;

  function toggleFolder(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submitBulkMove() {
    bulkMove.mutate(
      { ids: [...selectedIds], parentId: bulkParentId === 'root' ? null : bulkParentId },
      {
        onSuccess: (result) => {
          toast.success(`${pluralize(result.updated, 'folder')} moved`);
          setBulkMoveOpen(false);
          setSelectedIds(new Set());
        },
        onError: (error) =>
          toast.error('Could not move the folders', {
            description: error instanceof ApiError ? error.message : undefined,
          }),
      },
    );
  }

  function submitBulkDelete() {
    bulkDelete.mutate(
      { ids: [...selectedIds], strategy: bulkDeleteStrategy },
      {
        onSuccess: (result) => {
          const parts: string[] = [];
          if (result.deletedSecrets > 0) {
            parts.push(`${result.deletedSecrets} ${result.deletedSecrets === 1 ? 'item was' : 'items were'} permanently deleted`);
          }
          toast.success(`${pluralize(result.deleted, 'folder')} deleted`, { description: parts.join('. ') || undefined });
          setBulkDeleteOpen(false);
          setSelectedIds(new Set());
        },
        onError: (error) =>
          toast.error('Could not delete the folders', {
            description: error instanceof ApiError ? error.message : undefined,
          }),
      },
    );
  }

  const folderCheckbox = (folder: FolderDto) => (
    <input
      type="checkbox"
      className="size-4 shrink-0 accent-primary"
      checked={selectedIds.has(folder.id)}
      onChange={() => toggleFolder(folder.id)}
      onClick={(event) => event.stopPropagation()}
      aria-label={`Select ${folder.name}`}
    />
  );

  const folderIcon = (size: 'md' | 'sm' = 'md') => (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-primary-line bg-primary-soft text-primary',
        size === 'md' ? 'size-9' : 'size-7',
      )}
    >
      <Folder className={size === 'md' ? 'size-4' : 'size-3.5'} />
    </span>
  );

  const childRow = ({ folder, depth }: TreeFolder) => (
    <li key={folder.id} className="group flex items-center gap-2 py-1.5" style={{ paddingLeft: `${(depth - 1) * 18 + 4}px` }}>
      <Link
        to={`/vault?folder=${folder.id}`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-[12px] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none"
      >
        <CornerDownRight className="size-3.5 shrink-0 text-fg-subtle" />
        <span className="truncate font-medium">{folder.name}</span>
        <span className="shrink-0 text-[11px] text-fg-subtle">
          {pluralize(folder.secretCount, 'item')}
        </span>
      </Link>
      {folderMenu(folder, depth + 1 < MAX_FOLDER_DEPTH)}
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Folders"
        description="Group related credentials - folders can live inside folders, up to three levels deep. Deleting a folder never silently deletes what is inside it."
        actions={
          <>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            <Button size="sm" onClick={() => openCreate()}>
              <FolderPlus />
              New folder
            </Button>
          </>
        }
      />

      {folders.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : folders.isError ? (
        <EmptyState
          icon={Folder}
          title="Could not load folders"
          description={folders.error instanceof ApiError ? folders.error.message : undefined}
          action={
            <Button size="sm" variant="secondary" onClick={() => void folders.refetch()}>
              Retry
            </Button>
          }
        />
      ) : folders.data && (items.length > 0 || folders.data.unfiledCount > 0) ? (
        viewMode === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tree
              .filter(({ depth }) => depth === 0)
              .map(({ folder }) => {
                const descendants = tree.filter(({ folder: child }) => {
                  let current = child.parentId;
                  while (current) {
                    if (current === folder.id) return true;
                    current = byId.get(current)?.parentId ?? null;
                  }
                  return false;
                });
                return (
                  <div
                    key={folder.id}
                    className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-subtle transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-center gap-3">
                      {folderCheckbox(folder)}
                      <Link
                        to={`/vault?folder=${folder.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none"
                      >
                        {folderIcon()}
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-fg">{folder.name}</span>
                          <span className="block text-[11px] text-fg-subtle">
                            {pluralize(folder.secretCount, 'item')}
                            {folder.subfolderCount > 0 ? ` · ${pluralize(folder.subfolderCount, 'subfolder')}` : ''}
                            {' · '}
                            {formatRelative(folder.updatedAt)}
                          </span>
                        </span>
                      </Link>
                      {folderMenu(folder)}
                    </div>
                    {descendants.length > 0 ? (
                      <ul className="mt-2.5 flex flex-col border-t border-line pt-2">
                        {descendants.map(childRow)}
                      </ul>
                    ) : null}
                  </div>
                );
              })}

            {folders.data.unfiledCount > 0 ? (
              <Link
                to="/vault?folder=none"
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong p-4 transition-colors hover:border-primary hover:bg-primary-soft/30 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface-muted text-fg-subtle">
                  <Folder className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-fg-muted">No folder</span>
                  <span className="block text-[11px] text-fg-subtle">
                    {pluralize(folders.data.unfiledCount, 'unfiled item')}
                  </span>
                </span>
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-subtle">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface-muted/60">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={items.length > 0 && items.every((folder) => selectedIds.has(folder.id))}
                onChange={() =>
                  setSelectedIds((current) =>
                    items.every((folder) => current.has(folder.id))
                      ? new Set()
                      : new Set(items.map((folder) => folder.id)),
                  )
                }
                aria-label="Select all folders"
              />
              <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">
                Folders
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-line">
              {tree.map(({ folder, depth }) => (
                <li
                  key={folder.id}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted/60"
                  style={{ paddingLeft: `${depth * 22 + 16}px` }}
                >
                  {folderCheckbox(folder)}
                  <Link
                    to={`/vault?folder=${folder.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none"
                  >
                    {depth > 0 ? (
                      <CornerDownRight className="size-4 shrink-0 text-fg-subtle" />
                    ) : null}
                    {folderIcon(depth > 0 ? 'sm' : 'md')}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{folder.name}</span>
                      <span className="block text-[11px] text-fg-subtle">
                        {pluralize(folder.secretCount, 'item')}
                        {folder.subfolderCount > 0 ? ` · ${pluralize(folder.subfolderCount, 'subfolder')}` : ''}
                        {' · updated '}
                        {formatRelative(folder.updatedAt)}
                      </span>
                    </span>
                  </Link>
                  {folderMenu(folder, depth + 1 < MAX_FOLDER_DEPTH)}
                </li>
              ))}
              {folders.data.unfiledCount > 0 ? (
                <li>
                  <Link
                    to="/vault?folder=none"
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-line-strong bg-surface-muted text-fg-subtle">
                      <Folder className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-fg-muted">No folder</span>
                      <span className="block text-[11px] text-fg-subtle">
                        {pluralize(folders.data.unfiledCount, 'unfiled item')}
                      </span>
                    </span>
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        )
      ) : (
        <EmptyState
          icon={Folder}
          title="No folders yet"
          description="Create folders like Personal, Work or Servers to keep related credentials together."
          action={
            <Button size="sm" onClick={() => openCreate()}>
              <FolderPlus />
              Create a folder
            </Button>
          }
        />
      )}

      {/* Create dialog - optional parent so a folder can start inside another. */}
      <CreateFolderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultParentId={createParentId}
        folders={items}
      />

      {/* Edit / move dialog - rename and reparent in one place. */}
      <AnimatedDialog open={editing !== null} onOpenChange={(open) => setEditing(open ? editing : null)}>
        <DialogContent
          title={editing ? `Edit “${editing.name}”` : 'Edit folder'}
          description="Rename the folder or move it inside another folder."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={updateFolder.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitEdit} loading={updateFolder.isPending}>
                Save
              </Button>
            </>
          }
        >
          <Field>
            <Label htmlFor="folder-name-edit">Folder name</Label>
            <Input
              id="folder-name-edit"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitEdit();
                }
              }}
              autoFocus
              aria-invalid={nameError ? true : undefined}
            />
            <FieldError>{nameError}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="folder-parent-edit">Inside folder</Label>
            <Select
              value={editParentId ?? 'root'}
              onValueChange={(value) => setEditParentId(value === 'root' ? null : value)}
            >
              <SelectTrigger id="folder-parent-edit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Top level</SelectItem>
                {(() => {
                  const blocked = editing ? folderSubtreeIds(editing.id, items) : new Set<string>();
                  return tree
                    .filter(({ folder }) => !blocked.has(folder.id))
                    .map(({ folder, depth }) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {' '.repeat(depth * 2)}
                        {folderPath(folder, byId)}
                      </SelectItem>
                    ));
                })()}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-fg-subtle">A folder cannot be moved into itself or its own subfolders.</p>
          </Field>
        </DialogContent>
      </AnimatedDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => setDeleting(open ? deleting : null)}
        title={`Delete folder “${deleting?.name}”?`}
        description={
          deleting && (deleting.secretCount > 0 || deleting.subfolderCount > 0)
            ? [
                deleting.secretCount > 0
                  ? `This folder contains ${pluralize(deleting.secretCount, 'item')}. Choose what should happen to them.`
                  : '',
                deleting.subfolderCount > 0
                  ? `${pluralize(deleting.subfolderCount, 'Its subfolder')} ${deleting.subfolderCount === 1 ? 'is' : 'are'} kept and moved up a level.`
                  : '',
              ]
                .filter(Boolean)
                .join(' ')
            : 'This folder is empty and can be removed safely.'
        }
        confirmLabel="Delete folder"
        destructive
        loading={deleteFolder.isPending}
        onConfirm={submitDelete}
      >
        {deleting && deleting.secretCount > 0 ? (
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-line px-3 py-2.5 has-checked:border-primary has-checked:bg-primary-soft/40">
              <input
                type="radio"
                name="delete-strategy"
                checked={deleteStrategy === 'detach'}
                onChange={() => setDeleteStrategy('detach')}
                className="mt-0.5 accent-primary"
              />
              <span className="text-[13px] leading-5 text-fg">
                <span className="font-medium">Keep the items</span>
                <span className="block text-fg-muted">They are moved to “No folder” and stay in your vault.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-line px-3 py-2.5 has-checked:border-danger has-checked:bg-danger-soft/40">
              <input
                type="radio"
                name="delete-strategy"
                checked={deleteStrategy === 'delete-secrets'}
                onChange={() => setDeleteStrategy('delete-secrets')}
                className="mt-0.5 accent-danger"
              />
              <span className="text-[13px] leading-5 text-fg">
                <span className="font-medium text-danger">Delete the items too</span>
                <span className="block text-fg-muted">
                  All {deleting.secretCount} encrypted items in this folder are permanently removed.
                </span>
              </span>
            </label>
            <Badge variant="neutral" size="sm" className="w-fit">
              This choice cannot be undone
            </Badge>
          </div>
        ) : null}
      </ConfirmDialog>

      {selectedFolders.length > 0 ? (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2.5 shadow-card">
          <span className="px-1 text-[13px] font-medium text-fg">
            {pluralize(selectedFolders.length, 'folder')} selected
          </span>
          <div className="mx-1 h-5 w-px bg-line" />
          <Button size="sm" variant="secondary" onClick={() => setBulkMoveOpen(true)} disabled={bulkBusy}>
            <FolderPlus />
            Move under
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="text-danger"
            onClick={() => {
              setBulkDeleteStrategy('detach');
              setBulkDeleteOpen(true);
            }}
            disabled={bulkBusy}
          >
            <Trash2 />
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkBusy}
            aria-label="Clear selection"
          >
            Clear
          </Button>
        </div>
      ) : null}

      <AnimatedDialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent
          title={`Move ${pluralize(selectedFolders.length, 'folder')}`}
          description="Pick the folder they should live inside. Folders already inside the selection cannot be targets."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setBulkMoveOpen(false)} disabled={bulkBusy}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitBulkMove} loading={bulkMove.isPending}>
                Move
              </Button>
            </>
          }
        >
          <Field>
            <Label htmlFor="bulk-folder-parent">Inside folder</Label>
            <Select value={bulkParentId} onValueChange={setBulkParentId}>
              <SelectTrigger id="bulk-folder-parent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Top level</SelectItem>
                {(() => {
                  const blocked = new Set<string>();
                  for (const id of selectedIds) {
                    for (const sub of folderSubtreeIds(id, items)) blocked.add(sub);
                  }
                  return tree
                    .filter(({ folder }) => !blocked.has(folder.id))
                    .map(({ folder, depth }) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {'  '.repeat(depth * 2)}
                        {folderPath(folder, byId)}
                      </SelectItem>
                    ));
                })()}
              </SelectContent>
            </Select>
          </Field>
        </DialogContent>
      </AnimatedDialog>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${pluralize(selectedFolders.length, 'folder')}?`}
        description="Subfolders are kept and moved up a level. Choose what should happen to the secrets inside."
        confirmLabel="Delete folders"
        destructive
        loading={bulkDelete.isPending}
        onConfirm={submitBulkDelete}
      >
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-line px-3 py-2.5 has-checked:border-primary has-checked:bg-primary-soft/40">
            <input
              type="radio"
              name="bulk-delete-strategy"
              checked={bulkDeleteStrategy === 'detach'}
              onChange={() => setBulkDeleteStrategy('detach')}
              className="mt-0.5 accent-primary"
            />
            <span className="text-[13px] leading-5 text-fg">
              <span className="font-medium">Keep the items</span>
              <span className="block text-fg-muted">They are moved to “No folder” and stay in your vault.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-line px-3 py-2.5 has-checked:border-danger has-checked:bg-danger-soft/40">
            <input
              type="radio"
              name="bulk-delete-strategy"
              checked={bulkDeleteStrategy === 'delete-secrets'}
              onChange={() => setBulkDeleteStrategy('delete-secrets')}
              className="mt-0.5 accent-danger"
            />
            <span className="text-[13px] leading-5 text-fg">
              <span className="font-medium text-danger">Delete the items too</span>
              <span className="block text-fg-muted">
                Every encrypted item inside the selected folders is permanently removed.
              </span>
            </span>
          </label>
          <Badge variant="neutral" size="sm" className="w-fit">
            This choice cannot be undone
          </Badge>
        </div>
      </ConfirmDialog>
    </div>
  );
}
