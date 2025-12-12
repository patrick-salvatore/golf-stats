import { For, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAppContext } from '~/context/app_provider';
import { RoundStore } from '~/lib/stores';

export default function Home() {
  const navigate = useNavigate();
  const { pastRounds, activeRound, syncRound } = useAppContext();

  const handleEndRound = async (e: Event, roundId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Are you sure you want to end this round?')) {
      await RoundStore.update(roundId, { endedAt: new Date().toISOString() });
      await syncRound(roundId);
    }
  };

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
        <Show
          when={activeRound()}
          fallback={
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
          }
        >
          {/* Resume Round Card */}
          <A
            href={`/track/${activeRound().id}?mode=playing`}
            class="group relative block w-full overflow-hidden rounded-3xl p-[2px] col-span-2"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 opacity-70 group-hover:opacity-100 transition-opacity blur-lg animate-pulse"></div>
            <div class="relative bg-slate-900 rounded-[22px] p-6 flex items-center justify-between border border-white/10 group-hover:bg-slate-800 transition-colors h-full">
              <div class="text-left flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span class="text-amber-500 text-xs font-bold uppercase tracking-wider">
                    In Progress
                  </span>
                </div>
                <span class="block text-xl font-bold text-white mb-1 truncate max-w-[200px]">
                  {activeRound().courseName}
                </span>
                <span class="text-slate-400 text-sm font-medium">
                  Tap to resume
                </span>
              </div>
              
              <div class="flex flex-col items-end gap-2">
                 <div class="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
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
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                
                <button 
                  onClick={(e) => handleEndRound(e, activeRound().id!)}
                  class="text-xs text-slate-500 hover:text-red-400 font-medium underline decoration-slate-700 underline-offset-2 hover:decoration-red-400 transition-all z-10"
                >
                  End Round
                </button>
              </div>
            </div>
          </A>
        </Show>

        <A
          href="/stats"
          class="group relative block w-full overflow-hidden rounded-3xl p-[2px]"
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

        <A
          href="/courses"
          class="group relative block w-full overflow-hidden rounded-3xl p-[2px]"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-70 group-hover:opacity-100 transition-opacity blur-lg"></div>
          <div class="relative bg-slate-900 rounded-[22px] p-6 flex items-center justify-between border border-white/10 group-hover:bg-slate-800 transition-colors h-full">
            <div class="text-left">
              <span class="block text-xl font-bold text-white mb-1">
                Builder
              </span>
              <span class="text-purple-400 text-xs font-medium">
                Create courses
              </span>
            </div>
            <div class="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
          fallback={<div class="animate-pulse space-y-4"></div>}
        >
          <For each={pastRounds().slice(0, 5)}>
            {(round) => (
              <div
                class="card group hover:border-emerald-500/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/track/${round.id}`)}
              >
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors">
                      {round.courseName}
                    </h3>
                    <div class="flex items-center space-x-2 mt-1">
                      <span class="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                        {round.date}
                      </span>
                      {!round.syncStatus && (
                        <span class="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          Unsynced
                        </span>
                      )}
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="flex flex-col items-end">
                      <span class="text-3xl font-black text-white leading-none">
                        {round.totalScore}
                      </span>
                      <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                        Score
                      </span>
                    </div>
                  </div>
                </div>
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
