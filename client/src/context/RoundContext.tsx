import { createContext, useContext, createResource, type Accessor, type JSX, onMount } from "solid-js";
import { db, type Round } from "../db";

interface RoundContextValue {
  activeRounds: Accessor<Round[]>;
  pastRounds: Accessor<Round[]>;
  refetchRounds: () => void;
  syncRound: (roundId: number) => Promise<void>;
  syncDown: () => Promise<void>;
}

const RoundContext = createContext<RoundContextValue>();

export function RoundProvider(props: { children: JSX.Element }) {
  // Fetch rounds from Local DB
  const fetchRounds = async () => {
    return await db.rounds.orderBy('date').reverse().toArray();
  };

  const [rounds, { refetch }] = createResource(fetchRounds);

  // Active = Not Synced (synced === 0)
  // Past = Synced (synced === 1)
  const activeRounds = () => {
    return rounds()?.filter(r => r.synced === 0).sort((a, b) => {
        // Sort by createdAt descending
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    }) || [];
  };
  const pastRounds = () => rounds()?.filter(r => r.synced === 1) || [];

  // Sync from Cloud to Local (On Startup)
  const syncDown = async () => {
    try {
      const response = await fetch('/api/rounds');
      if (!response.ok) return; // Maybe offline

      const cloudRounds = await response.json();
      
      // Upsert rounds into local DB
      await db.transaction('rw', db.rounds, db.holes, async () => {
        for (const r of cloudRounds.data) {
          // Check if round exists locally
          const existing = await db.rounds.get(r.id);
          
          if (!existing) {
             // Insert new round from cloud
             await db.rounds.put({
                id: r.id, // Use cloud ID
                courseName: r.course_name,
                date: r.date,
                totalScore: r.total_score,
                synced: 1, // It came from cloud, so it is synced
                createdAt: r.created_at,
                endedAt: r.ended_at
             });

             // Insert holes
             if (r.holes) {
               for (const h of r.holes) {
                  await db.holes.put({
                    id: h.id,
                    roundId: r.id,
                    holeNumber: h.hole_number,
                    par: h.par,
                    score: h.score,
                    putts: h.putts,
                    fairwayStatus: h.fairway_status,
                    girStatus: h.gir_status,
                    fairwayBunker: h.fairway_bunker,
                    greensideBunker: h.greenside_bunker,
                    proximityToHole: h.proximity_to_hole,
                    // Map legacy fields if needed, or leave undefined
                    fairwayHit: h.fairway_hit,
                    gir: h.gir
                  });
               }
             }
          }
        }
      });
      refetch();
      console.log("Sync Down Complete");
    } catch (e) {
      console.error("Sync Down Failed", e);
    }
  };

  onMount(() => {
    syncDown();
  });

  const syncRound = async (roundId: number) => {
    try {
      const round = await db.rounds.get(roundId);
      if (!round) return;

      const holes = await db.holes.where('roundId').equals(roundId).toArray();
      
      const payload = {
        round: {
          course_name: round.courseName,
          total_score: round.totalScore,
          date: round.date,
          created_at: round.createdAt,
          ended_at: round.endedAt,
          holes: holes.map(h => ({
            hole_number: h.holeNumber,
            par: h.par,
            score: h.score,
            putts: h.putts,
            fairway_status: h.fairwayStatus,
            gir_status: h.girStatus,
            fairway_bunker: h.fairwayBunker,
            greenside_bunker: h.greensideBunker,
            proximity_to_hole: h.proximityToHole
          }))
        }
      };

      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const serverRound = await response.json();
        
        // Transaction to swap local ID with server ID
        await db.transaction('rw', db.rounds, db.holes, async () => {
            // 1. Delete local round & holes
            await db.rounds.delete(roundId);
            await db.holes.where('roundId').equals(roundId).delete();

            // 2. Insert validated server data
            const r = serverRound.data;
            await db.rounds.put({
                id: r.id, 
                courseName: r.course_name,
                date: r.date,
                totalScore: r.total_score,
                synced: 1,
                createdAt: r.created_at,
                endedAt: r.ended_at
            });

            if (r.holes) {
                for (const h of r.holes) {
                    await db.holes.put({
                        id: h.id,
                        roundId: r.id,
                        holeNumber: h.hole_number,
                        par: h.par,
                        score: h.score,
                        putts: h.putts,
                        fairwayStatus: h.fairway_status,
                        girStatus: h.gir_status,
                        fairwayBunker: h.fairway_bunker,
                        greensideBunker: h.greenside_bunker,
                        proximityToHole: h.proximity_to_hole
                    });
                }
            }
        });

        refetch();
        alert('Round synced successfully!');
        window.location.href = '/'; 
      } else {
        const errorText = await response.text();
        console.error("Sync Error Details:", errorText);
        alert('Failed to sync. Please check logs.');
      }
    } catch (e) {
      console.error(e);
      alert('Error syncing round - check connection');
    }
  };

  return (
    <RoundContext.Provider value={{ activeRounds, pastRounds, refetchRounds: refetch, syncRound, syncDown }}>
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
