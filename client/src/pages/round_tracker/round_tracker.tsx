import { Show, onMount } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { useRounds } from '~/context/app_provider';
import { useClubs } from '~/hooks/use_local_data';
import {
  RoundStore,
  HoleStore,
  CourseStore,
  type LocalHole,
  type LocalClub,
  type LocalCourse,
  type LocalRound,
} from '~/lib/local-data';
import { SyncStatus } from '~/lib/db';
import type {
  FairwayStatus,
  GIRStatus,
  HoleDefinition as StoredHoleDefinition,
} from '~/lib/db';
import { RoundSetup } from '~/components/round_setup';
import { RoundSummary } from '~/components/round_summary';
import { HoleDetailView } from '~/components/hole_detail_view';
import { HoleInputForm } from './hole_input_form';

// Hole type for internal use
interface Hole {
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

// URL query param modes
type ViewMode = 'playing' | 'view' | 'edit';

// Internal step for UI rendering
type TrackerStep = 'setup' | 'playing' | 'summary' | 'viewing' | 'edit';

// Store types
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
  holeDefinitions: StoredHoleDefinition[];
  holes: Hole[];
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

export default function RoundTracker() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams<{
    mode?: ViewMode;
    hole?: string;
  }>();
  const { syncRound, deleteRound } = useRounds();
  const clubsQuery = useClubs();

  // Stores
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
    const parValue = def?.par || 4;

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

    const clubs = hole.clubIds?.length
      ? hole.clubIds
          .map((id) => (clubsQuery.data ?? []).find((c) => c.id === id))
          .filter((c): c is LocalClub => c !== undefined)
      : [];

    setHoleInput({
      par: hole.par,
      score: hole.score,
      putts: hole.putts,
      fairwayStatus: hole.fairwayStatus || null,
      girStatus: hole.girStatus || null,
      proximity: hole.proximityToHole || 20,
      fairwayBunker: hole.fairwayBunker,
      greensideBunker: hole.greensideBunker,
      selectedClubs: clubs,
    });

