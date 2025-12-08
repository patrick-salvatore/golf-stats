import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query';
import * as roundApi from '~/api/rounds';

// Query keys factory
export const ROUND_QUERY_KEYS = {
  ALL: ['rounds'] as const,
  LIST: ['rounds', 'list'] as const,
  DETAILS: (id: number) => ['rounds', 'detail', id] as const,
};

// Server round type (from API)
export interface ServerRound {
  id: number;
  course_id?: number;
  course_name: string;
  date: string;
  total_score: number;
  created_at?: string;
  ended_at?: string;
  holes?: ServerHole[];
}

export interface ServerHole {
  id: number;
  hole_number: number;
  par: number;
  score: number;
  putts: number;
  fairway_status?: 'hit' | 'left' | 'right';
  gir_status?: 'hit' | 'long' | 'short' | 'left' | 'right';
  fairway_bunker: boolean;
  greenside_bunker: boolean;
  proximity_to_hole?: number;
  club_ids?: number[];
}

/**
 * Fetch all synced rounds from server
 */
export function useRoundsQuery() {
  return useQuery(() => ({
    queryKey: ROUND_QUERY_KEYS.LIST,
    queryFn: async (): Promise<ServerRound[]> => roundApi.getRounds(),
  }));
}

/**
 * Create/sync a round to server
 */
export function useCreateRoundMutation() {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (payload: {
      course_id?: number;
      course_name: string;
      total_score: number;
      date: string;
      created_at?: string;
      ended_at?: string;
      holes: {
        hole_number: number;
        par: number;
        score: number;
        putts: number;
        fairway_status?: string;
        gir_status?: string;
        fairway_bunker: boolean;
        greenside_bunker: boolean;
        proximity_to_hole?: number;
        club_ids?: number[];
      }[];
    }) => {
      return await roundApi.createRound(payload);
    },
    onSuccess: () => {
      // Invalidate rounds list to refetch from server
      queryClient.invalidateQueries({ queryKey: ROUND_QUERY_KEYS.ALL });
    },
  }));
}
