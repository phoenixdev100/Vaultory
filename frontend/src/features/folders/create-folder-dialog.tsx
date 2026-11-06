import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateFolder } from '@/features/folders/queries';
import { flattenFolderTree, folderPath } from '@/features/folders/tree';
import { ApiError } from '@/lib/api';
import type { FolderDto } from '@/types/api';

/** Parents can only hold children up to this depth (matches backend cap). */
const MAX_FOLDER_DEPTH = 3;

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preset parent - e.g. the folder currently being viewed. */
  defaultParentId?: string | null;
  folders: FolderDto[];
}

/**
 * Shared "new folder" dialog - a name plus an optional parent. Used from the
 * Folders page and from inside a folder-filtered vault so a subfolder can be
 * created in place. The form mounts fresh on every open, so no reset is needed.
 */
export function CreateFolderDialog(props: CreateFolderDialogProps) {
  return (
    <AnimatedDialog open={props.open} onOpenChange={props.onOpenChange}>
      <CreateFolderForm {...props} />
    </AnimatedDialog>
  );
}

function CreateFolderForm({ onOpenChange, defaultParentId, folders }: CreateFolderDialogProps) {
  const createFolder = useCreateFolder();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(defaultParentId ?? null);
  const [nameError, setNameError] = useState<string | null>(null);

  const tree = useMemo(() => flattenFolderTree(folders), [folders]);
  const byId = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  function submit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError('Give the folder a name');
      return;
    }
    createFolder.mutate(
      { name: trimmed, parentId },
      {
        onSuccess: () => {
          const where = parentId ? ` inside “${byId.get(parentId)?.name ?? ''}”` : '';
          toast.success(`Created folder “${trimmed}”${where}`);
          onOpenChange(false);
        },
        onError: (error) => {
          setNameError(error instanceof ApiError ? error.message : 'Could not create the folder');
        },
      },
    );
  }

  return (
    <DialogContent
      title={parentId ? `New subfolder in “${byId.get(parentId)?.name ?? ''}”` : 'New folder'}
      description="Folders keep related credentials together - they can also sit inside other folders."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={createFolder.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={createFolder.isPending}>
            Create folder
          </Button>
        </>
      }
    >
      <Field>
        <Label htmlFor="folder-name">Folder name</Label>
        <Input
          id="folder-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Servers, Work, College…"
          autoFocus
          aria-invalid={nameError ? true : undefined}
        />
        <FieldError>{nameError}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="folder-parent">Inside folder</Label>
        <Select value={parentId ?? 'root'} onValueChange={(value) => setParentId(value === 'root' ? null : value)}>
          <SelectTrigger id="folder-parent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="root">Top level</SelectItem>
            {tree
              .filter(({ depth }) => depth + 1 < MAX_FOLDER_DEPTH)
              .map(({ folder, depth }) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {'  '.repeat(depth * 2)}
                  {folderPath(folder, byId)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
    </DialogContent>
  );
}
