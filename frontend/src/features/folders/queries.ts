import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { FolderDto, FolderListResponse } from '@/types/api';

export function useFolders() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['folders', activeWorkspaceId],
    enabled: activeWorkspaceId !== null,
    queryFn: () => api.get<FolderListResponse>('/folders'),
  });
}

function useInvalidateFolders() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['folders'] });
    void queryClient.invalidateQueries({ queryKey: ['secrets'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['activity'] });
  };
}

export function useCreateFolder() {
  const invalidate = useInvalidateFolders();

  return useMutation({
    mutationFn: (body: { name: string; color?: string | null; parentId?: string | null }) =>
      api.post<{ folder: FolderDto }>('/folders', body),
    onSuccess: invalidate,
  });
}

export function useUpdateFolder() {
  const invalidate = useInvalidateFolders();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string | null; parentId?: string | null }) =>
      api.patch<{ folder: FolderDto }>(`/folders/${id}`, body),
    onSuccess: invalidate,
  });
}

/**
 * Folder deletion is explicit about what happens to the secrets inside:
 * `detach` keeps them (unfiled), `delete-secrets` removes them permanently.
 */
export function useDeleteFolder() {
  const invalidate = useInvalidateFolders();

  return useMutation({
    mutationFn: ({ id, strategy }: { id: string; strategy: 'detach' | 'delete-secrets' }) =>
      api.delete<{ deleted: boolean; deletedSecrets: number; detachedSecrets: number; detachedFolders: number }>(
        `/folders/${id}`,
        { query: { strategy } },
      ),
    onSuccess: invalidate,
  });
}
