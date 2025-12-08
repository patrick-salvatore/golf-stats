import type { Component, Accessor, Setter } from "solid-js";

interface FairwayInputProps {
  status: Accessor<"hit" | "left" | "right" | null>;
  setStatus: Setter<"hit" | "left" | "right" | null>;
}

export const FairwayInput: Component<FairwayInputProps> = (props) => {
  return (
    <div class="card">
      <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
        Fairway
      </h3>
      <div class="flex bg-slate-800 rounded-xl p-1 border border-white/5">
        <button
          onClick={() => props.setStatus("left")}
          class={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
            props.status() === "left"
              ? "bg-amber-500 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Left
        </button>
        <button
          onClick={() => props.setStatus("hit")}
          class={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
            props.status() === "hit"
              ? "bg-emerald-500 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Hit
        </button>
        <button
          onClick={() => props.setStatus("right")}
          class={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
            props.status() === "right"
              ? "bg-amber-500 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Right
        </button>
      </div>
    </div>
  );
};
