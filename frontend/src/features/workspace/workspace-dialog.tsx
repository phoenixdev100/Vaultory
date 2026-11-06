import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useCreateWorkspace, useUpdateWorkspace } from './queries';
import type { WorkspaceDto } from '@/types/api';

const ORG_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provided for rename; absent means "create". */
  workspace?: WorkspaceDto;
}

/**
 * Shared create/rename dialog for workspaces ("organisations"). The form
 * mounts fresh on every open, so no reset is needed.
 */
export function WorkspaceDialog(props: WorkspaceDialogProps) {
  return (
    <AnimatedDialog open={props.open} onOpenChange={props.onOpenChange}>
      <WorkspaceForm {...props} />
    </AnimatedDialog>
  );
}

function WorkspaceForm({ onOpenChange, workspace }: WorkspaceDialogProps) {
  const createWorkspace = useCreateWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const [name, setName] = useState(workspace?.name ?? '');
  const [color, setColor] = useState<string | null>(workspace?.color ?? null);
  const [nameError, setNameError] = useState<string | null>(null);
  const editing = Boolean(workspace);
  const pending = createWorkspace.isPending || updateWorkspace.isPending;

  function submit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError('Give the organisation a name');
      return;
    }
    const onError = (error: unknown) => {
      setNameError(error instanceof ApiError ? error.message : 'Could not save the organisation.');
    };
    if (editing && workspace) {
      updateWorkspace.mutate(
        { id: workspace.id, name: trimmed, color },
        {
          onSuccess: () => {
            toast.success(`Renamed to “${trimmed}”`);
            onOpenChange(false);
          },
          onError,
        },
      );
    } else {
      createWorkspace.mutate(
        { name: trimmed, color },
        {
          onSuccess: () => {
            toast.success(`Created organisation “${trimmed}”`);
            onOpenChange(false);
          },
          onError,
        },
      );
    }
  }

  return (
    <DialogContent
      title={editing ? 'Rename organisation' : 'New organisation'}
      description={
        editing
          ? 'Update the name or colour. Items inside the organisation are not affected.'
          : 'Organisations keep credentials fully separate - items saved in one never appear in another.'
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={pending}>
            {editing ? 'Save' : 'Create organisation'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <Field>
          <Label htmlFor="workspace-name">Name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(null);
            }}
            placeholder="e.g. Work, Client projects, Home lab"
            maxLength={60}
            autoFocus
          />
          {nameError ? <FieldError>{nameError}</FieldError> : null}
        </Field>

        <Field>
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {ORG_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(color === option ? null : option)}
                aria-label={`Colour ${option}`}
                aria-pressed={color === option}
                className="size-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: option,
                  borderColor: color === option ? 'var(--fg)' : 'transparent',
                }}
              />
            ))}
          </div>
        </Field>
      </form>
    </DialogContent>
  );
}
