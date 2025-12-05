import { type Component, For, Show } from "solid-js";
import { type Hole } from "../../db";

interface RoundSummaryProps {
  courseName: string;
  holes: Hole[];
  isSynced: boolean;
  onAction: () => void;
}

export const RoundSummary: Component<RoundSummaryProps> = (props) => {
  return (
    <div class="flex-1 p-6 max-w-md mx-auto w-full flex flex-col">
      <h1 class="text-2xl font-bold text-white text-center mb-8">
        {props.isSynced ? "Round Summary" : "Round Complete"}
      </h1>

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
                <div class="flex justify-between items-center p-3 rounded-lg bg-slate-800/50 border border-white/5 block">
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
