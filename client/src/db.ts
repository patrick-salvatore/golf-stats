import Dexie, { type EntityTable } from 'dexie';

interface Round {
  id?: number;
  courseName: string;
  date: string;
  totalScore: number;
  synced: number; // 0 = false, 1 = true
  completed: number; // 0 = active, 1 = completed
}

interface Hole {
  id?: number;
  roundId: number;
  holeNumber: number;
  par: number;
  score: number;
  fairwayHit: boolean;
  gir: boolean;
  putts: number;
}

const db = new Dexie('GolfStatsDB') as Dexie & {
  rounds: EntityTable<Round, 'id'>;
  holes: EntityTable<Hole, 'id'>;
};

db.version(2).stores({
  rounds: '++id, date, synced, completed',
  holes: '++id, roundId, holeNumber' // compound index might be good but simple is fine
}).upgrade(tx => {
  return tx.table('rounds').toCollection().modify(round => {
    if (round.completed === undefined) round.completed = 1; // Assume existing rounds are completed
  });
});

export type { Round, Hole };
export { db };
