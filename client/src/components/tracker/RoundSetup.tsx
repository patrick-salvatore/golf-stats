import type { Component, Accessor, Setter } from "solid-js";

interface RoundSetupProps {
  courseName: Accessor<string>;
  setCourseName: Setter<string>;
  onStart: () => void;
}

export const RoundSetup: Component<RoundSetupProps> = (props) => {
  return (
    <div class="flex-1 flex flex-col justify-center p-6 max-w-md mx-auto w-full">
      <div class="mb-10 text-center">
        <div class="inline-block p-4 rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-white mb-2">
          Where are we playing?
        </h1>
        <p class="text-slate-400">
          Enter the course name to get started.
        </p>
      </div>

      <input
        type="text"
        placeholder="e.g. Augusta National"
        class="input-field text-xl text-center mb-8"
        value={props.courseName()}
        onInput={(e) => props.setCourseName(e.currentTarget.value)}
        autofocus
      />

      <button
        onClick={props.onStart}
        disabled={!props.courseName()}
        class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-5 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
      >
        Tee Off
      </button>
    </div>
  );
};
