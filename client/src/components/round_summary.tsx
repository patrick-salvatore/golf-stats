import { type Component, For, Show } from "solid-js";
import type { LocalClub } from "~/lib/stores";

// Hole type for summary display
interface Hole {
  id?: number;
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayStatus?: "hit" | "left" | "right";
  girStatus?: "hit" | "long" | "short" | "left" | "right";
  fairwayBunker: boolean;
  greensideBunker: boolean;
  proximityToHole?: number;
  clubIds?: number[];
}

interface RoundSummaryProps {
  courseName: string;
  holes: Hole[];
  clubs?: LocalClub[];
  isSynced: boolean;
  onAction: () => void;
  onHoleClick?: (holeNumber: number) => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export const RoundSummary: Component<RoundSummaryProps> = (props) => {
  return (
    <div class="flex-1 p-6 max-w-md mx-auto w-full flex flex-col">
      <div class="flex items-center justify-between mb-8">
        <div class="w-20" /> {/* Spacer for centering */}
        <h1 class="text-2xl font-bold text-white text-center">
          {props.isSynced ? "Round Summary" : "Round Complete"}
        </h1>
        <div class="flex items-center gap-1 w-20 justify-end">
          <Show when={props.onEdit}>
            <button
              onClick={() => props.onEdit?.()}
              class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-500/20 transition-colors text-slate-400 hover:text-blue-400"
              aria-label="Edit round"
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
          </Show>
          <Show when={props.onDelete}>
            <button
              onClick={() => {
                if (confirm("Delete this round? This cannot be undone.")) {
                  props.onDelete?.();
                }
              }}
              class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-400"
              aria-label="Delete round"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </Show>
        </div>
      </div>

      <div class="card mb-8 text-center relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent"></div>
        <div class="relative z-10">
          <h2 class="text-lg font-medium text-slate-300 mb-1">
            {props.courseName}
          </h2>
          <div class="text-7xl font-black text-emerald-400 my-4 tracking-tighter">
            {props.holes.reduce((acc, h) => acc + h.score, 0)}
          </div>
          <div class="inline-block bg-slate-800 rounded-full px-4 py-1">
            <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Total Score
            </span>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto mb-6 pr-2">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          Scorecard
        </h3>
        <div class="space-y-2">
          <For each={props.holes}>
            {(h) => {
              const diff = h.score - h.par;
              let scoreClass = "text-white";
              if (diff < 0) scoreClass = "text-emerald-400 font-bold";
              if (diff > 0) scoreClass = "text-slate-300";

              return (
                <div 
                  class="flex justify-between items-center p-3 rounded-lg bg-slate-800/50 border border-white/5 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => props.onHoleClick?.(h.holeNumber)}
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                      {h.holeNumber}
                    </div>
                    <div class="text-xs text-slate-500">
                      Par {h.par}
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <Show when={h.girStatus}>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase">
                        {h.girStatus === "hit" ? "GIR" : h.girStatus}
                      </span>
                    </Show>
                    <span class={`text-lg ${scoreClass}`}>
                      {h.score}
                    </span>
                    {/* Chevron indicator */}
                    <svg 
                      class="w-4 h-4 text-slate-500" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        stroke-linecap="round" 
                        stroke-linejoin="round" 
                        stroke-width="2" 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <button
        onClick={props.onAction}
        class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
      >
        {props.isSynced ? "Back to Dashboard" : "Sync to Cloud"}
      </button>
    </div>
  );
};
