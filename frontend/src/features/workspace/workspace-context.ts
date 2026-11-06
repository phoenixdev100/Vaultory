import { createContext, use } from 'react';
import type { WorkspaceDto } from '@/types/api';

export interface WorkspaceContextValue {
  /** All workspaces the account owns - default (Personal) first. */
  workspaces: WorkspaceDto[];
  /** The workspace every scoped query currently operates inside. */
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceDto | undefined;
  /** True until the workspace list has loaded once. */
  loading: boolean;
  setActiveWorkspace: (id: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = use(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}
