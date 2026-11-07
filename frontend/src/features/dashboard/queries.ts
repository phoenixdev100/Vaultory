import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HeatmapResponse, SessionDto } from '@/types/api';

export function useActivityHeatmap(days = 371) {
  return useQuery({
    queryKey: ['activity-heatmap', days],
    queryFn: () => api.get<HeatmapResponse>(`/activity/heatmap?days=${days}`),
    staleTime: 60_000,
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<{ items: SessionDto[] }>('/auth/sessions'),
    staleTime: 60_000,
  });
}
