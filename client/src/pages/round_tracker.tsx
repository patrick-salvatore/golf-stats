import {
  createSignal,
  Show,
  createRenderEffect,
  createEffect,
  onCleanup,
} from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useRounds } from '~/context/round_provider';
import { useClubs } from '~/hooks/use_local_data';
import {
  RoundStore,
  HoleStore,
  CourseStore,
  type LocalHole,
  type LocalClub,
  type LocalCourse,
} from '~/lib/local-data';
import type { HoleDefinition as StoredHoleDefinition } from '~/lib/db';
import { ClubSelector } from '~/components/club_selector';
import { RoundSetup } from '~/components/round_setup';
import { RoundSummary } from '~/components/round_summary';
import { ScoreInput } from '~/components/score_input';
import { FairwayInput } from '~/components/fairway_input';
import { ApproachInput } from '~/components/approach_input';
import { RecoveryInput } from '~/components/recovery_input';
import { PuttInput } from '~/components/putt_input';
import { HoleMap } from '~/components/hole_map';
import { HoleDetailView } from '~/components/hole_detail_view';

// Hole type for internal use (matches what RoundSummary expects)
interface Hole {
  id?: number;
  roundId: number;
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayStatus?: 'hit' | 'left' | 'right';
  girStatus?: 'hit' | 'long' | 'short' | 'left' | 'right';
  fairwayBunker: boolean;
  greensideBunker: boolean;
  proximityToHole?: number;
  clubIds?: number[];
}

