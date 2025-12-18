import {
  db,
  SyncStatus,
  type Round,
  type Hole,
  type Club,
  type Course,
  type HoleDefinition,
  type SyncQueueItem,
  User,
  ClubDefinition,
} from './db';
import * as roundApi from '~/api/rounds';
import * as bagApi from '~/api/bag';
import * as courseApi from '~/api/courses';
import { createEmptyFeatures } from '~/pages/course_creator/feature_utils';

/* ============================
   Local-friendly typings
   ============================ */

export type LocalRound = Round & {
  holes: LocalHole[];
  courseName: string;
};

export type LocalHole = Hole;

export type LocalClub = Club;

export type LocalCourse = Course & {
  holeDefinitions: Partial<HoleDefinition>[];
};

export type LocalUser = User;

export type ServerRound = {
  id: number;
  course_id: number;
  course_name: string;
  date: string;
  holes: ServerHole[];
  total_score: number;
  created_at?: string;
  ended_at?: string;
};

export type ServerHole = {
  id?: number;
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
};

export type ServerClub = {
  id: number;
  name: string;
  type: string;
};

export type ServerCourse = {
  id: number;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  status?: 'draft' | 'published';
  hole_definitions?: ServerHoleDefinition[];
};

export type ServerHoleDefinition = {
  id: number;
  course_id: number;
  hole_number: number;
  par: number;
  yardage?: number;
  handicap: number;
  lat?: number;
  lng?: number;
  front_lat?: number;
  front_lng?: number;
  back_lat?: number;
  back_lng?: number;
  hazards?: unknown;
  geo_features?: unknown;
  tee_boxes?: unknown;
};

function isOnline(): boolean {
  return false
  // return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function generateTempId(): number {
  return -Math.floor(Math.random() * 1_000_000_000);
}

