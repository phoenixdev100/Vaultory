import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WorkspaceDto } from '@/types/api';

function useInvalidateWorkspaces() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    void queryClient.invalidateQueries({ queryKey: ['secrets'] });
    void queryClient.invalidateQueries({ queryKey: ['folders'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['trash'] });
    void queryClient.invalidateQueries({ queryKey: ['activity'] });
  };
}

export function useCreateWorkspace() {
  const invalidate = useInvalidateWorkspaces();
  return useMutation({
    mutationFn: (body: { name: string; color?: string | null }) =>
      api.post<{ workspace: WorkspaceDto }>('/workspaces', body),
    onSuccess: invalidate,
  });
}

export function useUpdateWorkspace() {
  const invalidate = useInvalidateWorkspaces();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string | null }) =>
      api.patch<{ workspace: WorkspaceDto }>(`/workspaces/${id}`, body),
    onSuccess: invalidate,
  });
}

/** `delete-contents` hard-deletes everything inside the workspace. */
export function useDeleteWorkspace() {
  const invalidate = useInvalidateWorkspaces();
  return useMutation({
    mutationFn: ({ id, strategy }: { id: string; strategy: 'require-empty' | 'delete-contents' }) =>
      api.delete<{ deleted: boolean; removedItems: number }>(`/workspaces/${id}`, {
        query: { strategy },
      }),
    onSuccess: invalidate,
  });
}