export default function RoundTracker() {
  const navigate = useNavigate();
  const { syncRound } = useRounds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = createSignal<
    'setup' | 'playing' | 'summary' | 'viewing'
  >('setup');

  // Viewing state (for read-only hole detail)
  const [viewingHoleNum, setViewingHoleNum] = createSignal<number | null>(null);

  // Course State
  const [courseName, setCourseName] = createSignal('');
  const [_, setCourseId] = createSignal<number | undefined>(undefined);
  const [holeDefinitions, setHoleDefinitions] = createSignal<
    StoredHoleDefinition[]
  >([]);

  // Round State
  const [currentHoleNum, setCurrentHoleNum] = createSignal(1);
  const [holes, setHoles] = createSignal<Hole[]>([]);
  const [roundId, setRoundId] = createSignal<number | null>(null);
  const [isSynced, setIsSynced] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  // Use clubs from local-first hook
  const clubsQuery = useClubs();
  const availableClubs = () => clubsQuery.data ?? [];

  // View State
  const [viewMode, setViewMode] = createSignal<'score' | 'map'>('score');
  const [userLat, setUserLat] = createSignal<number | undefined>(undefined);
  const [userLng, setUserLng] = createSignal<number | undefined>(undefined);

  // Current Hole Input State
  const [par, setPar] = createSignal(4);
  const [score, setScore] = createSignal(4);
  const [putts, setPutts] = createSignal(2);
  const [selectedClubs, setSelectedClubs] = createSignal<LocalClub[]>([]);

  // New Detailed Stats
  const [fairwayStatus, setFairwayStatus] = createSignal<
    'hit' | 'left' | 'right' | null
  >(null);
  const [girStatus, setGirStatus] = createSignal<
    'hit' | 'long' | 'short' | 'left' | 'right' | null
  >(null);
  const [proximity, setProximity] = createSignal(20); // Default 20ft
  const [fairwayBunker, setFairwayBunker] = createSignal(false);
  const [greensideBunker, setGreensideBunker] = createSignal(false);

  // Geolocation
  createEffect(() => {
    if (step() === 'playing' && 'geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        },
        (err) => console.warn('Geolocation error', err),
        { enableHighAccuracy: true },
      );
      onCleanup(() => navigator.geolocation.clearWatch(id));
    }
  });

  const resetHoleStats = (holeNum: number) => {
    // If we have hole definitions, use them
    const def = holeDefinitions().find((h) => h.holeNumber === holeNum);

    setPar(def?.par || 4);
    setScore(def?.par || 4); // Default score to par
    setPutts(2);
    setFairwayStatus('hit');
    setGirStatus('hit');
    setProximity(20);
    setFairwayBunker(false);
    setGreensideBunker(false);
    setSelectedClubs([]);
    setLoading(false);

    // Switch to map view if we have coords
    if (def?.lat && def?.lng) {
      setViewMode('map');
    } else {
      setViewMode('score');
    }
  };

  // Restore state from URL if present
  createRenderEffect(async () => {
    const idParam = searchParams.id;
    const idStr = Array.isArray(idParam) ? idParam[0] : idParam;
    const holeParam = searchParams.hole;
    const holeStr = Array.isArray(holeParam) ? holeParam[0] : holeParam;
    const isReadonly = searchParams.readonly === 'true';

    if (idStr) {
      const rid = parseInt(idStr);
      if (!isNaN(rid)) {
        try {
          setLoading(true);
          const round = await RoundStore.getById(rid);
          if (round) {
            setRoundId(rid);
            setCourseName(round.courseName);
            setCourseId(round.courseId);

            // Fetch course definitions if we have an ID
            if (round.courseId) {
              try {
                const fullCourse = await CourseStore.fetchById(round.courseId);
                if (fullCourse && fullCourse.holeDefinitions) {
                  setHoleDefinitions(fullCourse.holeDefinitions);
                }
              } catch (e) {
                console.warn('Could not load course definitions', e);
              }
            }

            const existingHoles = await HoleStore.getForRound(rid);
            // Sort by hole number
            existingHoles.sort((a, b) => a.holeNumber - b.holeNumber);
            setHoles(existingHoles);

            // Handle readonly mode with specific hole
            if (isReadonly && holeStr) {
              const holeNum = parseInt(holeStr);
              if (!isNaN(holeNum)) {
                setViewingHoleNum(holeNum);
                setStep('viewing');
                setIsSynced(true);
              } else {
                setStep('summary');
                setIsSynced(true);
              }
            } else if (existingHoles.length >= 18) {
              setStep('summary');
            } else {
              setStep('playing');
              const nextHole = existingHoles.length + 1;
              setCurrentHoleNum(nextHole);
              resetHoleStats(nextHole);
            }
          } else {
            // Round not found in active rounds - might be synced
            // Check if it's a synced round by trying to navigate
            setIsSynced(true);
            setStep('summary');
          }
        } catch (e) {
          console.error('Failed to load round', e);
        } finally {
          setLoading(false);
        }
      }
    }
  });

  const startRound = async (course?: LocalCourse) => {
    const name = course ? course.name : courseName();
    if (!name) return;

    try {
      const now = new Date().toISOString();
      const date = now.split('T')[0];

      let cid = course?.serverId ?? course?.id;
      let holesDefs: StoredHoleDefinition[] = [];

      // If a course was selected, get full details
      if (cid) {
        try {
          const full = await CourseStore.fetchById(cid);
          if (full) {
            cid = full.serverId ?? full.id;
            holesDefs = full.holeDefinitions || [];
            setHoleDefinitions(holesDefs);
          }
        } catch (e) {
          console.error('Failed to fetch full course details', e);
        }
      }

      // Create local round using RoundStore
      const newRound = await RoundStore.create({
        courseName: name,
        courseId: cid,
        date,
        totalScore: 0,
        createdAt: now,
      });

      const id = newRound.id!;

      setRoundId(id);
      setCourseName(name);
      setCourseId(cid);
      setStep('playing');

      setSearchParams({ id: String(id) });
      resetHoleStats(1);
    } catch (e) {
      console.error('Failed to start round', e);
    }
  };

  const addClubToHole = (club: LocalClub) => {
    const current = selectedClubs();
    if (current.length > 0 && current[current.length - 1].id === club.id) {
      setSelectedClubs(current.slice(0, -1));
    } else {
      setSelectedClubs([...current, club]);
    }
  };

  const saveHole = async () => {
    const rid = roundId();
    if (!rid) return;

    const holeData: Omit<LocalHole, 'id'> = {
      roundId: rid,
      holeNumber: currentHoleNum(),
      par: par(),
      score: score(),
      putts: putts(),
      fairwayStatus: fairwayStatus() || undefined,
      girStatus: girStatus() || undefined,
      fairwayBunker: fairwayBunker(),
      greensideBunker: greensideBunker(),
      proximityToHole: girStatus() === 'hit' ? proximity() : undefined,
      clubIds: selectedClubs()
        .map((c) => c.id)
        .filter((id): id is number => id !== undefined),
    };

    try {
      await HoleStore.addOrUpdate(rid, holeData);
      const newHoles = [...holes(), holeData];
      setHoles(newHoles);

      // Update running total
      const totalScore = newHoles.reduce((acc, h) => acc + h.score, 0);
      await RoundStore.update(rid, { totalScore });

      if (currentHoleNum() === 18) {
        setStep('summary');
      } else {
        const nextHole = currentHoleNum() + 1;
        setCurrentHoleNum(nextHole);
        resetHoleStats(nextHole);
      }
    } catch (e) {
      console.error('Failed to save hole', e);
    }
  };

  const prevHole = async () => {
    if (currentHoleNum() <= 1) return;

    const rid = roundId();
    if (!rid) return;

    const previousHoleIdx = holes().length - 1;
    const previousHole = holes()[previousHoleIdx];

    if (previousHole) {
      setPar(previousHole.par);
      setScore(previousHole.score);
      setPutts(previousHole.putts);
      setFairwayStatus(previousHole.fairwayStatus || null);
      setGirStatus(previousHole.girStatus || null);
      setFairwayBunker(previousHole.fairwayBunker);
      setGreensideBunker(previousHole.greensideBunker);
      setProximity(previousHole.proximityToHole || 20);

      if (previousHole.clubIds && previousHole.clubIds.length > 0) {
        const ordered = previousHole.clubIds
          .map((id) => availableClubs().find((c) => c.id === id))
          .filter(Boolean) as LocalClub[];
        setSelectedClubs(ordered);
      } else {
        setSelectedClubs([]);
      }

      // Remove the hole from storage
      const updatedHoles = holes().slice(0, -1);
      await HoleStore.saveAll(rid, updatedHoles as LocalHole[]);

      // Update round total
      const newTotal = updatedHoles.reduce((acc, h) => acc + h.score, 0);
      await RoundStore.update(rid, { totalScore: newTotal });

      setHoles(updatedHoles);
      setCurrentHoleNum(currentHoleNum() - 1);
    }
  };

  const finishRound = async () => {
    const rid = roundId();
    if (rid) {
      const totalScore = holes().reduce((acc, h) => acc + h.score, 0);
      const endedAt = new Date().toISOString();

      // Update round with final score and end time
      await RoundStore.update(rid, { totalScore, endedAt });

      // Sync to server
      await syncRound(rid);
    }
  };

  return (
    <div class="min-h-screen flex flex-col bg-golf-dark text-white">
      {loading() ? null : (
        <>
          <Show when={step() === 'setup'}>
            <RoundSetup
              courseName={courseName}
              setCourseName={setCourseName}
              onStart={startRound}
            />
          </Show>

          <Show when={step() === 'playing'}>
            <div class="flex-1 flex flex-col pb-8">
              {/* Header */}
              <div class="bg-slate-900/80 backdrop-blur-md p-4 sticky top-0 z-10 border-b border-white/5">
                <div class="max-w-md mx-auto flex justify-between items-center">
                  <div>
                    <h2 class="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                      Hole {currentHoleNum()}
                    </h2>
                    <span class="text-white font-semibold truncate max-w-[200px] block">
                      {courseName()}
                    </span>
                  </div>
                  <div class="text-right">
                    <span class="text-xs text-slate-400 block">Total</span>
                    <span class="font-mono font-bold text-white text-lg">
                      {holes().reduce((acc, h) => acc + h.score, 0) +
                        (score() - par())}
                    </span>
                  </div>
                </div>
              </div>

              {/* View Toggle */}
              <div class="flex justify-center my-4 gap-2">
                <button
                  onClick={() => setViewMode('score')}
                  class={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode() === 'score' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  Score
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  class={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode() === 'map' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  Map
                </button>
              </div>

              <div class="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-6">
                <Show when={viewMode() === 'map'}>
                  <HoleMap
                    holeDef={
                      holeDefinitions().find(
                        (h) => h.holeNumber === currentHoleNum(),
                      ) || null
                    }
                    userLat={userLat()}
                    userLng={userLng()}
                  />
                </Show>

                <Show when={viewMode() === 'score'}>
                  {/* Club Selector */}
                  <div class="card p-0 overflow-hidden bg-transparent border-none shadow-none">
                    <div class="flex justify-between items-baseline mb-2 px-1">
                      <label class="text-slate-400 text-xs font-bold uppercase tracking-wider">
                        Club Sequence
                      </label>
                      <span class="text-[10px] text-slate-500 font-mono">
                        {selectedClubs()
                          .map((c) => c.name)
                          .join(' → ')}
                      </span>
                    </div>
                    <ClubSelector
                      clubs={availableClubs()}
                      selectedClubs={selectedClubs()}
                      onClubSelect={addClubToHole}
                    />
                  </div>

                  <ScoreInput
                    par={par}
                    setPar={setPar}
                    score={score}
                    setScore={setScore}
                  />

                  <Show when={par() > 3}>
                    <FairwayInput
                      status={fairwayStatus}
                      setStatus={setFairwayStatus}
                    />
                  </Show>

                  <ApproachInput
                    girStatus={girStatus}
                    setGirStatus={setGirStatus}
                    proximity={proximity}
                    setProximity={setProximity}
                  />

                  <RecoveryInput
                    fairwayBunker={fairwayBunker}
                    setFairwayBunker={setFairwayBunker}
                    greensideBunker={greensideBunker}
                    setGreensideBunker={setGreensideBunker}
                  />

                  <PuttInput putts={putts} setPutts={setPutts} />
                </Show>
              </div>

              {/* Footer */}
              <div class="p-4 bg-gradient-to-t from-golf-dark to-transparent sticky bottom-0 z-20 flex gap-3">
                <Show when={currentHoleNum() > 1}>
                  <button
                    onClick={prevHole}
                    class="w-1/3 bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-bold text-lg shadow-xl active:scale-[0.98] transition-all flex items-center justify-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414-1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </Show>
                <button
                  onClick={saveHole}
                  class="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>Next Hole</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </Show>

          <Show when={step() === 'summary'}>
            <RoundSummary
              courseName={courseName()}
              holes={holes()}
              clubs={availableClubs()}
              isSynced={isSynced()}
              onAction={() => (isSynced() ? navigate('/') : finishRound())}
              onHoleClick={(holeNum) => {
                setViewingHoleNum(holeNum);
                setStep('viewing');
              }}
            />
          </Show>

          <Show when={step() === 'viewing' && viewingHoleNum()}>
            {(() => {
              const holeNum = viewingHoleNum();
              const hole = holes().find((h) => h.holeNumber === holeNum);
              if (!hole) return null;

              return (
                <HoleDetailView
                  hole={hole}
                  holes={holes()}
                  clubs={availableClubs()}
                  courseName={courseName()}
                  onBack={() => {
                    setViewingHoleNum(null);
                    setStep('summary');
                  }}
                  onNavigate={(num) => setViewingHoleNum(num)}
                />
              );
            })()}
          </Show>
        </>
      )}
    </div>
  );
}
