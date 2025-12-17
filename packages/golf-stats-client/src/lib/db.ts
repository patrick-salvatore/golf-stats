import Dexie, { type EntityTable } from 'dexie';
import { UnifiedHoleFeatures } from '~/pages/course_creator/types';

export const SyncStatus = {
  PENDING: 0,
  SYNCED: 1,
  MODIFIED: 2,
  DELETED: 3,
} as const;
export type SyncStatusType = (typeof SyncStatus)[keyof typeof SyncStatus];

/* ─────────────────────────────────────────────
   Base Entity
────────────────────────────────────────────── */
type BaseEntity = {
  id?: number; // Local Dexie ID
  serverId?: number; // Server-assigned ID after sync
  syncStatus: SyncStatusType;
};

/* ─────────────────────────────────────────────
   Domain Types
────────────────────────────────────────────── */
export type User = BaseEntity & {
  username: string;
};

export type Club = BaseEntity & {
  name: string;
  type: string;
};

export type ClubDefinition = {
  id?: number;
  name: string;
  type: string;
  category: string;
  default_selected: boolean;
};

export type Course = BaseEntity & {
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  status: 'draft' | 'published';
};

export type TeeBox = {
  id?: number;
  name: string;
  color: string;
  yardage: number;
  lat: number;
  lng: number;
};

export type HoleDefinition = BaseEntity & {
  courseId: number;
  holeNumber: number;
  par: number;
  handicap: number;

  // Pin positions (preserved for backward compatibility)
  lat?: number;
  lng?: number;
  front_lat?: number;
  front_lng?: number;
  back_lat?: number;
  back_lng?: number;

  // NEW: Unified features with stable IDs
  features?: UnifiedHoleFeatures;

  // DEPRECATED: Legacy fields for migration
  hazards?: any;
  geo_features?: any;
  trajectory?: GeoJSON.LineString | null;
  tee_boxes?: TeeBox[];
};

export type Round = BaseEntity & {
  courseId: number;
  date: string;
  totalScore: number;
  courseName: string;
  createdAt?: string;
  endedAt?: string;
};

export type GIRStatus = 'hit' | 'long' | 'short' | 'left' | 'right';
export type FairwayStatus = 'hit' | 'left' | 'right';

export type Hole = BaseEntity & {
  roundId: number;
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayStatus?: FairwayStatus;
  girStatus?: GIRStatus;
  fairwayBunker: boolean;
  greensideBunker: boolean;
  proximityToHole?: number;

  clubIds?: number[];
};

export type SyncQueueItem = {
  id?: number;
  entity: 'round' | 'hole' | 'club' | 'course' | 'holeDefinition';
  entityId: number;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export type UndoRedoStackItem = {
  id?: number;
  courseId: number;
  holeNumber: number;
  stackType: 'undo' | 'redo';
  state: GeoJSON.FeatureCollection;
  holeMetadata: {
    // Pin positions
    lat?: number;
    lng?: number;
    front_lat?: number;
    front_lng?: number;
    back_lat?: number;
    back_lng?: number;
    // Tee boxes
    tee_boxes?: Array<{
      name: string;
      color: string;
      yardage: number;
      lat: number;
      lng: number;
    }>;
    // Basic hole info
    par?: number;
    handicap?: number;
  };
  timestamp: number;
  sequenceIndex: number; // For maintaining stack order
};

/* ─────────────────────────────────────────────
   Dexie Instance
────────────────────────────────────────────── */

const db = new Dexie('GolfStatsDB') as Dexie & {
  users: EntityTable<User, 'id'>;
  clubs: EntityTable<Club, 'id'>;
  club_definitions: EntityTable<ClubDefinition, 'id'>;

  courses: EntityTable<Course, 'id'>;
  hole_definitions: EntityTable<HoleDefinition, 'id'>;

  rounds: EntityTable<Round, 'id'>;
  holes: EntityTable<Hole, 'id'>;

  syncQueue: EntityTable<SyncQueueItem, 'id'>;
  undoRedoStacks: EntityTable<UndoRedoStackItem, 'id'>;
};

/* ─────────────────────────────────────────────
   Dexie Schema Definition
────────────────────────────────────────────── */

db.version(1).stores({
  // Auth
  users: '++id, username, serverId, syncStatus',

  // Clubs
  clubs: '++id, serverId, name, type, syncStatus',
  club_definitions: '++id, name, type, category, default_selected',

  // Courses
  courses: '++id, serverId, name, status, syncStatus',

  // Hole Definitions (normalized)
  hole_definitions:
    '++id, courseId, holeNumber, [courseId+holeNumber], serverId, syncStatus',

  // Rounds + Holes
  rounds: '++id, courseId, serverId, date, syncStatus',
  holes:
    '++id, roundId, holeNumber, [roundId+holeNumber], serverId, syncStatus',

  // Sync
  syncQueue: '++id, entity, entityId, [entity+entityId], createdAt, operation',
  
  // Undo/Redo stacks for map drawing
  undoRedoStacks: '++id, [courseId+holeNumber+stackType], courseId, holeNumber, stackType, timestamp, sequenceIndex',
});

export { db };
