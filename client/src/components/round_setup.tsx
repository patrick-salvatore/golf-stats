import { createSignal, For, Show } from "solid-js";
import type { Component, Accessor, Setter } from "solid-js";
import { CourseStore, type LocalCourse } from "~/lib/stores";

// Use LocalCourse for the Course type
type Course = LocalCourse;

interface RoundSetupProps {
  courseName: Accessor<string>;
  setCourseName: Setter<string>;
  onStart: (course?: Course) => void;
}

export const RoundSetup: Component<RoundSetupProps> = (props) => {
  const [results, setResults] = createSignal<Course[]>([]);
  const [showResults, setShowResults] = createSignal(false);

  let searchTimeout: any;

  const handleSearch = (e: InputEvent) => {
    const val = (e.currentTarget as HTMLInputElement).value;
    props.setCourseName(val);
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (val.length > 2) {
      searchTimeout = setTimeout(async () => {
        try {
          const res = await CourseStore.search(val);
          setResults(res);
          setShowResults(true);
        } catch (err) {
          console.error(err);
        }
      }, 500);
    } else {
      setShowResults(false);
    }
  };

  const selectCourse = (course: Course) => {
    props.setCourseName(course.name);
    setShowResults(false);
    props.onStart(course);
  };

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
          Search for a course or enter a name manually.
        </p>
      </div>

      <div class="relative mb-8">
        <input
            type="text"
            placeholder="e.g. Augusta National"
            class="input-field text-xl text-center w-full"
            value={props.courseName()}
            onInput={handleSearch}
            autofocus
        />
        
        <Show when={showResults() && results().length > 0}>
            <div class="absolute w-full mt-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-h-60 overflow-y-auto z-50">
                <For each={results()}>
                    {(course) => (
                        <button 
                            class="w-full text-left p-4 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 transition-colors"
                            onClick={() => selectCourse(course)}
                        >
                            <div class="font-bold text-white">{course.name}</div>
                            <div class="text-xs text-slate-400">{course.city}, {course.state}</div>
                        </button>
                    )}
                </For>
            </div>
        </Show>
      </div>

      <button
        onClick={() => props.onStart()}
        disabled={!props.courseName()}
        class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-5 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
      >
        Tee Off (Manual)
      </button>
      
      <p class="text-center text-xs text-slate-500 mt-4">
        Selecting a course enables GPS & Maps.
      </p>
    </div>
  );
};
