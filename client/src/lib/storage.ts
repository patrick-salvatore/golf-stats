/**
 * Local storage utilities using Dexie
 * For data that shouldn't go through TanStack Query:
 * - User (needed before queries run for auth header)
 * - Active rounds (local-only until synced)
 * 
 * NOTE: Most data operations should now use the local-first data layer:
 * import { LocalData, useRounds, useClubs, etc. } from '~/lib/local-data' or '~/hooks/use_local_data'
 * 
 * This file is maintained for backward compatibility and for user storage
 * (which must work before TanStack Query is initialized for auth).
 */
import { db, SyncStatus, type User, type Round, type Hole, type Club, type Course, type HoleDefinition } from "~/lib/db";

// ============ Type Aliases for Backward Compatibility ============
export type StoredUser = User;
export type LocalRound = Round;
export type LocalHole = Hole;
export type StoredClub = Club;
export type StoredCourse = Course;
export type StoredHoleDefinition = HoleDefinition;

// ============ User Storage ============
// Only one user stored locally at a time

export async function getUser(): Promise<StoredUser | null> {
  const user = await db.users.toCollection().first();
  return user ?? null;
}

export async function setUser(user: Omit<StoredUser, "id"> | StoredUser): Promise<void> {
  await db.users.clear();
  await db.users.add(user as User);
}

export async function clearUser(): Promise<void> {
  await db.users.clear();
}

// ============ Active Round Storage ============
// Active rounds are stored locally until synced to server (syncStatus = PENDING)

export async function getActiveRound(roundId: number): Promise<LocalRound | null> {
  const round = await db.rounds.get(roundId);
  return round ?? null;
}

export async function getAllActiveRounds(): Promise<LocalRound[]> {
  // Get all unsynced rounds, sorted by createdAt descending
  const rounds = await db.rounds
    .where("syncStatus")
    .equals(SyncStatus.PENDING)
    .toArray();
  
  // Sort by createdAt descending
  return rounds.sort((a, b) => {
    const dateA = new Date(a.createdAt ?? 0).getTime();
    const dateB = new Date(b.createdAt ?? 0).getTime();
    return dateB - dateA;
  });
}

export async function saveActiveRound(round: Omit<LocalRound, "id"> | LocalRound): Promise<number> {
  // Ensure syncStatus is set for new rounds
  const roundWithStatus = {
    ...round,
    syncStatus: (round as LocalRound).syncStatus ?? SyncStatus.PENDING,
  };
  // put() handles both insert (no id) and update (has id)
  const id = await db.rounds.put(roundWithStatus as Round);
  return id!; // ID is always returned for auto-increment tables
}

export async function deleteActiveRound(roundId: number): Promise<void> {
  await db.transaction("rw", [db.rounds, db.holes], async () => {
    await db.rounds.delete(roundId);
    await db.holes.where("roundId").equals(roundId).delete();
  });
}

// ============ Hole Operations ============

export async function getHolesForRound(roundId: number): Promise<LocalHole[]> {
  return db.holes.where("roundId").equals(roundId).toArray();
}

export async function saveHolesForRound(roundId: number, holes: (Omit<LocalHole, "id"> | LocalHole)[]): Promise<void> {
  await db.transaction("rw", db.holes, async () => {
    // Delete existing holes for this round
    await db.holes.where("roundId").equals(roundId).delete();
    // Add all the new holes
    if (holes.length > 0) {
      await db.holes.bulkAdd(holes as Hole[]);
    }
  });
}

export async function addOrUpdateHole(roundId: number, hole: Omit<LocalHole, "id"> | LocalHole): Promise<void> {
  // Find existing hole by roundId + holeNumber using compound index
  const existing = await db.holes
    .where("[roundId+holeNumber]")
    .equals([roundId, hole.holeNumber])
    .first();

  if (existing) {
    // Update existing hole, preserving its id
    await db.holes.put({ ...hole, id: existing.id } as Hole);
  } else {
    // Add new hole
    await db.holes.add(hole as Hole);
  }
}

// ============ Clubs Cache ============
// Clubs are synced from server but cached locally for offline access

export async function getClubs(): Promise<StoredClub[]> {
  return db.clubs.toArray();
}

export async function setClubs(clubs: StoredClub[]): Promise<void> {
  await db.transaction("rw", db.clubs, async () => {
    await db.clubs.clear();
    if (clubs.length > 0) {
      // Ensure syncStatus is set
      const clubsWithStatus = clubs.map(c => ({
        ...c,
        syncStatus: c.syncStatus ?? SyncStatus.SYNCED,
      }));
      await db.clubs.bulkPut(clubsWithStatus);
    }
  });
}

// ============ Courses Cache ============
// Courses are synced from server but cached locally for offline access

export async function getCourses(): Promise<StoredCourse[]> {
  return db.courses.toArray();
}

export async function setCourses(courses: StoredCourse[]): Promise<void> {
  await db.transaction("rw", db.courses, async () => {
    await db.courses.clear();
    if (courses.length > 0) {
      // Ensure syncStatus is set
      const coursesWithStatus = courses.map(c => ({
        ...c,
        syncStatus: c.syncStatus ?? SyncStatus.SYNCED,
      }));
      await db.courses.bulkPut(coursesWithStatus as Course[]);
    }
  });
}

export async function getCourse(id: number): Promise<StoredCourse | null> {
  const course = await db.courses.get(id);
  return course ?? null;
}

export async function addOrUpdateCourse(course: StoredCourse): Promise<void> {
  const courseWithStatus = {
    ...course,
    syncStatus: course.syncStatus ?? SyncStatus.SYNCED,
  };
  await db.courses.put(courseWithStatus as Course);
}
