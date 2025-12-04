import { createContext, useContext, createResource, type Accessor, type JSX } from "solid-js";
import { db, type Round } from "../db";

interface RoundContextValue {
  activeRounds: Accessor<Round[]>;
  pastRounds: Accessor<Round[]>;
  refetchRounds: () => void;
  syncRound: (roundId: number) => Promise<void>;
}

const RoundContext = createContext<RoundContextValue>();

export function RoundProvider(props: { children: JSX.Element }) {
  const fetchRounds = async () => {
    return await db.rounds.orderBy('date').reverse().toArray();
  };

  const [rounds, { refetch }] = createResource(fetchRounds);

  const activeRounds = () => rounds()?.filter(r => r.completed === 0) || [];
  const pastRounds = () => rounds()?.filter(r => r.completed === 1) || [];

  const syncRound = async (roundId: number) => {
    try {
      const round = await db.rounds.get(roundId);
      if (!round) return;

      const holes = await db.holes.where('roundId').equals(roundId).toArray();
      
      const payload = {
        round: {
          ...round,
          holes
        }
      };

      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await db.rounds.update(roundId, { synced: 1 });
        refetch();
        alert('Round synced successfully!');
      } else {
        const error = await response.text();
        alert('Failed to sync: ' + error);
      }
    } catch (e) {
      console.error(e);
      alert('Error syncing round');
    }
  };

  return (
    <RoundContext.Provider value={{ activeRounds, pastRounds, refetchRounds: refetch, syncRound }}>
      {props.children}
    </RoundContext.Provider>
  );
}

export function useRounds() {
  const context = useContext(RoundContext);
  if (!context) {
    throw new Error("useRounds must be used within a RoundProvider");
  }
  return context;
}
