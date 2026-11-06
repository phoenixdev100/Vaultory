import { Check, ChevronDown, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDeleteWorkspace } from './queries';
import { useWorkspace } from './workspace-context';
import { WorkspaceDialog } from './workspace-dialog';
import type { WorkspaceDto } from '@/types/api';
import { Button } from '@/components/ui/button';

function OrgDot({ color, className }: { color: string | null; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color ?? 'var(--primary)' }}
    />
  );
}

/**
 * Organisation switcher - lives at the top of the nav, visually and
 * functionally separate from folders (folders live *inside* a workspace).
 * Switching only changes the workspace scope; nothing is merged or moved.
 */
export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { workspaces, activeWorkspace, activeWorkspaceId, setActiveWorkspace } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  if (!activeWorkspace) {
    return collapsed ? <div className="mx-auto size-8 rounded-[var(--radius-control)] bg-surface-muted" /> : null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Switch organisation - currently ${activeWorkspace.name}`}
            title={collapsed ? activeWorkspace.name : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-1.5 text-left text-[13px] font-medium text-fg transition-colors hover:bg-surface-muted',
              collapsed && 'justify-center border-transparent bg-transparent px-0 hover:bg-surface-muted',
            )}
          >
            <OrgDot color={activeWorkspace.color} />
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1 truncate">{activeWorkspace.name}</span>
                <ChevronDown className="size-3.5 shrink-0 text-fg-subtle" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-60">
          <DropdownMenuLabel>Organisations</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} onSelect={() => setActiveWorkspace(workspace.id)}>
              <OrgDot color={workspace.color} />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id === activeWorkspaceId ? (
                <Check className="size-3.5 shrink-0 text-primary" />
              ) : (
                <span className="text-[11px] text-fg-subtle">{workspace.secretCount ?? 0}</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus />
            New organisation
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            <Layers />
            Manage organisations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ManageWorkspacesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
}

/** Lists every workspace with rename/delete - the management counterpart of the switcher. */
function ManageWorkspacesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const [editing, setEditing] = useState<WorkspaceDto | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceDto | null>(null);

  const contents = (deleting?.secretCount ?? 0) + (deleting?.folderCount ?? 0);

  function confirmDelete() {
    if (!deleting) return;
    deleteWorkspace.mutate(
      { id: deleting.id, strategy: contents > 0 ? 'delete-contents' : 'require-empty' },
      {
        onSuccess: () => {
          toast.success(
            contents > 0
              ? `Deleted “${deleting.name}” and its ${contents} item${contents === 1 ? '' : 's'}`
              : `Deleted organisation “${deleting.name}”`,
          );
          if (deleting.id === activeWorkspaceId) {
            const fallback = workspaces.find((w) => w.isDefault && w.id !== deleting.id) ?? workspaces[0];
            if (fallback && fallback.id !== deleting.id) setActiveWorkspace(fallback.id);
          }
          setDeleting(null);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Could not delete the organisation.');
        },
      },
    );
  }

  return (
    <>
      <AnimatedDialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title="Manage organisations"
          description="Rename or remove organisations. Deleting one with items inside removes those items permanently."
        >
          <ul className="flex flex-col gap-1.5">
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-line px-3 py-2"
              >
                <OrgDot color={workspace.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">
                    {workspace.name}
                    {workspace.isDefault ? <span className="ml-1.5 text-[11px] text-fg-subtle">(default)</span> : null}
                  </p>
                  <p className="text-[11px] text-fg-subtle">
                    {workspace.secretCount ?? 0} item{(workspace.secretCount ?? 0) === 1 ? '' : 's'} ·{' '}
                    {workspace.folderCount ?? 0} folder{(workspace.folderCount ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(workspace)} aria-label={`Rename ${workspace.name}`}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleting(workspace)}
                  disabled={workspace.isDefault}
                  aria-label={`Delete ${workspace.name}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </AnimatedDialog>

      {editing ? (
        <WorkspaceDialog open onOpenChange={(openState) => !openState && setEditing(null)} workspace={editing} />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(openState) => !openState && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description={
          contents > 0
            ? `This organisation still contains ${deleting?.secretCount ?? 0} item(s) and ${deleting?.folderCount ?? 0} folder(s). Everything inside will be permanently deleted - this cannot be undone.`
            : 'This empty organisation will be permanently deleted.'
        }
        confirmLabel={contents > 0 ? 'Delete everything' : 'Delete'}
        destructive
        loading={deleteWorkspace.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