export async function addToSyncQueue(
  entity: SyncQueueItem['entity'],
  entityId: number,
  operation: SyncQueueItem['operation'],
  payload: unknown,
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

export async function removeFromSyncQueue(id: number): Promise<void> {
  await db.syncQueue.delete(id);
}

export async function markSyncAttempt(
  id: number,
  error?: string,
): Promise<void> {
  const item = await db.syncQueue.get(id);
  const attempts = (item?.attempts ?? 0) + 1;
  await db.syncQueue.update(id, { attempts, lastError: error });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('createdAt').toArray();
}

export async function getSyncQueueCount(): Promise<number> {
  return db.syncQueue.count();
}

export const RoundStore = {
  async getAll(): Promise<LocalRound[]> {
    const rounds = await db.rounds.orderBy('date').reverse().toArray();
    const roundsWithHoles = await Promise.all(
      rounds.map(async (r) => {
        if (!r.id) return r as LocalRound;
        const holes = await db.holes.where('roundId').equals(r.id).toArray();
        return { ...r, holes } as LocalRound;
      }),
    );
    return roundsWithHoles;
  },

  async getActive(): Promise<LocalRound[]> {
    const rounds = await db.rounds
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .toArray();

    const roundsWithHoles = await Promise.all(
      rounds.map(async (r) => {
        if (!r.id) return r as LocalRound;
        const holes = await db.holes.where('roundId').equals(r.id).toArray();
        return { ...r, holes } as LocalRound;
      }),
    );

    return roundsWithHoles.sort((a, b) => {
      const aT = new Date(a.createdAt ?? 0).getTime();
      const bT = new Date(b.createdAt ?? 0).getTime();
      return bT - aT;
    });
  },

  async getSynced(): Promise<LocalRound[]> {
    const rounds = await db.rounds
      .where('syncStatus')
      .equals(SyncStatus.SYNCED)
      .toArray();

    const roundsWithHoles = await Promise.all(
      rounds.map(async (r) => {
        if (!r.id)
          return {
            ...r,
            holes: [],
            courseName: (r as any).courseName,
          } as LocalRound;

        const holes = await db.holes.where('roundId').equals(r.id).toArray();
        return { ...r, holes, courseName: (r as any).courseName } as LocalRound;
      }),
    );

    return roundsWithHoles.sort((a, b) => {
      const aT = new Date(a.date).getTime();
      const bT = new Date(b.date).getTime();
      return bT - aT;
    });
  },

  async getById(id: number): Promise<LocalRound | null> {
    const round = await db.rounds.get(id);
    if (!round) return null;
    const holes = await db.holes.where('roundId').equals(id).toArray();
    return { ...round, holes } as LocalRound;
  },

  async create(
    round: Omit<LocalRound, 'id' | 'syncStatus'>,
  ): Promise<LocalRound> {
    const now = new Date().toISOString();
    const newRound: Round = {
      ...round,
      syncStatus: SyncStatus.PENDING,
      createdAt: round.createdAt ?? now,
    };
    const id = await db.rounds.add(newRound);
    if (!id) {
      return Promise.reject(`error adding round with id: ${id}`);
    }

    const created = { ...newRound, id } as LocalRound;

    if (round.holes && round.holes.length > 0) {
      const holesToAdd: Hole[] = round.holes.map((h) => ({
        ...h,
        roundId: id,
        syncStatus: h.syncStatus ?? SyncStatus.PENDING,
      }));
      await db.holes.bulkAdd(holesToAdd);
    }

    await addToSyncQueue('round', id as number, 'create', created);

    if (isOnline()) {
      try {
        await RoundStore.syncToServer(id as number);

        const qi = await db.syncQueue
          .where('entity')
          .equals('round')
          .and((q) => q.entityId === id)
          .first();
        if (qi?.id) await removeFromSyncQueue(qi.id);
      } catch (e) {
        console.warn('Round create sync failed, will retry later', e);
      }
    }

    return created;
  },

  async update(
    id: number,
    changes: Partial<LocalRound>,
  ): Promise<LocalRound | null> {
    const existing = await db.rounds.get(id);
    if (!existing) return null;

    const newSyncStatus =
      existing.syncStatus === SyncStatus.SYNCED
        ? SyncStatus.MODIFIED
        : existing.syncStatus;

    await db.rounds.update(id, { ...changes, syncStatus: newSyncStatus });

    const updated = await RoundStore.getById(id);

    if (newSyncStatus === SyncStatus.MODIFIED) {
      await addToSyncQueue('round', id, 'update', updated ?? { id });
      if (isOnline()) {
        try {
          await RoundStore.syncToServer(id);
        } catch (e) {}
      }
    }

    return updated;
  },

  async delete(id: number): Promise<void> {
    const existing = await db.rounds.get(id);
    if (!existing) return;

    if (existing.serverId && existing.syncStatus === SyncStatus.SYNCED) {
      if (isOnline()) {
        try {
          await roundApi.deleteRound(existing.serverId);
          await db.transaction('rw', [db.rounds, db.holes], async () => {
            await db.holes.where('roundId').equals(id).delete();
            await db.rounds.delete(id);
          });
        } catch (err) {
          console.error('Failed to delete round from server:', err);
          await db.rounds.update(id, { syncStatus: SyncStatus.DELETED });
          await addToSyncQueue('round', id, 'delete', {
            serverId: existing.serverId,
          });
        }
      } else {
        await db.rounds.update(id, { syncStatus: SyncStatus.DELETED });
        await addToSyncQueue('round', id, 'delete', {
          serverId: existing.serverId,
        });
      }
    } else {
      await db.transaction('rw', [db.rounds, db.holes], async () => {
        await db.holes.where('roundId').equals(id).delete();
        await db.rounds.delete(id);
      });
    }
  },

  async syncToServer(id: number): Promise<ServerRound | null> {
    const round = await RoundStore.getById(id);
    if (!round) return null;

    const holes = (
      round.holes ?? (await db.holes.where('roundId').equals(id).toArray())
    ).map((h) => ({
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
    }));

    const payload = {
      course_id: round.courseId,
      course_name: round.courseName,
      date: round.date,
      total_score: round.totalScore,
      created_at: round.createdAt,
      ended_at: round.endedAt,
      holes,
    };

    try {
      const serverRound = await roundApi.createRound(payload);

      await db.rounds.update(id, {
        serverId: serverRound.id,
        syncStatus: SyncStatus.SYNCED,
      });

      return serverRound;
    } catch (err) {
      console.error('Failed to sync round:', err);

      await addToSyncQueue('round', id, 'update', payload);
      throw err;
    }
  },

  async fetchFromServer(): Promise<LocalRound[]> {
    try {
      const serverRounds: ServerRound[] = await roundApi.getRounds();

      await db.transaction('rw', [db.rounds, db.holes], async () => {
        for (const sr of serverRounds) {
          const existing = await db.rounds
            .where('serverId')
            .equals(sr.id)
            .first();

          if (existing) {
            if (existing.syncStatus === SyncStatus.SYNCED) {
              await db.rounds.update(existing.id!, {
                courseId: sr.course_id,
                courseName: sr.course_name,
                totalScore: sr.total_score,
                date: sr.date,
                createdAt: sr.created_at,
                endedAt: sr.ended_at,
              });

              await db.holes.where('roundId').equals(existing.id!).delete();
              if (sr.holes && sr.holes.length > 0) {
                const localHoles: Hole[] = sr.holes.map((h) => ({
                  roundId: existing.id!,
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
                  syncStatus: SyncStatus.SYNCED,
                }));
                await db.holes.bulkAdd(localHoles);
              }
            }
          } else {
            const localRound: Round = {
              serverId: sr.id,
              courseId: sr.course_id ?? 0,
              courseName: sr.course_name,
              date: sr.date,
              totalScore: sr.total_score,
              createdAt: sr.created_at,
              endedAt: sr.ended_at,
              syncStatus: SyncStatus.SYNCED,
            };
            const rid = await db.rounds.add(localRound);

            if (sr.holes && sr.holes.length > 0) {
              const localHoles: Hole[] = sr.holes.map((h) => ({
                roundId: rid as number,
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
                syncStatus: SyncStatus.SYNCED,
              }));
              await db.holes.bulkAdd(localHoles);
            }
          }
        }
      });

      return RoundStore.getSynced();
    } catch (err) {
      console.error('Failed to fetch rounds from server:', err);
      return RoundStore.getSynced();
    }
  },
};

export const HoleStore = {
  async getForRound(roundId: number): Promise<LocalHole[]> {
    return db.holes.where('roundId').equals(roundId).toArray();
  },

  async addOrUpdate(
    roundId: number,
    hole: Omit<LocalHole, 'id'>,
  ): Promise<LocalHole> {
    const existing = await db.holes
      .where('[roundId+holeNumber]')
      .equals([roundId, hole.holeNumber])
      .first();

    if (existing) {
      const merged: Hole = {
        ...existing,
        ...hole,
        roundId,
        syncStatus:
          existing.syncStatus === SyncStatus.SYNCED
            ? SyncStatus.MODIFIED
            : existing.syncStatus,
      };
      await db.holes.put(merged);

      await addToSyncQueue('round', roundId, 'update', {
        holeNumber: hole.holeNumber,
      });
      return merged;
    } else {
      const newHole: Hole = {
        ...hole,
        roundId,
        syncStatus: hole.syncStatus ?? SyncStatus.PENDING,
      };
      const id = await db.holes.add(newHole);
      await addToSyncQueue('round', roundId, 'update', {
        holeNumber: hole.holeNumber,
      });
      return { ...newHole, id };
    }
  },

  async saveAll(
    roundId: number,
    holes: Omit<LocalHole, 'id'>[],
  ): Promise<void> {
    await db.transaction('rw', db.holes, async () => {
      await db.holes.where('roundId').equals(roundId).delete();
      if (holes.length > 0) {
        const toAdd = holes.map((h) => ({
          ...h,
          roundId,
          syncStatus: h.syncStatus ?? SyncStatus.PENDING,
        }));
        await db.holes.bulkAdd(toAdd);
      }
    });
    await addToSyncQueue('round', roundId, 'update', {
      replacedAllHoles: true,
    });
  },

  async delete(id: number): Promise<void> {
    await db.holes.delete(id);
  },
};

export const ClubStore = {
  async getAll(): Promise<LocalClub[]> {
    return db.clubs.toArray();
  },

  async getById(id: number): Promise<LocalClub | null> {
    return (await db.clubs.get(id)) ?? null;
  },

  async setFromServer(clubs: ServerClub[]): Promise<void> {
    await db.transaction('rw', db.clubs, async () => {
      await db.clubs.clear();
      if (clubs.length > 0) {
        const localClubs: Club[] = clubs.map((c) => ({
          serverId: c.id,
          name: c.name,
          type: c.type,
          syncStatus: SyncStatus.SYNCED,
        }));
        await db.clubs.bulkAdd(localClubs);
      }
    });
  },

  async createBag(bag: Record<string, string>): Promise<LocalClub[]> {
    const tempClubs: Club[] = Object.entries(bag).map(([type, name], idx) => ({
      id: generateTempId() - idx,
      name,
      type,
      syncStatus: SyncStatus.PENDING,
    }));

    await db.transaction('rw', db.clubs, async () => {
      await db.clubs.clear();
      await db.clubs.bulkAdd(tempClubs);
    });

    if (isOnline()) {
      try {
        const serverClubs = await bagApi.createBag(bag);
        await ClubStore.setFromServer(serverClubs);
        return ClubStore.getAll();
      } catch (err) {
        console.error('Failed to create bag on server:', err);

        await addToSyncQueue('club', 0, 'create', bag);
        return tempClubs;
      }
    } else {
      await addToSyncQueue('club', 0, 'create', bag);
      return tempClubs;
    }
  },

  async updateBag(bag: Record<string, string>): Promise<LocalClub[]> {
    const tempClubs: Club[] = Object.entries(bag).map(([type, name], idx) => ({
      id: generateTempId() - idx,
      name,
      type,
      syncStatus: SyncStatus.PENDING,
    }));

    await db.transaction('rw', db.clubs, async () => {
      await db.clubs.clear();
      await db.clubs.bulkAdd(tempClubs);
    });

    if (isOnline()) {
      try {
        const serverClubs = await bagApi.updateBag(bag);
        await ClubStore.setFromServer(serverClubs);
        return ClubStore.getAll();
      } catch (err) {
        console.error('Failed to update bag on server:', err);
        await addToSyncQueue('club', 0, 'update', bag);
        return tempClubs;
      }
    } else {
      await addToSyncQueue('club', 0, 'update', bag);
      return tempClubs;
    }
  },

  async fetchFromServer(): Promise<LocalClub[]> {
    try {
      const serverClubs = await bagApi.getBag();
      if (Array.isArray(serverClubs))
        await ClubStore.setFromServer(serverClubs);
      return ClubStore.getAll();
    } catch (err) {
      console.error('Failed to fetch clubs:', err);
      return ClubStore.getAll();
    }
  },

  async setClubDefinitions(definitions: ClubDefinition[]) {
    await db.club_definitions.bulkAdd(definitions);
  },

  async getClubDefinitions() {
    const localDefinitions = db.club_definitions.toArray();

    if (!(await localDefinitions).length) {
      const definitions = await bagApi.getClubDefinitions();
      await this.setClubDefinitions(definitions);

      return definitions;
    }

    return localDefinitions;
  },
};

export const CourseStore = {
  async getAll(): Promise<LocalCourse[]> {
    const courses = await db.courses.toArray();
    return courses as LocalCourse[];
  },

  async getById(id: number): Promise<LocalCourse | null> {
    const c = await db.courses.get(id);
    if (!c) return null;

    const holeDefinitions = await db.hole_definitions
      .where('courseId')
      .equals(id)
      .toArray();

    // Auto-migrate holes that need migration
    const migratedHoles = await Promise.all(
      holeDefinitions.map(async (hole) => {
        // Ensure features exist for all holes
        if (!hole.features) {
          const emptyFeatures = createEmptyFeatures();
          await db.hole_definitions.update(hole.id!, {
            features: emptyFeatures,
          });
          return { ...hole, features: emptyFeatures };
        }

        return hole;
      }),
    );

    return { ...c, holeDefinitions: migratedHoles } as LocalCourse;
  },

  async getByServerId(serverId: number): Promise<LocalCourse | null> {
    const c = await db.courses.where('serverId').equals(serverId).first();
    if (!c) return null;
    return c as LocalCourse;
  },

  async search(query: string): Promise<LocalCourse[]> {
    try {
      if (isOnline()) {
        const serverCourses: ServerCourse[] =
          await courseApi.searchCourses(query);

        await db.transaction(
          'rw',
          [db.courses, db.hole_definitions],
          async () => {
            for (const sc of serverCourses) {
              const existing = await db.courses
                .where('serverId')
                .equals(sc.id)
                .first();
              if (!existing) {
                const courseRecord: Course = {
                  serverId: sc.id,
                  name: sc.name,
                  city: sc.city,
                  state: sc.state,
                  lat: sc.lat,
                  lng: sc.lng,
                  status: 'published',
                  syncStatus: SyncStatus.SYNCED,
                };
                const cid = await db.courses.add(courseRecord);
                if (sc.hole_definitions && sc.hole_definitions.length > 0) {
                  const holes = sc.hole_definitions.map((hd) => ({
                    serverId: hd.id,
                    courseId: cid as number,
                    holeNumber: hd.hole_number,
                    par: hd.par,
                    handicap: hd.handicap,
                    yardage: hd.yardage,
                    lat: hd.lat,
                    lng: hd.lng,
                    front_lat: hd.front_lat,
                    front_lng: hd.front_lng,
                    back_lat: hd.back_lat,
                    back_lng: hd.back_lng,
                    hazards: hd.hazards,
                    geo_features: hd.geo_features,
                    syncStatus: SyncStatus.SYNCED,
                  })) as HoleDefinition[];
                  await db.hole_definitions.bulkAdd(holes);
                }
              } else {
                if (existing.syncStatus === SyncStatus.SYNCED) {
                  await db.courses.update(existing.id!, {
                    name: sc.name,
                    city: sc.city,
                    state: sc.state,
                    lat: sc.lat,
                    lng: sc.lng,
                  });
                }
              }
            }
          },
        );

        return serverCourses.map((sc) => ({
          serverId: sc.id,
          name: sc.name,
          city: sc.city,
          state: sc.state,
          lat: sc.lat,
          lng: sc.lng,
          status: 'published',
          syncStatus: SyncStatus.SYNCED,
        })) as LocalCourse[];
      }

      const all = await CourseStore.getAll();
      const q = query.toLowerCase();
      return all.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q),
      );
    } catch (err) {
      console.error('Course search failed:', err);
      const all = await CourseStore.getAll();
      const q = query.toLowerCase();
      return all.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q),
      );
    }
  },

  async upsertHole(
    courseId: number,
    holeNumber: number,
    data: Partial<HoleDefinition>,
  ): Promise<void> {
    const existing = await db.hole_definitions
      .where('[courseId+holeNumber]')
      .equals([courseId, holeNumber])
      .first();
    if (existing) {
      await db.hole_definitions.update(existing.id!, {
        ...existing,
        ...data,
        syncStatus: SyncStatus.MODIFIED,
      });
    } else {
      await db.hole_definitions.add({
        courseId,
        holeNumber,
        par: data.par ?? 0,
        handicap: data.handicap ?? 0,
        yardage: (data as any).yardage ?? 0,
        lat: data.lat,
        lng: data.lng,
        front_lat: data.front_lat,
        front_lng: data.front_lng,
        back_lat: data.back_lat,
        back_lng: data.back_lng,
        hazards: data.hazards,
        geo_features: data.geo_features,
        syncStatus: SyncStatus.PENDING,
      } as HoleDefinition);
    }

    await db.courses.update(courseId, { syncStatus: SyncStatus.MODIFIED });
    await addToSyncQueue('course', courseId, 'update', {
      holeNumber,
      changes: data,
    });
  },

  async publish(courseId: number): Promise<void> {
    const course = await db.courses.get(courseId);
    if (!course) throw new Error('Course not found');

    if (!isOnline()) throw new Error('Must be online to publish course');

    const holeDefs = await db.hole_definitions
      .where('courseId')
      .equals(courseId)
      .toArray();

    const payload = {
      name: course.name,
      city: course.city,
      state: course.state,
      lat: course.lat,
      lng: course.lng,
      status: 'published',
      hole_definitions: holeDefs.map((hd) => {
        return {
          hole_number: hd.holeNumber,
          par: hd.par,
          yardage: (hd as any).yardage,
          handicap: hd.handicap,
          lat: hd.lat,
          lng: hd.lng,
          front_lat: hd.front_lat,
          front_lng: hd.front_lng,
          back_lat: hd.back_lat,
          back_lng: hd.back_lng,
        };
      }),
    };

    const serverCourse = await courseApi.createCourse(payload);

    await db.transaction('rw', [db.courses, db.hole_definitions], async () => {
      await db.hole_definitions.where('courseId').equals(courseId).delete();
      await db.courses.delete(courseId);
    });

    await CourseStore.fetchById(serverCourse.id);
  },

  async create(
    course: Omit<LocalCourse, 'id' | 'serverId' | 'syncStatus'>,
  ): Promise<LocalCourse> {
    const newCourse: Course = {
      ...course,
      syncStatus: SyncStatus.PENDING,
    };
    const id = await db.courses.add(newCourse);

    await addToSyncQueue('course', id as number, 'create', {
      ...newCourse,
      id,
    });

    if (isOnline()) {
      try {
        const holeDefs = await db.hole_definitions
          .where('courseId')
          .equals(id as number)
          .toArray();
        const payload = {
          name: newCourse.name,
          city: newCourse.city,
          state: newCourse.state,
          lat: newCourse.lat,
          lng: newCourse.lng,
          hole_definitions: holeDefs.map((hd) => ({
            hole_number: hd.holeNumber,
            par: hd.par,
            yardage: (hd as any).yardage,
            handicap: hd.handicap,
            lat: hd.lat,
            lng: hd.lng,
            hazards: hd.hazards,
            geo_features: hd.geo_features,
          })),
        };

        const serverCourse = await courseApi.createCourse(payload);
        await db.courses.update(id as number, {
          serverId: serverCourse.id,
          syncStatus: SyncStatus.SYNCED,
        });

        const qi = await db.syncQueue
          .where('entity')
          .equals('course')
          .and((q) => q.entityId === id)
          .first();
        if (qi?.id) await removeFromSyncQueue(qi.id);

        return {
          ...(newCourse as LocalCourse),
          id,
          serverId: serverCourse.id,
          syncStatus: SyncStatus.SYNCED,
        };
      } catch (err) {
        console.error('Failed to sync course create:', err);
      }
    }

    return { ...(newCourse as LocalCourse), id } as LocalCourse;
  },

  async fetchById(serverId: number): Promise<LocalCourse | null> {
    const serverCourse: ServerCourse = await courseApi.getCourse(serverId);
    const courseRecord: Course = {
      serverId: serverCourse.id,
      name: serverCourse.name,
      city: serverCourse.city,
      state: serverCourse.state,
      lat: serverCourse.lat,
      lng: serverCourse.lng,
      status: 'published',
      syncStatus: SyncStatus.SYNCED,
    };

    const existing = await CourseStore.getByServerId(serverId);

    await db.transaction('rw', [db.courses, db.hole_definitions], async () => {
      let localCourseId: number;
      if (existing?.id) {
        localCourseId = existing.id;
        await db.courses.put({ ...courseRecord, id: localCourseId });

        await db.hole_definitions
          .where('courseId')
          .equals(localCourseId)
          .delete();
      } else {
        localCourseId = (await db.courses.add(courseRecord)) as number;
      }

      if (
        serverCourse.hole_definitions &&
        serverCourse.hole_definitions.length > 0
      ) {
        const holeDefs = serverCourse.hole_definitions.map((hd) => ({
          serverId: hd.id,
          courseId: localCourseId,
          holeNumber: hd.hole_number,
          par: hd.par,
          yardage: hd.yardage,
          handicap: hd.handicap,
          lat: hd.lat,
          lng: hd.lng,
          front_lat: hd.front_lat,
          front_lng: hd.front_lng,
          back_lat: hd.back_lat,
          back_lng: hd.back_lng,
          hazards: hd.hazards,
          geo_features: hd.geo_features,
          syncStatus: SyncStatus.SYNCED,
        })) as HoleDefinition[];
        await db.hole_definitions.bulkAdd(holeDefs);
      }
    });

    return CourseStore.getByServerId(serverId);
  },

  async localUpdateCourse(course: LocalCourse) {
    const newCourse: Course = {
      ...course,
      syncStatus: SyncStatus.PENDING,
    };
    await db.courses.upsert(newCourse.id, newCourse);
  },
};

