import { useCallback, useState } from 'react';
import { LayoutGrid, List, type LucideIcon } from 'lucide-react';

export type ViewMode = 'list' | 'grid';

/**
 * Per-page list/grid preference. Persisted in localStorage so whichever view
 * the user last picked stays active across reloads until they change it.
 */
export function useViewMode(storageKey: string, fallback: ViewMode = 'list') {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === 'grid' || stored === 'list' ? stored : fallback;
    } catch {
      return fallback;
    }
  });

  const set = useCallback(
    (next: ViewMode) => {
      setMode(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  );

  return [mode, set] as const;
}

export const VIEW_MODE_OPTIONS: Array<{ value: ViewMode; label: string; icon: LucideIcon }> = [
  { value: 'list', label: 'List view', icon: List },
  { value: 'grid', label: 'Grid view', icon: LayoutGrid },
];
