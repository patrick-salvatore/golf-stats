import Dexie, { type EntityTable } from 'dexie';

// Sync status enum for local-first data
export const SyncStatus = {
  PENDING: 0, // Not yet synced to server
  SYNCED: 1, // Synced with server
  MODIFIED: 2, // Modified locally after sync
  DELETED: 3, // Marked for deletion
} as const;

export type SyncStatusType = (typeof SyncStatus)[keyof typeof SyncStatus];

// Sync queue for tracking pending operations
interface SyncQueueItem {
  id?: number;
  entity: 'round' | 'hole' | 'club' | 'course';
  entityId: number;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

interface Round {
  id?: number;
  serverId?: number; // Server-assigned ID after sync
  courseId?: number; // Link to Course entity
  courseName: string;
  date: string; // Date of play
  totalScore: number;
  syncStatus: SyncStatusType;
  createdAt?: string;
  endedAt?: string;
}

export type FairwayStatus = 'hit' | 'left' | 'right';
export type GIRStatus = 'hit' | 'long' | 'short' | 'left' | 'right';

interface Hole {
  id?: number;
  roundId: number;
  holeNumber: number;
  par: number;
  score: number;
  putts: number;

  // Detailed stats
  fairwayStatus?: FairwayStatus;
  girStatus?: GIRStatus;
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
  id?: number;
  serverId?: number;
  name: string;
  type: string;
  syncStatus: SyncStatusType;
}

interface Course {
  id?: number;
  serverId?: number;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  holeDefinitions: HoleDefinition[];
  syncStatus: SyncStatusType;
}

interface HoleDefinition {
  id?: number;
  courseId: number;
  holeNumber: number;
  par: number;
  yardage: number;
  handicap: number;
  lat?: number;
  lng?: number;
  hazards?: any; // JSON object for bunkers, water, etc.
  geo_features?: any; // GeoJSON FeatureCollection
}

interface User {
  id?: number;
  username: string;
}

const db = new Dexie('GolfStatsDB') as Dexie & {
  rounds: EntityTable<Round, 'id'>;
  holes: EntityTable<Hole, 'id'>;
  clubs: EntityTable<Club, 'id'>;
  courses: EntityTable<Course, 'id'>;
  users: EntityTable<User, 'id'>;
  syncQueue: EntityTable<SyncQueueItem, 'id'>;
};

db.version(1).stores({
  users: '++id, username',
  rounds: '++id, serverId, date, syncStatus',
  holes: '++id, roundId, holeNumber, [roundId+holeNumber]',
  clubs: '++id, serverId, syncStatus',
  courses: '++id, serverId, name, syncStatus',
  syncQueue: '++id, entity, entityId, operation, createdAt',
});

export type { Round, Hole, Club, Course, HoleDefinition, User, SyncQueueItem };
export { db };