export const UserStore = {
  async getUser(): Promise<LocalUser | null> {
    const user = await db.users.toCollection().first();
    return user ?? null;
  },

  async saveUser(user: Omit<LocalUser, 'id'> | LocalUser): Promise<void> {
    await db.users.clear();
    await db.users.add(user as User);
  },

  async clearUser(): Promise<void> {
    await db.users.clear();
  },
};

export async function processSync(): Promise<void> {
  if (!isOnline()) return;

  const pending = await getPendingSyncItems();
  for (const item of pending) {
    try {
      switch (item.entity) {
        case 'round': {
          if (item.operation === 'create' || item.operation === 'update') {
            await RoundStore.syncToServer(item.entityId);
          } else if (item.operation === 'delete') {
            const payload = item.payload as { serverId?: number };
            if (payload?.serverId) {
              await roundApi.deleteRound(payload.serverId);
              await db.transaction('rw', [db.rounds, db.holes], async () => {
                await db.holes.where('roundId').equals(item.entityId).delete();
                await db.rounds.delete(item.entityId);
              });
            } else {
              await db.transaction('rw', [db.rounds, db.holes], async () => {
                await db.holes.where('roundId').equals(item.entityId).delete();
                await db.rounds.delete(item.entityId);
              });
            }
          }
          break;
        }

        case 'club': {
          if (item.operation === 'create') {
            await bagApi.createBag(item.payload as Record<string, string>);
            await ClubStore.fetchFromServer();
          } else if (item.operation === 'update') {
            await bagApi.updateBag(item.payload as Record<string, string>);
            await ClubStore.fetchFromServer();
          }
          break;
        }

        case 'course': {
          if (item.operation === 'create') {
            const localCourseId = item.entityId;
            const course = await db.courses.get(localCourseId);
            if (!course) break;

            const holeDefs = await db.hole_definitions
              .where('courseId')
              .equals(localCourseId)
              .toArray();
            const payload = {
              name: course.name,
              city: course.city,
              state: course.state,
              lat: course.lat,
              lng: course.lng,
              hole_definitions: holeDefs.map((hd) => ({
                hole_number: hd.holeNumber,
                par: hd.par,
                yardage: (hd as any).yardage,
                handicap: hd.handicap,
                lat: hd.lat,
                lng: hd.lng,
                hazards: hd.hazards,
                geo_features: hd.geo_features,
              })),
            };

            const serverCourse = await courseApi.createCourse(payload);
            await db.courses.update(localCourseId, {
              serverId: serverCourse.id,
              syncStatus: SyncStatus.SYNCED,
            });
          } else if (item.operation === 'update') {
            const localCourseId = item.entityId;
            const course = await db.courses.get(localCourseId);
            if (!course) break;
            const holeDefs = await db.hole_definitions
              .where('courseId')
              .equals(localCourseId)
              .toArray();

            const serverId = course.serverId;
            const payload = {
              name: course.name,
              city: course.city,
              state: course.state,
              lat: course.lat,
              lng: course.lng,
              hole_definitions: holeDefs.map((hd) => ({
                hole_number: hd.holeNumber,
                par: hd.par,
                yardage: (hd as any).yardage,
                handicap: hd.handicap,
                lat: hd.lat,
                lng: hd.lng,
                hazards: hd.hazards,
                geo_features: hd.geo_features,
              })),
            };

            if (serverId) {
              await courseApi.updateCourse(serverId, payload);
              await db.courses.update(localCourseId, {
                syncStatus: SyncStatus.SYNCED,
              });
            } else {
              const serverCourse = await courseApi.createCourse(payload);
              await db.courses.update(localCourseId, {
                serverId: serverCourse.id,
                syncStatus: SyncStatus.SYNCED,
              });
            }
          }
          break;
        }

        default:
          console.warn('Unknown sync entity:', item.entity);
      }

      if (item.id) await removeFromSyncQueue(item.id);
    } catch (err) {
      console.error('Sync item failed:', item, err);
      if (item.id) await markSyncAttempt(item.id, String(err));
    }
  }
}

export default {
  rounds: RoundStore,
  holes: HoleStore,
  clubs: ClubStore,
  courses: CourseStore,
  processSync,
  getPendingSyncItems,
  getSyncQueueCount,
  isOnline,
};
