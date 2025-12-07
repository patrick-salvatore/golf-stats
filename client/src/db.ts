import Dexie, { type EntityTable } from 'dexie';

interface Round {
  id?: number;
  courseId?: number; // Link to Course entity
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

interface Course {
  id?: number;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  holeDefinitions: HoleDefinition[];
  synced?: number; // 0 = false, 1 = true (if cached from server)
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
}

interface User {
  id?: number;
  username: string;
}

// ... existing interfaces ...

const db = new Dexie('GolfStatsDB') as Dexie & {
  rounds: EntityTable<Round, 'id'>;
  holes: EntityTable<Hole, 'id'>;
  clubs: EntityTable<Club, 'id'>;
  courses: EntityTable<Course, 'id'>;
  users: EntityTable<User, 'id'>;
};

// ... existing versions ...

// Version 4: Users
db.version(4).stores({
  users: '++id, username'
});

export type { Round, Hole, Club, Course, HoleDefinition, User };
export { db };
