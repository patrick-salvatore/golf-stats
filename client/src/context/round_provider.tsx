import { createSignal, createMemo, type JSX } from 'solid-js';
import { useSyncedRounds, useClubs } from '~/hooks/use_local_data';
import { RoundStore} from '~/lib/local-data';
import { SyncStatus } from '~/lib/db';
import type { LocalRound } from '~/lib/local-data';

export function RoundProvider(props: { children: JSX.Element }) {
  // Local active rounds (not yet synced)
  const [localRounds, setLocalRounds] = createSignal<LocalRound[]>([]);

  // Server rounds query (uses new local-first hooks)
  const roundsQuery = useSyncedRounds();

  // Clubs query (syncs clubs from server)
  const clubsQuery = useClubs();

  const syncClubs = async () => {
    try {
      // Also refetch via query to update UI
      await clubsQuery.refetch();
    } catch (e) {
      console.error('Failed to sync clubs', e);
    }
  };

  const syncRounds = async () => {
    const rounds = await RoundStore.getActive();
    setLocalRounds(rounds);
  };

  // Sync from Cloud to Local cache (on startup)
  const syncDown = async () => {
    try {
      // Fetch rounds from server and merge with local
      await RoundStore.fetchFromServer();
      // Also refetch via query to update UI
      await roundsQuery.refetch();
      console.log('Sync Down Complete');
    } catch (e) {
      console.error('Sync Down Failed', e);
    }
  };

  const syncRound = async (roundId: number) => {
    try {
      // Use the new RoundStore.syncToServer which handles everything
      await RoundStore.syncToServer(roundId);

      // Refresh both local and server rounds
      await syncRounds();
      await roundsQuery.refetch();

      window.location.href = '/';
    } catch (e) {
      console.error(e);
    }
  };

  // Active = local rounds not yet synced (syncStatus === PENDING)
  const activeRounds = createMemo(() => {
    return localRounds()
      .filter((r): r is LocalRound & { id: number } => r.id !== undefined)
      .map((r) => ({
        id: r.id,
        courseId: r.courseId,
        courseName: r.courseName,
        date: r.date,
        totalScore: r.totalScore,
        synced: r.syncStatus === SyncStatus.SYNCED ? 1 : 0, // backward compat
        createdAt: r.createdAt,
        endedAt: r.endedAt,
      }));
  });

  // Past = synced rounds from server (already in camelCase from LocalRound)
  const pastRounds = createMemo(() => {
    const serverRounds = roundsQuery.data ?? [];
    return serverRounds
      .filter((r): r is LocalRound & { id: number } => r.id !== undefined)
      .map((r) => ({
        id: r.id,
        courseId: r.courseId,
        courseName: r.courseName,
        date: r.date,
        totalScore: r.totalScore,
        synced: 1 as const,
        createdAt: r.createdAt,
        endedAt: r.endedAt,
      }));
  });

  const refetchRounds = () => {
    roundsQuery.refetch();
    syncRounds();
  };

  return (
    <RoundContext.Provider
      value={{
        activeRounds,
        pastRounds,
        refetchRounds,
        syncRound,
        syncDown,
        syncClubs,
      }}
    >
      {props.children}
    </RoundContext.Provider>
  );
}


import {
  createContext,
  useContext,
  type Accessor,
} from "solid-js";

// Combined round type for context consumers
export interface Round {
  id: number;
  courseId?: number;
  courseName: string;
  date: string;
  totalScore: number;
  synced: number; // 0 = active/local, 1 = synced to server
  createdAt?: string;
  endedAt?: string;
}

interface RoundContextValue {
  activeRounds: Accessor<Round[]>;
  pastRounds: Accessor<Round[]>;
  refetchRounds: () => void;
  syncRound: (roundId: number) => Promise<void>;
  syncDown: () => Promise<void>;
  syncClubs: () => Promise<void>;
}

export const RoundContext = createContext<RoundContextValue>();

export function useRounds() {
  const context = useContext(RoundContext);
  if (!context) {
    throw new Error("useRounds must be used within a RoundProvider");
  }
  return context;
}
