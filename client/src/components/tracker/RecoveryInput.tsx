import type { Component, Accessor, Setter } from "solid-js";

interface RecoveryInputProps {
  fairwayBunker: Accessor<boolean>;
  setFairwayBunker: Setter<boolean>;
  greensideBunker: Accessor<boolean>;
  setGreensideBunker: Setter<boolean>;
}

export const RecoveryInput: Component<RecoveryInputProps> = (props) => {
  return (
    <div class="card">
      <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
        Hazards / Recovery
      </h3>
      <div class="flex gap-3">
        <button
          onClick={() => props.setFairwayBunker(!props.fairwayBunker())}
          class={`flex-1 py-3 px-2 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
            props.fairwayBunker()
              ? "bg-amber-500/20 border-amber-500 text-amber-400"
              : "bg-slate-800 border-transparent text-slate-400 hover:bg-slate-750"
          }`}
        >
          <span class="text-xs font-bold">Fairway Bunker</span>
          <div
            class={`w-3 h-3 rounded-full ${
              props.fairwayBunker() ? "bg-amber-500" : "bg-slate-600"
            }`}
          ></div>
        </button>
        <button
          onClick={() => props.setGreensideBunker(!props.greensideBunker())}
          class={`flex-1 py-3 px-2 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
            props.greensideBunker()
              ? "bg-amber-500/20 border-amber-500 text-amber-400"
              : "bg-slate-800 border-transparent text-slate-400 hover:bg-slate-750"
          }`}
        >
          <span class="text-xs font-bold">Greenside Bunker</span>
          <div
            class={`w-3 h-3 rounded-full ${
              props.greensideBunker() ? "bg-amber-500" : "bg-slate-600"
            }`}
          ></div>
        </button>
      </div>
    </div>
  );
};
