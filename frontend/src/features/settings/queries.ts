import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SettingsResponse } from '@/types/api';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsResponse>('/settings'),
  });
}
