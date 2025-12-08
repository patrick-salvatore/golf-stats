/**
 * TanStack Query hooks for the local-first data layer
 * 
 * These hooks provide:
 * - Automatic caching via TanStack Query
 * - Optimistic updates
 * - Background refetching
 * - Offline support (reads from IndexedDB)
 */

import { useQueryClient, useQuery, useMutation } from '@tanstack/solid-query';
import { createSignal, onMount, onCleanup } from 'solid-js';
import { 
  LocalData, 
  RoundStore, 
  HoleStore, 
  ClubStore, 
  CourseStore,
  type LocalRound,
  type LocalHole,
  type LocalCourse,
} from '~/lib/local-data';

// ============ Query Keys ============

export const queryKeys = {
  // Rounds
  rounds: {
    all: ['rounds'] as const,
    active: () => [...queryKeys.rounds.all, 'active'] as const,
    synced: () => [...queryKeys.rounds.all, 'synced'] as const,
    detail: (id: number) => [...queryKeys.rounds.all, 'detail', id] as const,
  },
  // Clubs
  clubs: {
    all: ['clubs'] as const,
  },
  // Courses
  courses: {
    all: ['courses'] as const,
    search: (query: string) => [...queryKeys.courses.all, 'search', query] as const,
    detail: (id: number) => [...queryKeys.courses.all, 'detail', id] as const,
  },
  // Sync
  sync: {
    queue: ['sync', 'queue'] as const,
    count: ['sync', 'count'] as const,
  },
};

// ============ Round Hooks ============

/**
 * Get all rounds (active + synced) from local DB
 */
export function useRounds() {
  return useQuery(() => ({
    queryKey: queryKeys.rounds.all,
    queryFn: () => RoundStore.getAll(),
    staleTime: 1000 * 60, // 1 minute
  }));
}

/**
 * Get active (unsynced) rounds only
 */
export function useActiveRounds() {
  return useQuery(() => ({
    queryKey: queryKeys.rounds.active(),
    queryFn: () => RoundStore.getActive(),
    staleTime: 0, // Always fresh for active rounds
  }));
}

/**
 * Get synced rounds + fetch from server
 */
export function useSyncedRounds() {
  return useQuery(() => ({
    queryKey: queryKeys.rounds.synced(),
    queryFn: async () => {
      // First return local, then fetch from server
      if (navigator.onLine) {
        return RoundStore.fetchFromServer();
      }
      return RoundStore.getSynced();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  }));
}

/**
 * Get single round by ID
 */
export function useRound(id: () => number) {
  return useQuery(() => ({
    queryKey: queryKeys.rounds.detail(id()),
    queryFn: () => RoundStore.getById(id()),
    enabled: id() > 0,
  }));
}

/**
 * Create a new round
 */
export function useCreateRound() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (round: Omit<LocalRound, 'id' | 'syncStatus'>) => 
      RoundStore.create(round),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.active() });
    },
  }));
}

/**
 * Update a round
 */
export function useUpdateRound() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<LocalRound> }) =>
      RoundStore.update(id, changes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.detail(id) });
    },
  }));
}

/**
 * Delete a round
 */
export function useDeleteRound() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (id: number) => RoundStore.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.active() });
    },
  }));
}

/**
 * Sync a round to server
 */
export function useSyncRound() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (id: number) => RoundStore.syncToServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.active() });
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.synced() });
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.count });
    },
  }));
}

// ============ Hole Hooks ============

/**
 * Get holes for a round
 */
export function useHolesForRound(roundId: () => number) {
  return useQuery(() => ({
    queryKey: [...queryKeys.rounds.detail(roundId()), 'holes'] as const,
    queryFn: () => HoleStore.getForRound(roundId()),
    enabled: roundId() > 0,
  }));
}

/**
 * Add or update a hole
 */
