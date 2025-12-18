import { Show, onMount } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { useAppContext } from '~/context/app_provider';

import {
  RoundStore,
  HoleStore,
  CourseStore,
  type LocalHole,
  type LocalClub,
  type LocalCourse,
  type LocalRound,
} from '~/lib/stores';
import { SyncStatus } from '~/lib/db';
import type {
  FairwayStatus,
  GIRStatus,
  HoleDefinition,
} from '~/lib/db';

import { RoundSetup } from '~/components/round_setup';
import { RoundSummary } from '~/components/round_summary';
import { HoleDetailView } from '~/components/hole_detail_view';
import { HoleInputForm } from './round_tracker/hole_input_form';

/* -------------------------
   Local UI types (internal)
   ------------------------- */

interface HoleUI {
  id?: number;
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
}

type ViewMode = 'playing' | 'view' | 'edit';
type TrackerStep = 'setup' | 'playing' | 'summary' | 'viewing' | 'edit';

interface TrackerState {
  step: TrackerStep;
  loading: boolean;
  viewingHoleNum: number | null;
  editingHoleNum: number | null;
  inputViewMode: 'score' | 'map';
  userLat?: number;
  userLng?: number;
}

interface RoundState {
  id: number | null;
  data: LocalRound | null;
  courseName: string;
  holeDefinitions: Partial<HoleDefinition>[];
  holes: HoleUI[];
  currentHoleNum: number;
}

interface HoleInputState {
  par: number;
  score: number;
  putts: number;
  fairwayStatus: FairwayStatus | null;
  girStatus: GIRStatus | null;
  proximity: number;
  fairwayBunker: boolean;
  greensideBunker: boolean;
  selectedClubs: LocalClub[];
}

const defaultHoleInput: HoleInputState = {
  par: 4,
  score: 4,
  putts: 2,
  fairwayStatus: 'hit',
  girStatus: 'hit',
  proximity: 20,
  fairwayBunker: false,
  greensideBunker: false,
  selectedClubs: [],
};

/* -------------------------
   Component
   ------------------------- */

