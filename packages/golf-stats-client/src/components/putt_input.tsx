import type { Component, Accessor, Setter } from "solid-js";

interface PuttInputProps {
  putts: Accessor<number>;
  setPutts: Setter<number>;
}

export const PuttInput: Component<PuttInputProps> = (props) => {
  return (
    <div class="card flex flex-col items-center">
      <label class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
        Putts
      </label>
      <div class="flex items-center space-x-6">
        <button
          onClick={() => props.setPutts((p) => Math.max(0, p - 1))}
          class="w-12 h-12 rounded-xl bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors border border-white/5"
        >
          -
        </button>
        <span class="text-3xl font-bold text-white w-8 text-center">
          {props.putts()}
        </span>
        <button
          onClick={() => props.setPutts((p) => p + 1)}
          class="w-12 h-12 rounded-xl bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors border border-white/5"
        >
          +
        </button>
      </div>
    </div>
  );
};