export function useUpsertHole() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: ({ roundId, hole }: { roundId: number; hole: Omit<LocalHole, 'id'> }) =>
      HoleStore.addOrUpdate(roundId, hole),
    onSuccess: (_, { roundId }) => {
      queryClient.invalidateQueries({ 
        queryKey: [...queryKeys.rounds.detail(roundId), 'holes'] 
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.detail(roundId) });
    },
  }));
}

/**
 * Save all holes for a round
 */
export function useSaveHoles() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: ({ roundId, holes }: { roundId: number; holes: Omit<LocalHole, 'id'>[] }) =>
      HoleStore.saveAll(roundId, holes),
    onSuccess: (_, { roundId }) => {
      queryClient.invalidateQueries({ 
        queryKey: [...queryKeys.rounds.detail(roundId), 'holes'] 
      });
    },
  }));
}

// ============ Club Hooks ============

/**
 * Get all clubs from local DB
 * Fetches from server on mount if online
 */
export function useClubs() {
  return useQuery(() => ({
    queryKey: queryKeys.clubs.all,
    queryFn: async () => {
      // Try to fetch from server first if online
      if (navigator.onLine) {
        return ClubStore.fetchFromServer();
      }
      // Fall back to local
      return ClubStore.getAll();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  }));
}

/**
 * Create a bag (set of clubs)
 */
export function useCreateBag() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (bag: Record<string, string>) => ClubStore.createBag(bag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all });
    },
  }));
}

// ============ Course Hooks ============

/**
 * Get all locally cached courses
 */
export function useCourses() {
  return useQuery(() => ({
    queryKey: queryKeys.courses.all,
    queryFn: () => CourseStore.getAll(),
  }));
}

/**
 * Search courses (server + local fallback)
 */
export function useCourseSearch(query: () => string) {
  return useQuery(() => ({
    queryKey: queryKeys.courses.search(query()),
    queryFn: () => CourseStore.search(query()),
    enabled: query().length >= 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  }));
}

/**
 * Get single course by server ID
 */
export function useCourse(serverId: () => number) {
  return useQuery(() => ({
    queryKey: queryKeys.courses.detail(serverId()),
    queryFn: () => CourseStore.fetchById(serverId()),
    enabled: serverId() > 0,
  }));
}

/**
 * Create a new course
 */
export function useCreateCourse() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (course: Omit<LocalCourse, 'id' | 'serverId' | 'syncStatus'>) =>
      CourseStore.create(course),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  }));
}

// ============ Sync Hooks ============

/**
 * Get pending sync queue count
 */
export function useSyncQueueCount() {
  return useQuery(() => ({
    queryKey: queryKeys.sync.count,
    queryFn: () => LocalData.getSyncQueueCount(),
    refetchInterval: 10000, // Check every 10 seconds
  }));
}

/**
 * Get all pending sync items
 */
export function useSyncQueue() {
  return useQuery(() => ({
    queryKey: queryKeys.sync.queue,
    queryFn: () => LocalData.getPendingSyncItems(),
  }));
}

/**
 * Trigger a full sync
 */
export function useProcessSync() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: () => LocalData.processSync(),
    onSuccess: () => {
      // Invalidate all queries after sync
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.queue });
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.count });
    },
  }));
}

// ============ Online Status Hook ============

/**
 * Track online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);
  
  onMount(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    onCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  });
  
  return isOnline;
}

// ============ Combined Data Hook ============

/**
 * Main hook that provides access to all local-first data
 */
export function useLocalData() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  
  return {
    // Online status
    isOnline,
    
    // Query client for manual operations
    queryClient,
    
    // Invalidate helpers
    invalidateRounds: () => queryClient.invalidateQueries({ queryKey: queryKeys.rounds.all }),
    invalidateClubs: () => queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all }),
    invalidateCourses: () => queryClient.invalidateQueries({ queryKey: queryKeys.courses.all }),
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
    
    // Trigger sync
    sync: () => LocalData.processSync(),
  };
}
