import { type Component, Show } from 'solid-js';
import type { LocalClub } from '~/lib/stores';
import { ClubDisplay } from './club_display';

// Hole type matching round_summary
interface Hole {
  id?: number;
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

interface HoleDetailViewProps {
  hole: Hole;
  holes: Hole[];
  clubs: LocalClub[];
  courseName: string;
  onBack: () => void;
  onNavigate: (holeNumber: number) => void;
  onEdit: () => void;
}

const getScoreDiff = (par: number, score: number): string => {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
};

const getScoreColor = (par: number, score: number): string => {
  const diff = score - par;
  if (diff <= -2) return 'text-amber-400'; // Eagle or better
  if (diff === -1) return 'text-emerald-400'; // Birdie
  if (diff === 0) return 'text-white'; // Par
  if (diff === 1) return 'text-orange-400'; // Bogey
  return 'text-red-400'; // Double+
};

const EmptyState: Component<{ text: string }> = (props) => (
  <div class="text-center py-3 text-slate-500 text-sm italic">{props.text}</div>
);

export const HoleDetailView: Component<HoleDetailViewProps> = (props) => {
  const currentIndex = () =>
    props.holes.findIndex((h) => h.holeNumber === props.hole.holeNumber);
  const hasPrev = () => currentIndex() > 0;
  const hasNext = () => currentIndex() < props.holes.length - 1;
  const prevHoleNum = () =>
    hasPrev() ? props.holes[currentIndex() - 1].holeNumber : null;
  const nextHoleNum = () =>
    hasNext() ? props.holes[currentIndex() + 1].holeNumber : null;

  return (
    <div class="flex-1 flex flex-col bg-golf-dark text-white min-h-screen">
      {/* Header */}
      <div class="bg-slate-900/80 backdrop-blur-md p-4 sticky top-0 z-10 border-b border-white/5">
        <div class="max-w-md mx-auto">
          <div class="flex justify-between items-center mb-2">
            <button
              onClick={props.onBack}
              class="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="text-sm font-medium">Back</span>
            </button>
          </div>
          <div class="flex justify-between items-center">
            <div class="text-center">
              <span class="text-xs text-slate-400 block">
                Par {props.hole.par}
              </span>
              <span
                class={`font-mono font-bold text-lg ${getScoreColor(props.hole.par, props.hole.score)}`}
              >
                {getScoreDiff(props.hole.par, props.hole.score)}
              </span>
            </div>
            <div class="text-center">
              <h2 class="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                Hole {props.hole.holeNumber}
              </h2>
              <span class="text-white font-semibold truncate max-w-[200px] block">
                {props.courseName}
              </span>
            </div>
            <button
              onClick={props.onEdit}
              class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-500/20 transition-colors text-slate-400 hover:text-blue-400"
              aria-label="Edit hole"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-6 pb-24">
        {/* Score Display */}
        <div class="grid grid-cols-2 gap-4">
          <div class="card flex flex-col items-center justify-center py-6">
            <label class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
              Par
            </label>
            <span class="text-4xl font-black text-white">{props.hole.par}</span>
          </div>
          <div class="card flex flex-col items-center justify-center py-6 border-emerald-500/30 bg-gradient-to-br from-slate-800 to-slate-900">
            <label class="text-emerald-500 text-xs font-bold uppercase tracking-wider mb-2">
              Score
            </label>
            <div class="flex items-center gap-3">
              <span
                class={`text-4xl font-black ${getScoreColor(props.hole.par, props.hole.score)}`}
              >
                {props.hole.score}
              </span>
              
            </div>
          </div>
        </div>

        {/* Clubs Used */}
        <ClubDisplay clubs={props.clubs} clubIds={props.hole.clubIds} />

        {/* Off the Tee (only for par 4 and 5) */}
        <Show when={props.hole.par > 3}>
          <div class="card">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Off the Tee
            </h3>
            <Show
              when={props.hole.fairwayStatus}
              fallback={<EmptyState text="Not recorded" />}
            >
              <div class="flex bg-slate-800 rounded-xl p-1 border border-white/5">
                <div
                  class={`flex-1 py-3 rounded-lg font-bold text-sm text-center transition-all ${
                    props.hole.fairwayStatus === 'left'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  Left
                </div>
                <div
                  class={`flex-1 py-3 rounded-lg font-bold text-sm text-center transition-all ${
                    props.hole.fairwayStatus === 'hit'
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  Hit
                </div>
                <div
                  class={`flex-1 py-3 rounded-lg font-bold text-sm text-center transition-all ${
                    props.hole.fairwayStatus === 'right'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  Right
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Approach / GIR */}
        <div class="card">
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Approach
          </h3>
          <Show
            when={props.hole.girStatus}
            fallback={<EmptyState text="Not recorded" />}
          >
            <div class="space-y-4">
              <div class="flex bg-slate-800 rounded-xl p-1 border border-white/5">
                <div
                  class={`flex-1 py-2 rounded-lg font-bold text-xs text-center transition-all ${
                    props.hole.girStatus === 'long'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  Long
                </div>
                <div
                  class={`flex-1 py-2 rounded-lg font-bold text-xs text-center transition-all ${
                    props.hole.girStatus === 'left'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  Left
                </div>
                <div
                  class={`flex-1 py-2 rounded-lg font-bold text-xs text-center transition-all ${
                    props.hole.girStatus === 'hit'
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  GIR
                </div>
                <div
                  class={`flex-1 py-2 rounded-lg font-bold text-xs text-center transition-all ${
                    props.hole.girStatus === 'right'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  Right
                </div>
                <div
                  class={`flex-1 py-2 rounded-lg font-bold text-xs text-center transition-all ${
                    props.hole.girStatus === 'short'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'text-slate-600'
                  }`}
                >
                  Short
                </div>
              </div>

              {/* Proximity */}
              <Show when={props.hole.girStatus === 'hit'}>
                <div class="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 border border-white/5">
                  <span class="text-sm text-slate-400">Proximity to Hole</span>
                  <span class="text-lg font-bold text-white">
                    {props.hole.proximityToHole
                      ? `${props.hole.proximityToHole} ft`
                      : '—'}
                  </span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Recovery */}
        <div class="card">
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Recovery
          </h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 border border-white/5">
              <span class="text-sm text-slate-400">Fairway Bunker</span>
              <span
                class={`text-sm font-bold ${
                  props.hole.fairwayBunker ? 'text-amber-400' : 'text-slate-500'
                }`}
              >
                {props.hole.fairwayBunker ? 'Yes' : 'No'}
              </span>
            </div>
            <div class="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 border border-white/5">
              <span class="text-sm text-slate-400">Greenside</span>
              <span
                class={`text-sm font-bold ${
                  props.hole.greensideBunker
                    ? 'text-amber-400'
                    : 'text-slate-500'
                }`}
              >
                {props.hole.greensideBunker ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Putting */}
        <div class="card">
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Putting
          </h3>
          <Show
            when={props.hole.putts !== undefined && props.hole.putts !== null}
            fallback={<EmptyState text="Not recorded" />}
          >
            <div class="flex items-center justify-center bg-slate-800 rounded-xl py-6 border border-white/5">
              <div class="text-center">
                <span class="text-4xl font-black text-white">
                  {props.hole.putts}
                </span>
                <span class="text-sm text-slate-400 ml-2">putts</span>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Footer Navigation */}
      <div class="p-4 bg-gradient-to-t from-golf-dark to-transparent sticky bottom-0 z-20 flex gap-3">
        <button
          onClick={() => prevHoleNum() && props.onNavigate(prevHoleNum()!)}
          disabled={!hasPrev()}
          class={`flex-1 p-4 rounded-xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
            hasPrev()
              ? 'bg-slate-800 hover:bg-slate-700 text-white active:scale-[0.98]'
              : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clip-rule="evenodd"
            />
          </svg>
          <span>Hole {prevHoleNum() ?? '—'}</span>
        </button>
        <button
          onClick={() => nextHoleNum() && props.onNavigate(nextHoleNum()!)}
          disabled={!hasNext()}
          class={`flex-1 p-4 rounded-xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
            hasNext()
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-900/40 active:scale-[0.98]'
              : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
          }`}
        >
          <span>Hole {nextHoleNum() ?? '—'}</span>
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
  );
};
