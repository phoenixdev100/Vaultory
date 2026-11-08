import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ActivityListResponse } from '@/types/api';

export function useActivity(limit = 50) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => api.get<ActivityListResponse>('/activity', { query: { limit } }),
  });
}
