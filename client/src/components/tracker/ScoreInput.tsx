import type { Component, Accessor, Setter } from "solid-js";

interface ScoreInputProps {
  par: Accessor<number>;
  setPar: Setter<number>;
  score: Accessor<number>;
  setScore: Setter<number>;
}

const getScoreColor = (par: number, score: number) => {
  const diff = score - par;
  if (diff <= -2) return "text-amber-400"; // Eagle
  if (diff === -1) return "text-emerald-400"; // Birdie
  if (diff === 0) return "text-white"; // Par
  if (diff === 1) return "text-orange-400"; // Bogey
  return "text-red-400"; // Double+
};

export const ScoreInput: Component<ScoreInputProps> = (props) => {
  return (
    <div class="grid grid-cols-2 gap-4">
      {/* Par */}
      <div class="card flex flex-col items-center justify-center py-6">
        <label class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
          Par
        </label>
        <div class="flex items-center space-x-4">
          <button
            onClick={() => props.setPar((p) => Math.max(3, p - 1))}
            class="w-10 h-10 rounded-full bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors"
          >
            -
          </button>
          <span class="text-4xl font-black text-white w-8 text-center">
            {props.par()}
          </span>
          <button
            onClick={() => props.setPar((p) => Math.min(6, p + 1))}
            class="w-10 h-10 rounded-full bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xl active:bg-slate-600 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Score */}
      <div class="card flex flex-col items-center justify-center py-6 border-emerald-500/30 bg-gradient-to-br from-slate-800 to-slate-900">
        <label class="text-emerald-500 text-xs font-bold uppercase tracking-wider mb-4">
          Strokes
        </label>
        <div class="flex items-center space-x-4">
          <button
            onClick={() => props.setScore((s) => Math.max(1, s - 1))}
            class="w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center font-bold text-xl active:scale-95 transition-all"
          >
            -
          </button>
          <span
            class={`text-5xl font-black w-12 text-center ${getScoreColor(
              props.par(),
              props.score()
            )}`}
          >
            {props.score()}
          </span>
          <button
            onClick={() => props.setScore((s) => s + 1)}
            class="w-10 h-10 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 flex items-center justify-center font-bold text-xl active:scale-95 shadow-lg shadow-emerald-900/50 transition-all"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};
