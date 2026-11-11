import { Building2, Copy, FolderInput, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { Field, Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { flattenFolderTree, folderPath } from '@/features/folders/tree';
import { useWorkspace } from '@/features/workspace/workspace-context';
import {
  useBulkDeleteSecrets,
  useBulkDuplicateSecrets,
  useBulkUpdateSecrets,
} from '@/features/vault/queries';
import { ApiError } from '@/lib/api';
import { pluralize } from '@/lib/format';
import type { DecryptedSecret, FolderDto } from '@/types/api';

interface SecretBulkBarProps {
  /** Selected secret rows - used for ids and the favourite toggle state. */
  secrets: DecryptedSecret[];
  folders: FolderDto[];
  onClear: () => void;
}

/** Floating action bar shown while a vault selection is active. */
export function SecretBulkBar({ secrets, folders, onClear }: SecretBulkBarProps) {
  const { workspaces, activeWorkspace } = useWorkspace();
  const bulkUpdate = useBulkUpdateSecrets();
  const bulkDelete = useBulkDeleteSecrets();
  const bulkDuplicate = useBulkDuplicateSecrets();

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState<string>('none');
  const [moveOrgId, setMoveOrgId] = useState<string>('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const ids = secrets.map((secret) => secret.id);
  const count = ids.length;
  const allFavorite = secrets.every((secret) => secret.isFavorite);
  const flatFolders = flattenFolderTree(folders);
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const otherOrgs = workspaces.filter((workspace) => workspace.id !== activeWorkspace?.id);

  const busy = bulkUpdate.isPending || bulkDelete.isPending || bulkDuplicate.isPending;

  function handleFavorite() {
    bulkUpdate.mutate(
      { ids, isFavorite: !allFavorite },
      {
        onSuccess: (result) => {
          toast.success(result.updated > 0 ? `${pluralize(result.updated, 'item')} updated` : 'Nothing to update');
          onClear();
        },
        onError: () => toast.error('Could not update the selection'),
      },
    );
  }

  function handleDuplicate() {
    bulkDuplicate.mutate(ids, {
      onSuccess: (result) => {
        toast.success(`${pluralize(result.created, 'copy')} created`);
        onClear();
      },
      onError: (error) =>
        toast.error('Could not duplicate', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  }

  function handleMove() {
    const folderId = moveFolderId === 'none' ? null : moveFolderId;
    const workspaceId = moveOrgId || undefined;
    if (folderId === null && !workspaceId) {
      toast.error('Pick a folder or an organisation first');
      return;
    }
    bulkUpdate.mutate(
      { ids, folderId, workspaceId },
      {
        onSuccess: (result) => {
          toast.success(`${pluralize(result.updated, 'item')} moved`);
          setMoveOpen(false);
          onClear();
        },
        onError: (error) =>
          toast.error('Could not move the selection', {
            description: error instanceof ApiError ? error.message : undefined,
          }),
      },
    );
  }

  function handleDelete() {
    bulkDelete.mutate(ids, {
      onSuccess: (result) => {
        toast.success(`${pluralize(result.trashed, 'item')} moved to the trash`);
        setDeleteOpen(false);
        onClear();
      },
      onError: (error) =>
        toast.error('Could not delete the selection', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  }

  return (
    <>
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2.5 shadow-card">
        <span className="px-1 text-[13px] font-medium text-fg">
          {pluralize(count, 'item')} selected
        </span>
        <div className="mx-1 h-5 w-px bg-line" />

        <Button size="sm" variant="secondary" onClick={() => setMoveOpen(true)} disabled={busy}>
          <FolderInput />
          Move
        </Button>
        <Button size="sm" variant="secondary" onClick={handleFavorite} loading={bulkUpdate.isPending} disabled={busy}>
          <Star className={allFavorite ? 'fill-warning text-warning' : undefined} />
          {allFavorite ? 'Unfavorite' : 'Favorite'}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleDuplicate} loading={bulkDuplicate.isPending} disabled={busy}>
          <Copy />
          Duplicate
        </Button>
        <Button size="sm" variant="secondary" className="text-danger" onClick={() => setDeleteOpen(true)} disabled={busy}>
          <Trash2 />
          Trash
        </Button>

        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear} disabled={busy} aria-label="Clear selection">
          <X />
          Clear
        </Button>
      </div>

      <AnimatedDialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent
          title={`Move ${pluralize(count, 'item')}`}
          description="Pick a destination folder, an organisation, or both. Items keep their encrypted contents - only their filing changes."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setMoveOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleMove} loading={bulkUpdate.isPending}>
                Move
              </Button>
            </>
          }
        >
          <Field>
            <Label htmlFor="bulk-move-folder">Folder</Label>
            <Select value={moveFolderId} onValueChange={setMoveFolderId}>
              <SelectTrigger id="bulk-move-folder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder</SelectItem>
                {flatFolders.map(({ folder }) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folderPath(folder, folderById)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {otherOrgs.length > 0 ? (
            <Field>
              <Label htmlFor="bulk-move-org">Organisation</Label>
              <Select value={moveOrgId} onValueChange={setMoveOrgId}>
                <SelectTrigger id="bulk-move-org">
                  <SelectValue placeholder="Stay in this organisation" />
                </SelectTrigger>
                <SelectContent>
                  {otherOrgs.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id} icon={<Building2 />}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </DialogContent>
      </AnimatedDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Move ${pluralize(count, 'item')} to the trash?`}
        description="They stay recoverable for 30 days from the Trash page. After that they are permanently removed."
        confirmLabel="Move to trash"
        destructive
        loading={bulkDelete.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