    setTracker('inputViewMode', 'score');
  };

  const startRound = async (course?: LocalCourse) => {
    const name = course?.name || round.courseName;
    if (!name) return;

    try {
      const now = new Date().toISOString();
      const date = now.split('T')[0];

      let courseId = course?.serverId ?? course?.id;
      let holeDefs: StoredHoleDefinition[] = [];

      if (courseId) {
        try {
          const full = await CourseStore.fetchById(courseId);
          if (full) {
            courseId = full.serverId ?? full.id;
            holeDefs = full.holeDefinitions || [];
          }
        } catch (e) {
          console.error('Failed to fetch full course details', e);
        }
      }

      const newRound = await RoundStore.create({
        courseName: name,
        courseId,
        date,
        totalScore: 0,
        createdAt: now,
      });

      setRound({
        id: newRound.id!,
        data: newRound,
        courseName: name,
        holeDefinitions: holeDefs,
        holes: [],
        currentHoleNum: 1,
      });

      navigate(`/track/${newRound.id}?mode=playing`);
      resetHoleInput(1);
      setTracker('step', 'playing');
    } catch (e) {
      console.error('Failed to start round', e);
    }
  };

  const addClubToHole = (club: LocalClub) => {
    setHoleInput(
      produce((s) => {
        const selected = new Set(s.selectedClubs.map((c) => c.id));
        if (selected.has(club.id)) {
          s.selectedClubs = s.selectedClubs.filter((s) => s.id !== club.id);
        } else {
          s.selectedClubs = [...s.selectedClubs, club];
        }
      }),
    );
  };

  const buildHoleData = (holeNum: number): Omit<LocalHole, 'id'> => ({
    roundId: round.id!,
    holeNumber: holeNum,
    par: holeInput.par,
    score: holeInput.score,
    putts: holeInput.putts,
    fairwayStatus: holeInput.fairwayStatus || undefined,
    girStatus: holeInput.girStatus || undefined,
    fairwayBunker: holeInput.fairwayBunker,
    greensideBunker: holeInput.greensideBunker,
    proximityToHole:
      holeInput.girStatus === 'hit' ? holeInput.proximity : undefined,
    clubIds: holeInput.selectedClubs
      .map((c) => c.id)
      .filter((id): id is number => id !== undefined),
  });

  const saveHole = async () => {
    if (!round.id) return;

    const holeData = buildHoleData(round.currentHoleNum);

    try {
      await HoleStore.addOrUpdate(round.id, holeData);

      // Update holes list
      setRound(
        produce((s) => {
          const idx = s.holes.findIndex(
            (h) => h.holeNumber === s.currentHoleNum,
          );
          if (idx >= 0) {
            s.holes[idx] = holeData as Hole;
          } else {
            s.holes = [...s.holes, holeData as Hole];
          }
          s.holes = s.holes.sort((a, b) => a.holeNumber - b.holeNumber);
        }),
      );

      const totalScore = round.holes.reduce((acc, h) => acc + h.score, 0);
      await RoundStore.update(round.id, { totalScore });

      if (round.currentHoleNum === 18) {
        setSearchParams({ mode: undefined, hole: undefined });
        setTracker('step', 'summary');
      } else {
        const nextHole = round.currentHoleNum + 1;
        setRound('currentHoleNum', nextHole);
        resetHoleInput(nextHole);
      }
    } catch (e) {
      console.error('Failed to save hole', e);
    }
  };

  const saveEditedHole = async () => {
    if (!round.id || !tracker.editingHoleNum) return;

    const holeData = buildHoleData(tracker.editingHoleNum);

    try {
      await HoleStore.addOrUpdate(round.id, holeData);

      setRound(
        produce((s) => {
          const idx = s.holes.findIndex(
            (h) => h.holeNumber === tracker.editingHoleNum,
          );
          if (idx >= 0) {
            s.holes[idx] = holeData as Hole;
          } else {
            s.holes = [...s.holes, holeData as Hole];
          }
          s.holes = s.holes.sort((a, b) => a.holeNumber - b.holeNumber);
        }),
      );

      const totalScore = round.holes.reduce((acc, h) => acc + h.score, 0);
      await RoundStore.update(round.id, { totalScore });

      setTracker({ editingHoleNum: null, step: 'summary' });
      setSearchParams({ mode: undefined, hole: undefined });
    } catch (e) {
      console.error('Failed to save edited hole', e);
    }
  };

  const prevHole = async () => {
    if (round.currentHoleNum <= 1 || !round.id) return;

    const previousHole = round.holes[round.holes.length - 1];
    if (!previousHole) return;

    const clubs = previousHole.clubIds?.length
      ? previousHole.clubIds
          .map((id) => (clubsQuery.data ?? []).find((c) => c.id === id))
          .filter((c): c is LocalClub => c !== undefined)
      : [];

    setHoleInput({
      par: previousHole.par,
      score: previousHole.score,
      putts: previousHole.putts,
      fairwayStatus: previousHole.fairwayStatus || null,
      girStatus: previousHole.girStatus || null,
      proximity: previousHole.proximityToHole || 20,
      fairwayBunker: previousHole.fairwayBunker,
      greensideBunker: previousHole.greensideBunker,
      selectedClubs: clubs,
    });

    const updatedHoles = round.holes.slice(0, -1);
    await HoleStore.saveAll(round.id, updatedHoles as LocalHole[]);

    const newTotal = updatedHoles.reduce((acc, h) => acc + h.score, 0);
    await RoundStore.update(round.id, { totalScore: newTotal });

    setRound(
      produce((s) => {
        s.holes = updatedHoles;
        s.currentHoleNum = s.currentHoleNum - 1;
      }),
    );
  };

  const finishRound = async () => {
    if (!round.id) return;

    const totalScore = round.holes.reduce((acc, h) => acc + h.score, 0);
    const endedAt = new Date().toISOString();

    await RoundStore.update(round.id, { totalScore, endedAt });
    await syncRound(round.id);
  };

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

  // Load round from URL params on mount
  onMount(async () => {
    const idStr = params.id;
    const mode = searchParams.mode;
    const holeStr = searchParams.hole;

    if (!idStr) {
      setTracker({ loading: false, step: 'setup' });
      return;
    }

    const rid = parseInt(idStr);
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

      // Load course definitions
      let holeDefs: StoredHoleDefinition[] = [];
      if (roundData.courseId) {
        try {
          const fullCourse = await CourseStore.fetchById(roundData.courseId);
          holeDefs = fullCourse?.holeDefinitions ?? [];
        } catch (e) {
          console.warn('Could not load course definitions', e);
        }
      }

      // Load existing holes
      const existingHoles = await HoleStore.getForRound(rid);
      existingHoles.sort((a, b) => a.holeNumber - b.holeNumber);

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
        const holeNum = parseInt(holeStr);
        if (!isNaN(holeNum) && holeNum >= 1 && holeNum <= 18) {
          setRound('currentHoleNum', holeNum);
          loadHoleForEditing(holeNum);
          setTracker({ editingHoleNum: holeNum, step: 'edit', loading: false });
        } else {
          setTracker({ step: 'summary', loading: false });
        }
      } else if (mode === 'view' && holeStr) {
        const holeNum = parseInt(holeStr);
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
            clubs={clubsQuery.data ?? []}
          />
        </Show>

        <Show when={tracker.step === 'summary'}>
          <RoundSummary
            courseName={round.courseName}
            holes={round.holes}
            clubs={clubsQuery.data ?? []}
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
                clubs={clubsQuery.data ?? []}
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
