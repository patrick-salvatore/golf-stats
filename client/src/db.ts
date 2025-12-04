import Dexie, { type EntityTable } from 'dexie';

interface Round {
  id?: number;
  courseName: string;
  date: string;
  totalScore: number;
  synced: number; // 0 = false, 1 = true
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

db.version(1).stores({
  rounds: '++id, date, synced',
  holes: '++id, roundId, holeNumber' // compound index might be good but simple is fine
});

export type { Round, Hole };
export { db };