export default function RoundTracker() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams<{
    mode?: ViewMode;
    hole?: string;
  }>();
  const { syncRound, clubs, deleteRound } = useAppContext();

  const [tracker, setTracker] = createStore<TrackerState>({
    step: 'setup',
    loading: true,
    viewingHoleNum: null,
    editingHoleNum: null,
    inputViewMode: 'score',
  });

  const [round, setRound] = createStore<RoundState>({
    id: null,
    data: null,
    courseName: '',
    holeDefinitions: [],
    holes: [],
    currentHoleNum: 1,
  });

  const [holeInput, setHoleInput] =
    createStore<HoleInputState>(defaultHoleInput);

  const isRoundSynced = () => round.data?.syncStatus === SyncStatus.SYNCED;

  const resetHoleInput = (holeNum: number) => {
    const def = round.holeDefinitions.find((h) => h.holeNumber === holeNum);
    const parValue = def?.par ?? 4;

    setHoleInput({
      par: parValue,
      score: parValue,
      putts: 2,
      fairwayStatus: 'hit',
      girStatus: 'hit',
      proximity: 20,
      fairwayBunker: false,
      greensideBunker: false,
      selectedClubs: [],
    });

    setTracker('inputViewMode', def?.lat && def?.lng ? 'map' : 'score');
  };

  const loadHoleForEditing = (holeNum: number) => {
    const hole = round.holes.find((h) => h.holeNumber === holeNum);
    if (!hole) {
      resetHoleInput(holeNum);
      return;
    }

    const filteredClubs = hole.clubIds?.length
      ? hole.clubIds
          .map((id) => (clubs() ?? []).find((c) => c.id === id))
          .filter((c): c is LocalClub => c !== undefined)
      : [];

    setHoleInput({
      par: hole.par,
      score: hole.score,
      putts: hole.putts,
      fairwayStatus: hole.fairwayStatus ?? null,
      girStatus: hole.girStatus ?? null,
      proximity: hole.proximityToHole ?? 20,
      fairwayBunker: hole.fairwayBunker,
      greensideBunker: hole.greensideBunker,
      selectedClubs: filteredClubs,
    });

    setTracker('inputViewMode', 'score');
  };

  function buildHoleDataObj(holeNum: number): Omit<LocalHole, 'id'> {
    // LocalHole extends Hole; create Omit<LocalHole,'id'>
    const hole: Omit<LocalHole, 'id'> = {
      roundId: round.id as number, // caller ensures round.id exists
      holeNumber: holeNum,
      par: holeInput.par,
      score: holeInput.score,
      putts: holeInput.putts,
      fairwayStatus: holeInput.fairwayStatus ?? undefined,
      girStatus: holeInput.girStatus ?? undefined,
      fairwayBunker: holeInput.fairwayBunker,
      greensideBunker: holeInput.greensideBunker,
      proximityToHole:
        holeInput.girStatus === 'hit' ? holeInput.proximity : undefined,
      clubIds: holeInput.selectedClubs
        .map((c) => c.id)
        .filter((id): id is number => id !== undefined),
      // syncStatus will be filled by store if needed; not required for input
    } as Omit<LocalHole, 'id'>;

    return hole;
  }

  const refreshHolesFromDb = async (roundId: number) => {
    const dbHoles = await HoleStore.getForRound(roundId);
    // map DB holes (LocalHole) to UI HoleUI
    const holesUI: HoleUI[] = dbHoles.map((h) => ({
      id: h.id,
      roundId: h.roundId,
      holeNumber: h.holeNumber,
      par: h.par,
      score: h.score,
      putts: h.putts,
      fairwayStatus: h.fairwayStatus,
      girStatus: h.girStatus,
      fairwayBunker: h.fairwayBunker,
      greensideBunker: h.greensideBunker,
      proximityToHole: h.proximityToHole,
      clubIds: h.clubIds ?? [],
    }));
    // ensure sorted
    holesUI.sort((a, b) => a.holeNumber - b.holeNumber);

    setRound('holes', holesUI);
  };

  /* -------------------------
     Start a new round
     ------------------------- */
  const startRound = async (course?: LocalCourse) => {
    const name = course?.name || round.courseName;
    if (!name) return;

    try {
      const now = new Date().toISOString();
      const date = now.split('T')[0];

      // courseId should use serverId if available, else local id
      let courseId = course?.serverId ?? course?.id;
      let holeDefs: Partial<HoleDefinition>[] = [];

      if (courseId) {
        try {
          // fetch normalized course (CourseStore.fetchById accepts serverId)
          const full = await CourseStore.fetchById(courseId);
          if (full) {
            // prefer serverId for canonical linkage; keep hole definitions
            courseId = full.serverId ?? full.id;
            holeDefs = full.holeDefinitions ?? [];
          }
        } catch (e) {
          console.error('Failed to fetch full course details', e);
        }
      }

      // create the minimal LocalRound payload; LocalRound requires holes & courseName
      const payload: Omit<LocalRound, 'id' | 'syncStatus'> = {
        // from Round (BaseEntity) + LocalRound additions
        courseId: courseId ?? 0,
        date,
        totalScore: 0,
        courseName: name,
        createdAt: now,
        endedAt: undefined,
        holes: [], // start empty
        // Note: syncStatus omitted per function signature
      } as Omit<LocalRound, 'id' | 'syncStatus'>;

      const newRound = await RoundStore.create(payload);

      // ensure we set round state to the created local round
      await refreshHolesFromDb(newRound.id!);

      setRound({
        id: newRound.id!,
        data: newRound,
        courseName: name,
        holeDefinitions: holeDefs,
        holes: [], // we've just refreshed DB; may be empty
        currentHoleNum: 1,
      });

      navigate(`/track/${newRound.id}?mode=playing`);
      resetHoleInput(1);
      setTracker('step', 'playing');
    } catch (e) {
      console.error('Failed to start round', e);
    }
  };

  /* -------------------------
     Save current hole (playing flow)
     ------------------------- */
  const saveHole = async () => {
    if (!round.id) return;

    const holeNum = round.currentHoleNum;
    const holePayload = buildHoleDataObj(holeNum);

    try {
      // Save via HoleStore (guarantees proper typing & DB consistency)
      await HoleStore.addOrUpdate(round.id, holePayload);

      // refresh holes from DB to ensure authoritative shape & serverIds etc.
      await refreshHolesFromDb(round.id);

      // recalculate totalScore from DB holes
      const dbHoles = round.holes; // updated by refreshHolesFromDb via setRound
      const totalScore = dbHoles.reduce((acc, h) => acc + (h.score ?? 0), 0);

      // update round total on DB and local state
      await RoundStore.update(round.id, { totalScore });

      // advance or finish
      if (holeNum >= 18) {
        setSearchParams({ mode: undefined, hole: undefined });
        setTracker('step', 'summary');
      } else {
        const nextHole = holeNum + 1;
        setRound('currentHoleNum', nextHole);
        resetHoleInput(nextHole);
      }
    } catch (e) {
      console.error('Failed to save hole', e);
    }
  };

  /* -------------------------
     Save an edited hole (edit flow)
     ------------------------- */
  const saveEditedHole = async () => {
    if (!round.id || !tracker.editingHoleNum) return;

    const holeNum = tracker.editingHoleNum;
    const holePayload = buildHoleDataObj(holeNum);

    try {
      await HoleStore.addOrUpdate(round.id, holePayload);

      // refresh authoritative holes
      await refreshHolesFromDb(round.id);

      const totalScore = round.holes.reduce(
        (acc, h) => acc + (h.score ?? 0),
        0,
      );
      await RoundStore.update(round.id, { totalScore });

      setTracker({ editingHoleNum: null, step: 'summary' });
      setSearchParams({ mode: undefined, hole: undefined });
    } catch (e) {
      console.error('Failed to save edited hole', e);
    }
  };

  /* -------------------------
     Prev hole (undo last recorded hole)
     ------------------------- */
  const prevHole = async () => {
    if (!round.id || round.currentHoleNum <= 1) return;

    // If there are no holes, nothing to undo
    if (round.holes.length === 0) return;

    // remove last hole locally (UI)
    const updatedHoles = round.holes.slice(0, -1);

    // convert UI holes back into LocalHole shape for saveAll
    const payloadHoles: Omit<LocalHole, 'id'>[] = updatedHoles.map((h) => ({
      // roundId required and known
      roundId: round.id as number,
      holeNumber: h.holeNumber,
      par: h.par,
      score: h.score,
      putts: h.putts,
      fairwayStatus: h.fairwayStatus,
      girStatus: h.girStatus,
      fairwayBunker: h.fairwayBunker,
      greensideBunker: h.greensideBunker,
      proximityToHole: h.proximityToHole,
      clubIds: h.clubIds,
      syncStatus: SyncStatus.PENDING,
    }));

    try {
      await HoleStore.saveAll(round.id, payloadHoles);

      const newTotal = payloadHoles.reduce((acc, h) => acc + (h.score ?? 0), 0);
      await RoundStore.update(round.id, { totalScore: newTotal });

      setRound(
        produce((s) => {
          s.holes = updatedHoles;
          s.currentHoleNum = Math.max(1, s.currentHoleNum - 1);
        }),
      );
    } catch (e) {
      console.error('Failed to revert last hole', e);
    }
  };

  /* -------------------------
     Finish round
     ------------------------- */
  const finishRound = async () => {
    if (!round.id) return;

    const totalScore = round.holes.reduce((acc, h) => acc + (h.score ?? 0), 0);
    const endedAt = new Date().toISOString();

    try {
      await RoundStore.update(round.id, { totalScore, endedAt });
      // kick off sync via app context helper (if provided)
      if (typeof syncRound === 'function') {
        await syncRound(round.id);
      } else {
        // fallback: attempt to process sync queue
        // (processSync is available from LocalData if needed)
      }

      setTracker('step', 'summary');
    } catch (e) {
      console.error('Failed to finish round', e);
    }
  };

  /* -------------------------
     UI navigation helpers
     ------------------------- */

  const handleHoleClick = (holeNum: number) => {
    setTracker({ viewingHoleNum: holeNum, step: 'viewing' });
    setSearchParams({ mode: 'view', hole: String(holeNum) });
  };

  const handleEdit = () => {
    if (!round.id) return;
    setRound('currentHoleNum', 1);
    loadHoleForEditing(1);
    setTracker({ editingHoleNum: 1, step: 'edit' });
    setSearchParams({ mode: 'edit', hole: '1' });
  };

  const handleEditHole = (holeNum: number) => {
    if (!round.id) return;
    setRound('currentHoleNum', holeNum);
    loadHoleForEditing(holeNum);
    setTracker({ editingHoleNum: holeNum, step: 'edit' });
    setSearchParams({ mode: 'edit', hole: String(holeNum) });
  };

  const handleBackFromViewing = () => {
    setTracker({ viewingHoleNum: null, step: 'summary' });
    setSearchParams({ mode: undefined, hole: undefined });
  };

  const handleNavigateHoleInView = (num: number) => {
    setTracker('viewingHoleNum', num);
    setSearchParams({ mode: 'view', hole: String(num) });
  };

  const handleCancelEdit = () => {
    setTracker({ editingHoleNum: null, step: 'summary' });
    setSearchParams({ mode: undefined, hole: undefined });
  };

  const addClubToHole = (club: LocalClub) => {
    setHoleInput(
      produce((s) => {
        const selected = new Set(s.selectedClubs.map((c) => c.id));
        if (selected.has(club.id)) {
          s.selectedClubs = s.selectedClubs.filter((c) => c.id !== club.id);
        } else {
          s.selectedClubs = [...s.selectedClubs, club];
        }
      }),
    );
  };

  /* -------------------------
     onMount: load round from URL
     ------------------------- */
  onMount(async () => {
    const idStr = params.id;
    const mode = searchParams.mode;
    const holeStr = searchParams.hole;

    if (!idStr) {
      setTracker({ loading: false, step: 'setup' });
      return;
    }

    const rid = parseInt(idStr, 10);
    if (isNaN(rid)) {
      setTracker({ loading: false, step: 'setup' });
      return;
    }

    try {
      const roundData = await RoundStore.getById(rid);
      if (!roundData) {
        navigate('/track');
        return;
      }

      // Load course hole definitions (normalized)
      let holeDefs: Partial<HoleDefinition>[] = [];
      if (roundData.courseId) {
        try {
          // fetchById expects serverId; support both serverId/local id
          const courseServerId = roundData.courseId;
          const fullCourse = await CourseStore.fetchById(courseServerId);
          holeDefs = fullCourse?.holeDefinitions ?? [];
        } catch (e) {
          console.warn('Could not load course definitions', e);
        }
      }

      // Load existing holes (authoritative)
      await refreshHolesFromDb(rid);
      const existingHoles = round.holes; // updated by refreshHolesFromDb

      setRound({
        id: rid,
        data: roundData,
        courseName: roundData.courseName,
        holeDefinitions: holeDefs,
        holes: existingHoles,
        currentHoleNum: 1,
      });

      // Determine initial step
      const roundEnded = !!roundData.endedAt;
      const roundSynced = roundData.syncStatus === SyncStatus.SYNCED;

      if (mode === 'edit' && holeStr) {
        const holeNum = parseInt(holeStr, 10);
        if (!isNaN(holeNum) && holeNum >= 1 && holeNum <= 18) {
          setRound('currentHoleNum', holeNum);
          loadHoleForEditing(holeNum);
          setTracker({ editingHoleNum: holeNum, step: 'edit', loading: false });
        } else {
          setTracker({ step: 'summary', loading: false });
        }
      } else if (mode === 'view' && holeStr) {
        const holeNum = parseInt(holeStr, 10);
        if (!isNaN(holeNum)) {
          setTracker({
            viewingHoleNum: holeNum,
            step: 'viewing',
            loading: false,
          });
        } else {
          setTracker({ step: 'summary', loading: false });
        }
      } else if (mode === 'playing' && !roundEnded && !roundSynced) {
        const nextHole = existingHoles.length + 1;
        setRound('currentHoleNum', nextHole);
        resetHoleInput(nextHole);
        setTracker({ step: 'playing', loading: false });
      } else if (existingHoles.length >= 18 || roundEnded || roundSynced) {
        setTracker({ step: 'summary', loading: false });
      } else {
        setSearchParams({ mode: 'playing' });
        const nextHole = existingHoles.length + 1;
        setRound('currentHoleNum', nextHole);
        resetHoleInput(nextHole);
        setTracker({ step: 'playing', loading: false });
      }
    } catch (e) {
      console.error('Failed to load round', e);
      navigate('/track');
    }
  });

  /* -------------------------
     Render (keeps your existing child components)
     ------------------------- */

  return (
    <div class="min-h-screen flex flex-col bg-golf-dark text-white">
      <Show when={!tracker.loading} fallback={null}>
        <Show when={tracker.step === 'setup'}>
          <RoundSetup
            courseName={() => round.courseName}
            setCourseName={(v) =>
              setRound(
                'courseName',
                typeof v === 'function' ? v(round.courseName) : v,
              )
            }
            onStart={startRound}
          />
        </Show>

        <Show when={tracker.step === 'playing' || tracker.step === 'edit'}>
          <HoleInputForm
            tracker={tracker}
            round={round}
            setTracker={setTracker}
            handleCancelEdit={handleCancelEdit}
            saveEditedHole={saveEditedHole}
            saveHole={saveHole}
            prevHole={prevHole}
            holeInput={holeInput}
            addClubToHole={addClubToHole}
            setHoleInput={setHoleInput}
            clubs={clubs ?? []}
            onEndRound={async () => {
              if (confirm('End round now? You can resume it later.')) {
                await finishRound();
                navigate('/');
              }
            }}
          />
        </Show>

        <Show when={tracker.step === 'summary'}>
          <RoundSummary
            courseName={round.courseName}
            holes={round.holes}
            clubs={clubs() ?? []}
            isSynced={isRoundSynced()}
            onAction={() => (isRoundSynced() ? navigate('/') : finishRound())}
            onHoleClick={handleHoleClick}
            onDelete={async () => {
              if (round.id) {
                await deleteRound(round.id!);
                navigate('/');
              }
            }}
            onEdit={handleEdit}
          />
        </Show>

        <Show when={tracker.step === 'viewing' && tracker.viewingHoleNum}>
          <Show
            when={round.holes.find(
              (h) => h.holeNumber === tracker.viewingHoleNum,
            )}
          >
            {(hole) => (
              <HoleDetailView
                holes={round.holes}
                hole={hole()}
                clubs={clubs() ?? []}
                courseName={round.courseName}
                onBack={handleBackFromViewing}
                onNavigate={handleNavigateHoleInView}
                onEdit={() => handleEditHole(hole().holeNumber)}
              />
            )}
          </Show>
        </Show>
      </Show>
    </div>
  );
}
