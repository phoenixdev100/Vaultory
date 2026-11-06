import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getActiveWorkspaceId, setActiveWorkspaceId } from '@/lib/api';
import { useAuth } from '@/features/auth/auth-context';
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context';
import type { WorkspaceDto, WorkspaceListResponse } from '@/types/api';

/**
 * Loads the account's workspaces and owns the "active" selection. The active
 * id is mirrored into the API client (X-Workspace-Id header) and every
 * workspace-scoped query key, so data from one organisation can never appear
 * inside another - a switch is just a different cache key + a different
 * header, no shared cache to leak through.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const authenticated = status === 'authenticated';

  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<WorkspaceListResponse>('/workspaces'),
    enabled: authenticated,
    staleTime: 60_000,
  });
  const workspaces = useMemo(() => data?.items ?? [], [data]);

  // Seeded from the api module, which already restored the persisted
  // selection - a reload keeps the user inside the same organisation.
  const [selectedId, setSelectedId] = useState<string | null>(() => getActiveWorkspaceId());

  // The resolved scope: the explicit selection when it still exists, else the
  // default workspace. Derived during render, so a stale localStorage id, a
  // workspace deleted on another device or a previous user's leftover can
  // never escape into query keys.
  const fallback = workspaces.find((w) => w.isDefault) ?? workspaces[0];
  const activeWorkspace = authenticated
    ? (workspaces.find((w) => w.id === selectedId) ?? fallback)
    : undefined;
  const activeWorkspaceId = activeWorkspace?.id ?? null;

  // Mirror the resolved scope into the API client (header + persistence).
  // Skipped while the list is still loading - the persisted module value is
  // already correct, and clobbering it would unscope in-flight requests.
  useEffect(() => {
    if (activeWorkspaceId !== null) setActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      if (!workspaces.some((w) => w.id === id)) return;
      // Module state first so the next request is already scoped; React state
      // follows and flips the query keys on the same tick.
      setActiveWorkspaceId(id);
      setSelectedId(id);
    },
    [workspaces],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      loading: authenticated && isLoading && workspaces.length === 0,
      setActiveWorkspace,
    }),
    [workspaces, activeWorkspaceId, activeWorkspace, authenticated, isLoading, setActiveWorkspace],
  );

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export type { WorkspaceDto };
