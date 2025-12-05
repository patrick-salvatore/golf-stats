import {
  createSignal,
  Show,
  createRenderEffect,
} from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { db, type Hole, type Club } from "../db";
import { useRounds } from "../context/RoundContext";
import { ClubSelector } from "../components/ClubSelector";
import { RoundSetup } from "../components/tracker/RoundSetup";
import { RoundSummary } from "../components/tracker/RoundSummary";
import { ScoreInput } from "../components/tracker/ScoreInput";
import { FairwayInput } from "../components/tracker/FairwayInput";
import { ApproachInput } from "../components/tracker/ApproachInput";
import { RecoveryInput } from "../components/tracker/RecoveryInput";
import { PuttInput } from "../components/tracker/PuttInput";

export default function RoundTracker() {
  const navigate = useNavigate();
  const { syncRound } = useRounds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = createSignal<"setup" | "playing" | "summary">(
    "setup"
  );
  const [courseName, setCourseName] = createSignal("");
  const [currentHoleNum, setCurrentHoleNum] = createSignal(1);
  const [holes, setHoles] = createSignal<Hole[]>([]);
  const [roundId, setRoundId] = createSignal<number | null>(null);
  const [isSynced, setIsSynced] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [availableClubs, setAvailableClubs] = createSignal<Club[]>([]);

  // Current Hole State
  const [par, setPar] = createSignal(4);
  const [score, setScore] = createSignal(4);
  const [putts, setPutts] = createSignal(2);
  const [selectedClubs, setSelectedClubs] = createSignal<Club[]>([]);

  // New Detailed Stats
  const [fairwayStatus, setFairwayStatus] = createSignal<
    "hit" | "left" | "right" | null
  >(null);
  const [girStatus, setGirStatus] = createSignal<
    "hit" | "long" | "short" | "left" | "right" | null
  >(null);
  const [proximity, setProximity] = createSignal(20); // Default 20ft
  const [fairwayBunker, setFairwayBunker] = createSignal(false);
  const [greensideBunker, setGreensideBunker] = createSignal(false);

  const resetHoleStats = () => {
    setPar(4);
    setScore(4);
    setPutts(2);
    setFairwayStatus("hit");
    setGirStatus("hit");
    setProximity(20);
    setFairwayBunker(false);
    setGreensideBunker(false);
    setSelectedClubs([]);
    setLoading(false);
  };

  // Load clubs on init
  createRenderEffect(async () => {
    try {
        const clubs = await db.clubs.toArray();
        setAvailableClubs(clubs);
    } catch (e) {
        console.error("Failed to load clubs", e);
    }
  });

  // Restore state from URL if present
  createRenderEffect(async () => {
    const idParam = searchParams.id;
    const idStr = Array.isArray(idParam) ? idParam[0] : idParam;

    if (idStr) {
      const rid = parseInt(idStr);
      if (!isNaN(rid)) {
        try {
          setLoading(true);
          const round = await db.rounds.get(rid);
          if (round) {
            setRoundId(rid);
            setCourseName(round.courseName);

            const existingHoles = await db.holes
              .where("roundId")
              .equals(rid)
              .sortBy("holeNumber");
            setHoles(existingHoles);

            if (round.synced === 1) {
              setIsSynced(true);
              setStep("summary");
            } else if (existingHoles.length >= 18) {
              setStep("summary");
            } else {
              setStep("playing");
              setCurrentHoleNum(existingHoles.length + 1);
              resetHoleStats();
            }
          }
        } catch (e) {
          console.error("Failed to load round", e);
        } finally {
          setLoading(false);
        }
      }
    }
  });

  const startRound = async () => {
    if (!courseName()) return;

    try {
      const now = new Date().toISOString();
      const date = now.split("T")[0];
      const id = await db.rounds.add({
        courseName: courseName(),
        date,
        totalScore: 0,
        synced: 0,
        createdAt: now,
      });

      setSearchParams({ id });
      resetHoleStats();
    } catch (e) {
      console.error("Failed to start round", e);
    }
  };

  const addClubToHole = (club: Club) => {
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

    const holeData: Hole = {
      roundId: rid,
      holeNumber: currentHoleNum(),
      par: par(),
      score: score(),
      putts: putts(),
      fairwayStatus: fairwayStatus() || undefined,
      girStatus: girStatus() || undefined,
      fairwayBunker: fairwayBunker(),
      greensideBunker: greensideBunker(),
      proximityToHole: girStatus() === "hit" ? proximity() : undefined,
      clubIds: selectedClubs().map(c => c.id)
    };

    try {
      const id = await db.holes.add(holeData);
      const newHoles = [...holes(), { ...holeData, id: id as number }];
      setHoles(newHoles);

      // Update running total
      const totalScore = newHoles.reduce((acc, h) => acc + h.score, 0);
      await db.rounds.update(rid, { totalScore });

      if (currentHoleNum() === 18) {
        setStep("summary");
      } else {
        setCurrentHoleNum(currentHoleNum() + 1);
        resetHoleStats();
      }
    } catch (e) {
      console.error("Failed to save hole", e);
    }
  };

  const prevHole = async () => {
    if (currentHoleNum() <= 1) return;

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
        const ordered = previousHole.clubIds.map(id => availableClubs().find(c => c.id === id)).filter(Boolean) as Club[];
        setSelectedClubs(ordered);
      } else {
        setSelectedClubs([]);
      }

      if (previousHole.id) {
        await db.holes.delete(previousHole.id);
      }

      const rid = roundId();
      if (rid) {
        const newTotal =
          holes().reduce((acc, h) => acc + h.score, 0) - previousHole.score;
        await db.rounds.update(rid, { totalScore: newTotal });
      }

      setHoles(holes().slice(0, -1));
      setCurrentHoleNum(currentHoleNum() - 1);
    }
  };

  const finishRound = async () => {
    const rid = roundId();
    if (rid) {
      const totalScore = holes().reduce((acc, h) => acc + h.score, 0);
      const endedAt = new Date().toISOString();
      await db.rounds.update(rid, {
        totalScore,
        endedAt,
      });
      await syncRound(rid);
    }
  };

  return (
    <div class="min-h-screen flex flex-col bg-golf-dark text-white">
      {loading() ? null : (
        <>
          <Show when={step() === "setup"}>
            <RoundSetup 
                courseName={courseName}
                setCourseName={setCourseName}
                onStart={startRound}
            />
          </Show>

          <Show when={step() === "playing"}>
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

              <div class="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-6">
                
                {/* Club Selector */}
                <div class="card p-0 overflow-hidden bg-transparent border-none shadow-none">
                    <div class="flex justify-between items-baseline mb-2 px-1">
                        <label class="text-slate-400 text-xs font-bold uppercase tracking-wider">
                          Club Sequence
                        </label>
                        <span class="text-[10px] text-slate-500 font-mono">
                            {selectedClubs().map(c => c.name).join(' → ')}
                        </span>
                    </div>
                    <ClubSelector 
                        clubs={availableClubs()} 
                        selectedClubs={selectedClubs()}
                        onClubSelect={addClubToHole} 
                    />
                </div>

                <ScoreInput 
                    par={par} setPar={setPar}
                    score={score} setScore={setScore}
                />

                <Show when={par() > 3}>
                    <FairwayInput 
                        status={fairwayStatus}
                        setStatus={setFairwayStatus}
                    />
                </Show>

                <ApproachInput 
                    girStatus={girStatus} setGirStatus={setGirStatus}
                    proximity={proximity} setProximity={setProximity}
                />

                <RecoveryInput 
                    fairwayBunker={fairwayBunker} setFairwayBunker={setFairwayBunker}
                    greensideBunker={greensideBunker} setGreensideBunker={setGreensideBunker}
                />

                <PuttInput 
                    putts={putts} setPutts={setPutts}
                />
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

          <Show when={step() === "summary"}>
            <RoundSummary 
                courseName={courseName()}
                holes={holes()}
                isSynced={isSynced()}
                onAction={() => isSynced() ? navigate("/") : finishRound()}
            />
          </Show>
        </>
      )}
    </div>
  );
}
