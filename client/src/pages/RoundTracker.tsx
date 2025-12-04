import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { db, type Hole } from "../db";

export default function RoundTracker() {
  const navigate = useNavigate();
  const [step, setStep] = createSignal<'setup' | 'playing' | 'summary'>('setup');
  const [courseName, setCourseName] = createSignal("");
  const [currentHoleNum, setCurrentHoleNum] = createSignal(1);
  const [holes, setHoles] = createSignal<Hole[]>([]);

  // Current Hole State
  const [par, setPar] = createSignal(4);
  const [score, setScore] = createSignal(4);
  const [fairwayHit, setFairwayHit] = createSignal(false);
  const [gir, setGir] = createSignal(false);
  const [putts, setPutts] = createSignal(2);

  const startRound = () => {
    if (!courseName()) return;
    setStep('playing');
  };

  const saveHole = () => {
    const holeData: Hole = {
      roundId: 0, // Placeholder, updated on save
      holeNumber: currentHoleNum(),
      par: par(),
      score: score(),
      fairwayHit: fairwayHit(),
      gir: gir(),
      putts: putts()
    };

    setHoles([...holes(), holeData]);

    if (currentHoleNum() === 18) {
      setStep('summary');
    } else {
      setCurrentHoleNum(currentHoleNum() + 1);
      // Reset defaults for next hole
      setPar(4);
      setScore(4);
      setFairwayHit(false);
      setGir(false);
      setPutts(2);
    }
  };

  const finishRound = async () => {
    const totalScore = holes().reduce((acc, h) => acc + h.score, 0);
    const date = new Date().toISOString().split('T')[0];

    const roundId = await db.rounds.add({
      courseName: courseName(),
      date,
      totalScore,
      synced: 0
    });

    const holesWithRoundId = holes().map(h => ({ ...h, roundId: roundId as number }));
    await db.holes.bulkAdd(holesWithRoundId);

    navigate('/');
  };

  return (
    <div class="p-4 max-w-md mx-auto min-h-screen flex flex-col">
      <Show when={step() === 'setup'}>
        <div class="flex-1 flex flex-col justify-center">
          <h1 class="text-3xl font-bold mb-6 text-center">New Round</h1>
          <input
            type="text"
            placeholder="Course Name"
            class="w-full p-4 rounded bg-gray-800 border border-gray-700 mb-4 text-white text-lg"
            value={courseName()}
            onInput={(e) => setCourseName(e.currentTarget.value)}
          />
          <button 
            onClick={startRound}
            disabled={!courseName()}
            class="w-full bg-emerald-600 text-white p-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Round
          </button>
        </div>
      </Show>

      <Show when={step() === 'playing'}>
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold">Hole {currentHoleNum()}</h2>
            <span class="text-gray-400">{courseName()}</span>
        </div>

        <div class="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
            
            {/* Par and Score */}
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-gray-400 mb-2 text-sm">Par</label>
                    <div class="flex items-center space-x-2">
                        <button onClick={() => setPar(p => Math.max(3, p - 1))} class="bg-gray-700 w-10 h-10 rounded">-</button>
                        <span class="text-2xl font-bold w-8 text-center">{par()}</span>
                        <button onClick={() => setPar(p => Math.min(6, p + 1))} class="bg-gray-700 w-10 h-10 rounded">+</button>
                    </div>
                </div>
                <div>
                    <label class="block text-gray-400 mb-2 text-sm">Score</label>
                    <div class="flex items-center space-x-2">
                        <button onClick={() => setScore(s => Math.max(1, s - 1))} class="bg-gray-700 w-10 h-10 rounded">-</button>
                        <span class="text-2xl font-bold w-8 text-center">{score()}</span>
                        <button onClick={() => setScore(s => s + 1)} class="bg-gray-700 w-10 h-10 rounded">+</button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div class="space-y-4 pt-4 border-t border-gray-700">
                <div class="flex justify-between items-center">
                    <label>Fairway Hit?</label>
                    <input 
                        type="checkbox" 
                        checked={fairwayHit()} 
                        onChange={(e) => setFairwayHit(e.currentTarget.checked)}
                        class="w-6 h-6 accent-emerald-500"
                    />
                </div>
                <div class="flex justify-between items-center">
                    <label>Green in Reg (GIR)?</label>
                    <input 
                        type="checkbox" 
                        checked={gir()} 
                        onChange={(e) => setGir(e.currentTarget.checked)}
                        class="w-6 h-6 accent-emerald-500"
                    />
                </div>
                 <div class="flex justify-between items-center">
                    <label>Putts</label>
                     <div class="flex items-center space-x-2">
                        <button onClick={() => setPutts(p => Math.max(0, p - 1))} class="bg-gray-700 w-8 h-8 rounded">-</button>
                        <span class="text-xl font-bold w-6 text-center">{putts()}</span>
                        <button onClick={() => setPutts(p => p + 1)} class="bg-gray-700 w-8 h-8 rounded">+</button>
                    </div>
                </div>
            </div>

            <button 
                onClick={saveHole}
                class="w-full bg-emerald-600 text-white p-4 rounded-lg font-bold text-lg mt-6"
            >
                Next Hole
            </button>
        </div>
      </Show>

      <Show when={step() === 'summary'}>
        <div class="flex-1">
            <h1 class="text-3xl font-bold mb-4 text-center">Round Summary</h1>
            <div class="bg-gray-800 p-6 rounded-lg text-center mb-6">
                <div class="text-gray-400">{courseName()}</div>
                <div class="text-6xl font-bold text-emerald-500 my-4">
                    {holes().reduce((acc, h) => acc + h.score, 0)}
                </div>
                <div class="text-sm text-gray-400">Total Score</div>
            </div>

            <div class="space-y-2 mb-6 max-h-60 overflow-y-auto">
                <For each={holes()}>
                    {(h) => (
                        <div class="flex justify-between px-4 py-2 bg-gray-800/50 rounded">
                            <span>Hole {h.holeNumber}</span>
                            <span class="font-bold">{h.score}</span>
                        </div>
                    )}
                </For>
            </div>

            <button 
                onClick={finishRound}
                class="w-full bg-emerald-600 text-white p-4 rounded-lg font-bold text-lg"
            >
                Save Round
            </button>
        </div>
      </Show>
    </div>
  );
}
