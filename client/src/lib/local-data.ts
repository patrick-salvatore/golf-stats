/**
 * Local-First Data Layer
 * 
 * This module provides a local-first data layer that:
 * - Reads data from IndexedDB (instant, offline-capable)
 * - Writes optimistically to IndexedDB first
 * - Syncs changes to the backend in the background
 * - Queues failed syncs for retry
 * 
 * Usage with TanStack Query:
 * - Query functions read from IndexedDB
 * - Mutations write to IndexedDB + queue sync
 * - Background sync processes the queue
 */

import { db, SyncStatus, type Round, type Hole, type Club, type Course, type SyncQueueItem } from './db';
import * as roundApi from '~/api/rounds';
import * as bagApi from '~/api/bag';
import * as courseApi from '~/api/courses';

// ============ Types ============

export interface LocalRound extends Round {
  holes?: LocalHole[];
}

export interface LocalHole extends Hole {}

export interface LocalClub extends Club {}

export interface LocalCourse extends Course {}

// Server response types (snake_case from API)
export interface ServerRound {
  id: number;
  course_id?: number;
  course_name: string;
  date: string;
  total_score: number;
  created_at?: string;
  ended_at?: string;
  holes?: ServerHole[];
}

export interface ServerHole {
  id: number;
  hole_number: number;
  par: number;
  score: number;
  putts: number;
  fairway_status?: 'hit' | 'left' | 'right';
  gir_status?: 'hit' | 'long' | 'short' | 'left' | 'right';
  fairway_bunker: boolean;
  greenside_bunker: boolean;
  proximity_to_hole?: number;
  club_ids?: number[];
}

export interface ServerClub {
  id: number;
  name: string;
  type: string;
}

export interface ServerCourse {
  id: number;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  hole_definitions?: ServerHoleDefinition[];
}

export interface ServerHoleDefinition {
  id: number;
  course_id: number;
  hole_number: number;
  par: number;
  yardage: number;
  handicap: number;
  lat?: number;
  lng?: number;
  hazards?: unknown;
  geo_features?: unknown;
}

// ============ Utility Functions ============

function isOnline(): boolean {
  return navigator.onLine;
}

function generateTempId(): number {
  // Generate a negative temp ID to distinguish from server IDs
  return -Math.floor(Math.random() * 1000000000);
}

// ============ Sync Queue Management ============

