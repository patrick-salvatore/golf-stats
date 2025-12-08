import { For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { useRounds } from '~/context/round_provider';

export default function Home() {
  const { pastRounds, syncRound } = useRounds();

  return (
    <div class="max-w-lg mx-auto pb-20 pt-8 px-4">
      {/* Header */}
      <header class="mb-10 text-center">
        <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 tracking-tight mb-2">
          Golf Stats
        </h1>
        <p class="text-slate-400 font-medium">Track your game, hole by hole.</p>
      </header>

      {/* Main Action */}
      <div class="grid grid-cols-2 gap-4 mb-12">
        <A
          href="/track"
          class="group relative block w-full overflow-hidden rounded-3xl p-[2px] col-span-2"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-70 group-hover:opacity-100 transition-opacity blur-lg"></div>
          <div class="relative bg-slate-900 rounded-[22px] p-6 flex items-center justify-between border border-white/10 group-hover:bg-slate-800 transition-colors h-full">
            <div class="text-left">
              <span class="block text-2xl font-bold text-white mb-1">
                New Round
              </span>
              <span class="text-emerald-400 text-sm font-medium">
                Tap to start tracking
              </span>
            </div>
            <div class="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </div>
        </A>

        <A
          href="/stats"
          class="group relative block w-full overflow-hidden rounded-3xl p-[2px] col-span-2"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-70 group-hover:opacity-100 transition-opacity blur-lg"></div>
          <div class="relative bg-slate-900 rounded-[22px] p-6 flex items-center justify-between border border-white/10 group-hover:bg-slate-800 transition-colors h-full">
            <div class="text-left">
              <span class="block text-xl font-bold text-white mb-1">
                Analytics
              </span>
              <span class="text-blue-400 text-xs font-medium">
                View your trends
              </span>
            </div>
            <div class="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </A>
      </div>

      {/* Recent Activity */}
      <div class="flex justify-between items-end mb-6">
        <h2 class="text-xl font-bold text-white">Recent Rounds</h2>
        <A
          href="/history"
          class="text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors"
        >
          View All
        </A>
      </div>

      <div class="space-y-4">
        <Show
          when={pastRounds()}
          fallback={
            <div class="animate-pulse space-y-4">{/* skeletons */}</div>
          }
        >
          <For each={pastRounds().slice(0, 5)}>
            {(round) => (
              <div class="card group hover:border-emerald-500/30 transition-colors">
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors">
                      {round.courseName}
                    </h3>
                    <div class="flex items-center space-x-2 mt-1">
                      <span class="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                        {round.date}
                      </span>
                      {!round.synced && (
                        <span class="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          Unsynced
                        </span>
                      )}
                    </div>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-3xl font-black text-white leading-none">
                      {round.totalScore}
                    </span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                      Score
                    </span>
                  </div>
                </div>

                {!round.synced && (
                  <div class="mt-4 pt-3 border-t border-white/5 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        round.id && syncRound(round.id);
                      }}
                      class="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      Sync to Cloud
                    </button>
                  </div>
                )}
              </div>
            )}
          </For>
        </Show>
        <Show when={pastRounds()?.length === 0}>
          <div class="text-center py-10 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700">
            <p class="text-slate-500 mb-2">No rounds played yet.</p>
            <p class="text-sm text-slate-600">Get out there and swing!</p>
          </div>
        </Show>
      </div>
    </div>
  );
}
