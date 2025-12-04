import Dexie, { type EntityTable } from 'dexie';

interface Round {
  id?: number;
  courseName: string;
  date: string; // Date of play
  totalScore: number;
  synced: number; // 0 = false (Active), 1 = true (History)
  createdAt?: string;
  endedAt?: string;
}

interface Hole {
  id?: number;
  roundId: number;
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  
  // Detailed stats
  fairwayStatus?: 'hit' | 'left' | 'right';
  girStatus?: 'hit' | 'long' | 'short' | 'left' | 'right';
  fairwayBunker: boolean;
  greensideBunker: boolean;
  proximityToHole?: number;

  // Keep legacy for safety/compatibility if needed, but optional
  fairwayHit?: boolean;
  gir?: boolean;
}

const db = new Dexie('GolfStatsDB') as Dexie & {
  rounds: EntityTable<Round, 'id'>;
  holes: EntityTable<Hole, 'id'>;
};

// Starting from version 1 as requested, clean slate logic
db.version(1).stores({
  rounds: '++id, date, synced, createdAt, endedAt',
  holes: '++id, roundId, holeNumber, par, score, putts, fairwayStatus, girStatus, fairwayBunker, greensideBunker, proximityToHole'
});

export type { Round, Hole };
export { db };
