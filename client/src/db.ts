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
  
  // Club Tracking
  clubIds?: number[]; // Sequence of club IDs used

  // Keep legacy for safety/compatibility if needed, but optional
  fairwayHit?: boolean;
  gir?: boolean;
}

interface Club {
  id: number;
  name: string;
  type: string;
}

const db = new Dexie('GolfStatsDB') as Dexie & {
  rounds: EntityTable<Round, 'id'>;
  holes: EntityTable<Hole, 'id'>;
  clubs: EntityTable<Club, 'id'>;
};

// Starting from version 1 as requested, clean slate logic
db.version(1).stores({
  rounds: '++id, date, synced, createdAt, endedAt',
  holes: '++id, roundId, holeNumber, par, score, putts, fairwayStatus, girStatus, fairwayBunker, greensideBunker, proximityToHole'
});

// Upgrade to version 2 to include clubs table and clubIds in holes (no schema change needed for array field usually in Dexie unless indexed)
db.version(2).stores({
  clubs: 'id, name, type'
});

export type { Round, Hole, Club };
export { db };
