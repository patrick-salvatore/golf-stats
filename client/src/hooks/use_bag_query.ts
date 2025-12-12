import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query';
import * as bagApi from '~/api/bag';
import { ClubStore, type ServerClub } from '~/lib/stores';

// Query keys factory
export const BAG_QUERY_KEYS = {
  ALL: ['bag'] as const,
};

/**
 * Fetch user's bag (clubs) from server
 * Also caches to local storage for offline access
 */
export function useBagQuery() {
  return useQuery(() => ({
    queryKey: BAG_QUERY_KEYS.ALL,
    queryFn: async (): Promise<ServerClub[]> => {
      const clubs = await bagApi.getBag();
      // Also save to local storage for offline access
      if (clubs && Array.isArray(clubs)) {
        await ClubStore.setFromServer(clubs);
      }
      return clubs ?? [];
    },
  }));
}

/**
 * Create a new bag for user
 */
export function useCreateBagMutation() {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (bag: Record<string, string>) => {
      return await bagApi.createBag(bag);
    },
    onSuccess: (data) => {
      // Update local cache
      if (data && Array.isArray(data)) {
        ClubStore.setFromServer(data);
      }
      // Invalidate bag query to refetch
      queryClient.invalidateQueries({ queryKey: BAG_QUERY_KEYS.ALL });
    },
  }));
}