async function addToSyncQueue(
  entity: SyncQueueItem['entity'],
  entityId: number,
  operation: SyncQueueItem['operation'],
  payload: unknown
): Promise<void> {
  await db.syncQueue.add({
    entity,
    entityId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

async function removeFromSyncQueue(id: number): Promise<void> {
  await db.syncQueue.delete(id);
}

async function markSyncAttempt(id: number, error?: string): Promise<void> {
  await db.syncQueue.update(id, {
    attempts: (await db.syncQueue.get(id))?.attempts ?? 0 + 1,
    lastError: error,
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('createdAt').toArray();
}

export async function getSyncQueueCount(): Promise<number> {
  return db.syncQueue.count();
}

// ============ Round Store ============

export const RoundStore = {
  // Read all rounds from local DB
  async getAll(): Promise<LocalRound[]> {
    const rounds = await db.rounds.orderBy('date').reverse().toArray();
    
    // Fetch holes for each round
    const roundsWithHoles = await Promise.all(
      rounds.map(async (round) => {
        if (round.id) {
          const holes = await db.holes.where('roundId').equals(round.id).toArray();
          return { ...round, holes };
        }
        return round;
      })
    );
    
    return roundsWithHoles;
  },

  // Read active (unsynced) rounds
  async getActive(): Promise<LocalRound[]> {
    const rounds = await db.rounds
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .toArray();
    
    const roundsWithHoles = await Promise.all(
      rounds.map(async (round) => {
        if (round.id) {
          const holes = await db.holes.where('roundId').equals(round.id).toArray();
          return { ...round, holes };
        }
        return round;
      })
    );
    
    return roundsWithHoles.sort((a, b) => {
      const dateA = new Date(a.createdAt ?? 0).getTime();
      const dateB = new Date(b.createdAt ?? 0).getTime();
      return dateB - dateA;
    });
  },

  // Read synced rounds (from server)
  async getSynced(): Promise<LocalRound[]> {
    const rounds = await db.rounds
      .where('syncStatus')
      .equals(SyncStatus.SYNCED)
      .toArray();
    
    return rounds.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  },

  // Get single round by ID
  async getById(id: number): Promise<LocalRound | null> {
    const round = await db.rounds.get(id);
    if (!round) return null;
    
    const holes = await db.holes.where('roundId').equals(id).toArray();
    return { ...round, holes };
  },

  // Create a new round (optimistic)
  async create(round: Omit<LocalRound, 'id' | 'syncStatus'>): Promise<LocalRound> {
    const now = new Date().toISOString();
    const newRound: Round = {
      ...round,
      syncStatus: SyncStatus.PENDING,
      createdAt: round.createdAt ?? now,
    };
    
    const id = await db.rounds.add(newRound);
    const created = { ...newRound, id };
    
    return created;
  },

  // Update a round (optimistic)
  async update(id: number, changes: Partial<LocalRound>): Promise<LocalRound | null> {
    const existing = await db.rounds.get(id);
    if (!existing) return null;
    
    // If already synced, mark as modified
    const syncStatus = existing.syncStatus === SyncStatus.SYNCED 
      ? SyncStatus.MODIFIED 
      : existing.syncStatus;
    
    await db.rounds.update(id, { ...changes, syncStatus });
    
    const updated = await this.getById(id);
    
    // Queue sync if modified
    if (syncStatus === SyncStatus.MODIFIED && isOnline()) {
      await addToSyncQueue('round', id, 'update', updated);
    }
    
    return updated;
  },

  // Delete a round (optimistic)
  async delete(id: number): Promise<void> {
    const existing = await db.rounds.get(id);
    if (!existing) return;
    
    // If synced with server, queue deletion
    if (existing.serverId && existing.syncStatus === SyncStatus.SYNCED) {
      await db.rounds.update(id, { syncStatus: SyncStatus.DELETED });
      await addToSyncQueue('round', id, 'delete', { serverId: existing.serverId });
    } else {
      // Not synced, just delete locally
      await db.transaction('rw', [db.rounds, db.holes], async () => {
        await db.rounds.delete(id);
        await db.holes.where('roundId').equals(id).delete();
      });
    }
  },

  // Sync a round to server
  async syncToServer(id: number): Promise<ServerRound | null> {
    const round = await this.getById(id);
    if (!round) return null;
    
    const holes = await db.holes.where('roundId').equals(id).toArray();
    
    // Transform to server format
    const payload = {
      course_id: round.courseId,
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
        proximity_to_hole: h.proximityToHole,
        club_ids: h.clubIds,
      })),
    };
    
    try {
      const serverRound = await roundApi.createRound(payload);
      
      // Update local round with server ID and mark as synced
      await db.rounds.update(id, {
        serverId: serverRound.id,
        syncStatus: SyncStatus.SYNCED,
      });
      
      return serverRound;
    } catch (error) {
      console.error('Failed to sync round:', error);
      throw error;
    }
  },

  // Fetch rounds from server and merge with local
  async fetchFromServer(): Promise<LocalRound[]> {
    try {
      const serverRounds: ServerRound[] = await roundApi.getRounds();
      
      // Upsert server rounds to local DB
      await db.transaction('rw', [db.rounds, db.holes], async () => {
        for (const sr of serverRounds) {
          // Check if we already have this round locally
          const existing = await db.rounds.where('serverId').equals(sr.id).first();
          
          if (existing) {
            // Update existing if not modified locally
            if (existing.syncStatus === SyncStatus.SYNCED) {
              await db.rounds.update(existing.id!, {
                courseName: sr.course_name,
                courseId: sr.course_id,
                totalScore: sr.total_score,
                date: sr.date,
                createdAt: sr.created_at,
                endedAt: sr.ended_at,
              });
            }
          } else {
            // Add new round from server
            const localRound: Round = {
              serverId: sr.id,
              courseName: sr.course_name,
              courseId: sr.course_id,
              totalScore: sr.total_score,
              date: sr.date,
              createdAt: sr.created_at,
              endedAt: sr.ended_at,
              syncStatus: SyncStatus.SYNCED,
            };
            
            const roundId = await db.rounds.add(localRound);
            
            // Add holes if present
            if (sr.holes && sr.holes.length > 0) {
              const localHoles: Hole[] = sr.holes.map(h => ({
                roundId: roundId as number,
                holeNumber: h.hole_number,
                par: h.par,
                score: h.score,
                putts: h.putts,
                fairwayStatus: h.fairway_status,
                girStatus: h.gir_status,
                fairwayBunker: h.fairway_bunker,
                greensideBunker: h.greenside_bunker,
                proximityToHole: h.proximity_to_hole,
                clubIds: h.club_ids,
              }));
              
              await db.holes.bulkAdd(localHoles);
            }
          }
        }
      });
      
      return this.getSynced();
    } catch (error) {
      console.error('Failed to fetch rounds from server:', error);
      // Return local synced rounds on error
      return this.getSynced();
    }
  },
};

// ============ Hole Store ============

export const HoleStore = {
  async getForRound(roundId: number): Promise<LocalHole[]> {
    return db.holes.where('roundId').equals(roundId).toArray();
  },

  async addOrUpdate(roundId: number, hole: Omit<LocalHole, 'id'>): Promise<LocalHole> {
    const existing = await db.holes
      .where('[roundId+holeNumber]')
      .equals([roundId, hole.holeNumber])
      .first();

    if (existing) {
      await db.holes.put({ ...hole, id: existing.id, roundId });
      return { ...hole, id: existing.id, roundId };
    } else {
      const id = await db.holes.add({ ...hole, roundId });
      return { ...hole, id, roundId };
    }
  },

  async saveAll(roundId: number, holes: Omit<LocalHole, 'id'>[]): Promise<void> {
    await db.transaction('rw', db.holes, async () => {
      await db.holes.where('roundId').equals(roundId).delete();
      if (holes.length > 0) {
        await db.holes.bulkAdd(holes.map(h => ({ ...h, roundId })));
      }
    });
  },

  async delete(id: number): Promise<void> {
    await db.holes.delete(id);
  },
};

// ============ Club Store ============

export const ClubStore = {
  async getAll(): Promise<LocalClub[]> {
    return db.clubs.toArray();
  },

  async getById(id: number): Promise<LocalClub | null> {
    const club = await db.clubs.get(id);
    return club ?? null;
  },

  // Save clubs from server (replaces all)
  async setFromServer(clubs: ServerClub[]): Promise<void> {
    await db.transaction('rw', db.clubs, async () => {
      await db.clubs.clear();
      if (clubs.length > 0) {
        const localClubs: Club[] = clubs.map(c => ({
          serverId: c.id,
          name: c.name,
          type: c.type,
          syncStatus: SyncStatus.SYNCED,
        }));
        await db.clubs.bulkAdd(localClubs);
      }
    });
  },

  // Create bag (set of clubs)
  async createBag(bag: Record<string, string>): Promise<LocalClub[]> {
    try {
      // Optimistically clear and add placeholder clubs
      const tempClubs: Club[] = Object.entries(bag).map(([type, name], index) => ({
        id: generateTempId() - index,
        name,
        type,
        syncStatus: SyncStatus.PENDING,
      }));
      
      await db.transaction('rw', db.clubs, async () => {
        await db.clubs.clear();
        await db.clubs.bulkAdd(tempClubs);
      });

      // Sync to server
      if (isOnline()) {
        const serverClubs = await bagApi.createBag(bag);
        await this.setFromServer(serverClubs);
        return this.getAll();
      }

      // Queue for later sync if offline
      await addToSyncQueue('club', 0, 'create', bag);
      
      return tempClubs;
    } catch (error) {
      console.error('Failed to create bag:', error);
      throw error;
    }
  },

  // Fetch from server
  async fetchFromServer(): Promise<LocalClub[]> {
    try {
      const serverClubs = await bagApi.getBag();
      if (serverClubs && Array.isArray(serverClubs)) {
        await this.setFromServer(serverClubs);
      }
      return this.getAll();
    } catch (error) {
      console.error('Failed to fetch clubs from server:', error);
      return this.getAll();
    }
  },
};

// ============ Course Store ============

export const CourseStore = {
  async getAll(): Promise<LocalCourse[]> {
    return db.courses.toArray();
  },

  async getById(id: number): Promise<LocalCourse | null> {
    const course = await db.courses.get(id);
    return course ?? null;
  },

  async getByServerId(serverId: number): Promise<LocalCourse | null> {
    const course = await db.courses.where('serverId').equals(serverId).first();
    return course ?? null;
  },

  // Search courses (server + local)
  async search(query: string): Promise<LocalCourse[]> {
    try {
      if (isOnline()) {
        const serverCourses: ServerCourse[] = await courseApi.searchCourses(query);
        
        // Cache results locally
        for (const sc of serverCourses) {
          const existing = await db.courses.where('serverId').equals(sc.id).first();
          if (!existing) {
            await db.courses.add({
              serverId: sc.id,
              name: sc.name,
              city: sc.city,
              state: sc.state,
              lat: sc.lat,
              lng: sc.lng,
              holeDefinitions: sc.hole_definitions?.map(hd => ({
                id: hd.id,
                courseId: hd.course_id,
                holeNumber: hd.hole_number,
                par: hd.par,
                yardage: hd.yardage,
                handicap: hd.handicap,
                lat: hd.lat,
                lng: hd.lng,
                hazards: hd.hazards,
                geo_features: hd.geo_features,
              })) ?? [],
              syncStatus: SyncStatus.SYNCED,
            });
          }
        }
        
        // Return server results transformed
        return serverCourses.map(sc => ({
          serverId: sc.id,
          name: sc.name,
          city: sc.city,
          state: sc.state,
          lat: sc.lat,
          lng: sc.lng,
          holeDefinitions: sc.hole_definitions?.map(hd => ({
            id: hd.id,
            courseId: hd.course_id,
            holeNumber: hd.hole_number,
            par: hd.par,
            yardage: hd.yardage,
            handicap: hd.handicap,
            lat: hd.lat,
            lng: hd.lng,
            hazards: hd.hazards,
            geo_features: hd.geo_features,
          })) ?? [],
          syncStatus: SyncStatus.SYNCED,
        }));
      }
      
      // Offline: search local courses
      const allCourses = await this.getAll();
      const lowerQuery = query.toLowerCase();
      return allCourses.filter(c => 
        c.name.toLowerCase().includes(lowerQuery) ||
        c.city.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Failed to search courses:', error);
      // Fallback to local search
      const allCourses = await this.getAll();
      const lowerQuery = query.toLowerCase();
      return allCourses.filter(c => 
        c.name.toLowerCase().includes(lowerQuery) ||
        c.city.toLowerCase().includes(lowerQuery)
      );
    }
  },

  // Create a new course
  async create(course: Omit<LocalCourse, 'id' | 'serverId' | 'syncStatus'>): Promise<LocalCourse> {
    const newCourse: Course = {
      ...course,
      syncStatus: SyncStatus.PENDING,
    };
    
    const id = await db.courses.add(newCourse);
    const created = { ...newCourse, id };
    
    // Queue sync
    await addToSyncQueue('course', id as number, 'create', created);
    
    // Try immediate sync if online
    if (isOnline()) {
      try {
        const serverCourse = await courseApi.createCourse({
          name: course.name,
          city: course.city,
          state: course.state,
          lat: course.lat,
          lng: course.lng,
          hole_definitions: course.holeDefinitions.map(hd => ({
            hole_number: hd.holeNumber,
            par: hd.par,
            yardage: hd.yardage,
            handicap: hd.handicap,
            lat: hd.lat,
            lng: hd.lng,
            hazards: hd.hazards,
            geo_features: hd.geo_features,
          })),
        });
        
        await db.courses.update(id, {
          serverId: serverCourse.id,
          syncStatus: SyncStatus.SYNCED,
        });
        
        // Remove from sync queue
        const queueItem = await db.syncQueue
          .where('entityId')
          .equals(id as number)
          .first();
        if (queueItem?.id) {
          await removeFromSyncQueue(queueItem.id);
        }
        
        return { ...created, serverId: serverCourse.id, syncStatus: SyncStatus.SYNCED };
      } catch (error) {
        console.error('Failed to sync course:', error);
      }
    }
    
    return created;
  },

  // Fetch single course from server
  async fetchById(serverId: number): Promise<LocalCourse | null> {
    try {
      const serverCourse: ServerCourse = await courseApi.getCourse(serverId);
      
      const localCourse: Course = {
        serverId: serverCourse.id,
        name: serverCourse.name,
        city: serverCourse.city,
        state: serverCourse.state,
        lat: serverCourse.lat,
        lng: serverCourse.lng,
        holeDefinitions: serverCourse.hole_definitions?.map(hd => ({
          id: hd.id,
          courseId: hd.course_id,
          holeNumber: hd.hole_number,
          par: hd.par,
          yardage: hd.yardage,
          handicap: hd.handicap,
          lat: hd.lat,
          lng: hd.lng,
          hazards: hd.hazards,
          geo_features: hd.geo_features,
        })) ?? [],
        syncStatus: SyncStatus.SYNCED,
      };
      
      // Upsert locally
      const existing = await this.getByServerId(serverId);
      if (existing?.id) {
        // Use put instead of update for complex nested objects
        await db.courses.put({ ...localCourse, id: existing.id });
        return { ...localCourse, id: existing.id };
      } else {
        const id = await db.courses.add(localCourse);
        return { ...localCourse, id };
      }
    } catch (error) {
      console.error('Failed to fetch course:', error);
      return this.getByServerId(serverId);
    }
  },
};

// ============ Background Sync ============

export async function processSync(): Promise<void> {
  if (!isOnline()) return;
  
  const pendingItems = await getPendingSyncItems();
  
  for (const item of pendingItems) {
    try {
      switch (item.entity) {
        case 'round':
          if (item.operation === 'create' || item.operation === 'update') {
            await RoundStore.syncToServer(item.entityId);
          }
          // TODO: Handle delete
          break;
          
        case 'club':
          if (item.operation === 'create') {
            await bagApi.createBag(item.payload as Record<string, string>);
            await ClubStore.fetchFromServer();
          }
          break;
          
        case 'course':
          // Course sync handled in create method
          break;
      }
      
      // Remove from queue on success
      if (item.id) {
        await removeFromSyncQueue(item.id);
      }
    } catch (error) {
      console.error(`Failed to sync ${item.entity}:`, error);
      if (item.id) {
        await markSyncAttempt(item.id, String(error));
      }
    }
  }
}

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online, processing sync queue...');
    processSync();
  });
}

// ============ Main LocalData Export ============

export const LocalData = {
  rounds: RoundStore,
  holes: HoleStore,
  clubs: ClubStore,
  courses: CourseStore,
  
  // Sync utilities
  processSync,
  getPendingSyncItems,
  getSyncQueueCount,
  isOnline,
};

export default LocalData;
