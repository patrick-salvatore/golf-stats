import { createSignal, For, Show, createEffect } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { db, type Hole } from "../db";

export default function RoundTracker() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = createSignal<'setup' | 'playing' | 'summary'>('setup');
  const [courseName, setCourseName] = createSignal("");
  const [currentHoleNum, setCurrentHoleNum] = createSignal(1);
  const [holes, setHoles] = createSignal<Hole[]>([]);
  const [roundId, setRoundId] = createSignal<number | null>(null);
  const [isCompleted, setIsCompleted] = createSignal(false);

  // Current Hole State
  const [par, setPar] = createSignal(4);
  const [score, setScore] = createSignal(4);
  const [fairwayHit, setFairwayHit] = createSignal(false);
  const [gir, setGir] = createSignal(false);
  const [putts, setPutts] = createSignal(2);

  // Restore state from URL if present
  createEffect(async () => {
    const idParam = searchParams.id;
    const idStr = Array.isArray(idParam) ? idParam[0] : idParam;
    
    if (idStr) {
      const rid = parseInt(idStr);
      if (!isNaN(rid)) {
        try {
          const round = await db.rounds.get(rid);
          if (round) {
            setRoundId(rid);
            setCourseName(round.courseName);
            
            const existingHoles = await db.holes.where('roundId').equals(rid).sortBy('holeNumber');
            setHoles(existingHoles);

            if (round.completed === 1) {
              setIsCompleted(true);
              setStep('summary');
            } else if (existingHoles.length >= 18) {
              setStep('summary');
            } else {
              setStep('playing');
              setCurrentHoleNum(existingHoles.length + 1);
            }
          }
        } catch (e) {
          console.error("Failed to load round", e);
        }
      }
    }
  });

  const startRound = async () => {
    if (!courseName()) return;
    
    try {
      const date = new Date().toISOString().split('T')[0];
      const id = await db.rounds.add({
        courseName: courseName(),
        date,
        totalScore: 0,
        synced: 0,
        completed: 0
      });
      
      // Update URL to include ID, which triggers the effect to set state
      setSearchParams({ id });
    } catch (e) {
      console.error("Failed to start round", e);
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
      fairwayHit: fairwayHit(),
      gir: gir(),
      putts: putts()
    };

    try {
      await db.holes.add(holeData);
      const newHoles = [...holes(), holeData];
      setHoles(newHoles);
      
      // Update running total
      const totalScore = newHoles.reduce((acc, h) => acc + h.score, 0);
      await db.rounds.update(rid, { totalScore });

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
    } catch (e) {
      console.error("Failed to save hole", e);
    }
  };

  const finishRound = async () => {
    const rid = roundId();
    if (rid) {
      // Calculate final score just to be safe
      const totalScore = holes().reduce((acc, h) => acc + h.score, 0);
      await db.rounds.update(rid, { 
        completed: 1,
        totalScore 
      });
    }
    navigate('/');
  };

  // Helper for score color
  const getScoreColor = (par: number, score: number) => {
      const diff = score - par;
      if (diff <= -2) return 'text-amber-400'; // Eagle
      if (diff === -1) return 'text-emerald-400'; // Birdie
      if (diff === 0) return 'text-white'; // Par
      if (diff === 1) return 'text-orange-400'; // Bogey
      return 'text-red-400'; // Double+
  };

  return (
    <div class="min-h-screen flex flex-col bg-golf-dark">
      <Show when={step() === 'setup'}>
        <div class="flex-1 flex flex-col justify-center p-6 max-w-md mx-auto w-full">
          <div class="mb-10 text-center">
             <div class="inline-block p-4 rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <h1 class="text-3xl font-bold text-white mb-2">Where are we playing?</h1>
             <p class="text-slate-400">Enter the course name to get started.</p>
          </div>
          
          <input
            type="text"
            placeholder="e.g. Augusta National"
            class="input-field text-xl text-center mb-8"
            value={courseName()}
            onInput={(e) => setCourseName(e.currentTarget.value)}
            autofocus
          />
          
          <button 
            onClick={startRound}
            disabled={!courseName()}
            class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-5 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
          >
            Tee Off
          </button>
        </div>
      </Show>

      <Show when={step() === 'playing'}>
        <div class="flex-1 flex flex-col pb-8">
            {/* Header */}
            <div class="bg-slate-900/80 backdrop-blur-md p-4 sticky top-0 z-10 border-b border-white/5">
                <div class="max-w-md mx-auto flex justify-between items-center">
                     <div>
                        <h2 class="text-xs font-bold text-emerald-500 uppercase tracking-widest">Hole {currentHoleNum()}</h2>
                        <span class="text-white font-semibold truncate max-w-[200px] block">{courseName()}</span>
                     </div>
                     <div class="text-right">
                         <span class="text-xs text-slate-400 block">Total</span>
                         <span class="font-mono font-bold text-white text-lg">{holes().reduce((acc, h) => acc + h.score, 0) + (score() - par())}</span>
                     </div>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-6">
                
                {/* Score Controls */}
                <div class="grid grid-cols-2 gap-4">
                    {/* Par */}
                    <div class="card flex flex-col items-center justify-center py-6">
                        <label class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Par</label>
                        <div class="flex items-center space-x-4">
                            <button onClick={() => setPar(p => Math.max(3, p - 1))} class="w-10 h-10 rounded-full bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors">-</button>
                            <span class="text-4xl font-black text-white w-8 text-center">{par()}</span>
                            <button onClick={() => setPar(p => Math.min(6, p + 1))} class="w-10 h-10 rounded-full bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors">+</button>
                        </div>
                    </div>

                    {/* Score */}
                    <div class="card flex flex-col items-center justify-center py-6 border-emerald-500/30 bg-gradient-to-br from-slate-800 to-slate-900">
                        <label class="text-emerald-500 text-xs font-bold uppercase tracking-wider mb-4">Strokes</label>
                        <div class="flex items-center space-x-4">
                            <button onClick={() => setScore(s => Math.max(1, s - 1))} class="w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center font-bold text-xl active:scale-95 transition-all">-</button>
                            <span class={`text-5xl font-black w-12 text-center ${getScoreColor(par(), score())}`}>{score()}</span>
                            <button onClick={() => setScore(s => s + 1)} class="w-10 h-10 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 flex items-center justify-center font-bold text-xl active:scale-95 shadow-lg shadow-emerald-900/50 transition-all">+</button>
                        </div>
                    </div>
                </div>

                {/* Secondary Stats */}
                <div class="card space-y-4">
                    <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Fairway & Green</h3>
                    
                    <button 
                        onClick={() => setFairwayHit(!fairwayHit())}
                        class={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${fairwayHit() ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-800 border border-transparent hover:bg-slate-700'}`}
                    >
                        <span class={`font-bold ${fairwayHit() ? 'text-emerald-400' : 'text-slate-300'}`}>Fairway Hit</span>
                        <div class={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${fairwayHit() ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                            <Show when={fairwayHit()}>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            </Show>
                        </div>
                    </button>

                    <button 
                        onClick={() => setGir(!gir())}
                        class={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${gir() ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-800 border border-transparent hover:bg-slate-700'}`}
                    >
                        <span class={`font-bold ${gir() ? 'text-emerald-400' : 'text-slate-300'}`}>Green in Regulation</span>
                        <div class={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${gir() ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                            <Show when={gir()}>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            </Show>
                        </div>
                    </button>
                </div>
                
                {/* Putts */}
                <div class="card flex flex-col items-center">
                    <label class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Putts</label>
                    <div class="flex items-center space-x-6">
                        <button onClick={() => setPutts(p => Math.max(0, p - 1))} class="w-12 h-12 rounded-xl bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors border border-white/5">-</button>
                        <span class="text-3xl font-bold text-white w-8 text-center">{putts()}</span>
                        <button onClick={() => setPutts(p => p + 1)} class="w-12 h-12 rounded-xl bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors border border-white/5">+</button>
                    </div>
                </div>

            </div>

            <div class="p-4 bg-gradient-to-t from-golf-dark to-transparent sticky bottom-0">
                <button 
                    onClick={saveHole}
                    class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <span>Next Hole</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
      </Show>

      <Show when={step() === 'summary'}>
        <div class="flex-1 p-6 max-w-md mx-auto w-full flex flex-col">
            <h1 class="text-2xl font-bold text-white text-center mb-8">{isCompleted() ? 'Round Summary' : 'Round Complete'}</h1>
            
            <div class="card mb-8 text-center relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent"></div>
                <div class="relative z-10">
                    <h2 class="text-lg font-medium text-slate-300 mb-1">{courseName()}</h2>
                    <div class="text-7xl font-black text-emerald-400 my-4 tracking-tighter">
                        {holes().reduce((acc, h) => acc + h.score, 0)}
                    </div>
                    <div class="inline-block bg-slate-800 rounded-full px-4 py-1">
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Score</span>
                    </div>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto mb-6 pr-2">
                <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Scorecard</h3>
                <div class="space-y-2">
                    <For each={holes()}>
                        {(h) => {
                             const diff = h.score - h.par;
                             let scoreClass = "text-white";
                             if(diff < 0) scoreClass = "text-emerald-400 font-bold";
                             if(diff > 0) scoreClass = "text-slate-300";

                             return (
                                <div class="flex justify-between items-center p-3 rounded-lg bg-slate-800/50 border border-white/5">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                                            {h.holeNumber}
                                        </div>
                                        <div class="text-xs text-slate-500">Par {h.par}</div>
                                    </div>
                                    <span class={`text-lg ${scoreClass}`}>{h.score}</span>
                                </div>
                             )
                        }}
                    </For>
                </div>
            </div>

            <button 
                onClick={finishRound}
                class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
            >
                {isCompleted() ? 'Back to Dashboard' : 'Finish & Save'}
            </button>
        </div>
      </Show>
    </div>
  );
}
