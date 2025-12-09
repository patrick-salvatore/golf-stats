import { createContext, useContext, type Accessor } from 'solid-js';
import { createMemo, type JSX } from 'solid-js';
import { useClubsQuery, useRoundsQuery } from '~/hooks/use_local_data';
import { RoundStore, type LocalClub, type LocalRound } from '~/lib/local-data';

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

  return (
    <RoundContext.Provider value={{ syncRound, rounds, pastRounds, clubs }}>
      {props.children}
    </RoundContext.Provider>
  );
}

interface AppContextValue {
  syncRound: (roundId: number) => Promise<void>;
  pastRounds: Accessor<LocalRound[]>;
  rounds: Accessor<LocalRound[]>;
  clubs: Accessor<LocalClub[]>;
}

export const RoundContext = createContext<AppContextValue>();

export function useAppContext() {
  const context = useContext(RoundContext);
  if (!context) {
    throw new Error('useRounds must be used within a AppProvider');
  }
  return context;
}
