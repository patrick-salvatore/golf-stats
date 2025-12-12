import { createContext, useContext, type Accessor } from 'solid-js';
import { createMemo, type JSX } from 'solid-js';
import { useClubsQuery, useRoundsQuery } from '~/hooks/use_local_data';
import { RoundStore, type LocalClub, type LocalRound } from '~/lib/stores';

export function AppProvider(props: { children: JSX.Element }) {
  const rounds = useRoundsQuery();
  const clubs = useClubsQuery();

  const syncRound = async (roundId: number) => {
    try {
      await RoundStore.syncToServer(roundId);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRound = async () => {};

  // Past = synced rounds from server (already in camelCase from LocalRound)
  const pastRounds = createMemo(() => {
    const serverRounds = rounds() ?? [];
    return serverRounds
      .filter((r): r is LocalRound & { id: number } => r.id !== undefined)
      .map((r) => ({
        id: r.id,
        courseId: r.courseId,
        courseName: r.courseName,
        date: r.date,
        totalScore: r.totalScore,
        syncStatus: 1 as const,
        createdAt: r.createdAt,
        endedAt: r.endedAt,
      }));
  });

  const activeRound = createMemo(() => {
    const allRounds = rounds() ?? [];
    // Find round that is not ended (no endedAt)
    // Sort by date descending to get the most recent one
    return allRounds
      .filter((r) => !r.endedAt)
      .sort((a, b) => {
        const dateA = new Date(a.createdAt ?? 0).getTime();
        const dateB = new Date(b.createdAt ?? 0).getTime();
        return dateB - dateA;
      })[0];
  });

  return (
    <RoundContext.Provider
      value={{ syncRound, rounds, pastRounds, clubs, activeRound, deleteRound }}
    >
      {props.children}
    </RoundContext.Provider>
  );
}

interface AppContextValue {
  syncRound: (roundId: number) => Promise<void>;
  pastRounds: Accessor<LocalRound[]>;
  rounds: Accessor<LocalRound[]>;
  clubs: Accessor<LocalClub[]>;
  activeRound: Accessor<LocalRound>;
  deleteRound: (roundId: number) => Promise<void>;
}

export const RoundContext = createContext<AppContextValue>();

export function useAppContext() {
  const context = useContext(RoundContext);
  if (!context) {
    throw new Error('useRounds must be used within a AppProvider');
  }
  return context;
}
