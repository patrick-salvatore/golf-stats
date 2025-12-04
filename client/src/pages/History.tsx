import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { db } from "../db";

const ITEMS_PER_PAGE = 10;

const fetchHistory = async (page: number) => {
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  const count = await db.rounds
    .filter(r => r.synced === 1)
    .count();
    
  const rounds = await db.rounds
    .orderBy('date')
    .reverse()
    .filter(r => r.synced === 1)
    .offset(offset)
    .limit(ITEMS_PER_PAGE)
    .toArray();

  return { rounds, total: count };
};

export default function History() {
  const [page, setPage] = createSignal(1);
  const [data] = createResource(page, fetchHistory);

  const totalPages = () => Math.ceil((data()?.total || 0) / ITEMS_PER_PAGE);

  return (
    <div class="max-w-lg mx-auto p-4 pt-8">
      <div class="flex items-center mb-8">
        <A href="/" class="group flex items-center text-slate-400 hover:text-white transition-colors mr-4">
            <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
            </div>
        </A>
        <h1 class="text-3xl font-bold text-white">Round History</h1>
      </div>

      <div class="space-y-4 mb-8 min-h-[50vh]">
        <Show when={data()} fallback={<div class="space-y-4">{/* Loading Skeletons */}</div>}>
          <For each={data()?.rounds}>
            {(round) => (
              <A href={`/track?id=${round.id}`} class="card flex justify-between items-center group hover:bg-slate-800/80 transition-colors border border-white/5 cursor-pointer block">
                <div>
                  <h3 class="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors">{round.courseName}</h3>
                  <div class="text-slate-500 text-sm font-medium mt-1">{round.date}</div>
                </div>
                <div class="flex flex-col items-end">
                  <span class="text-2xl font-black text-white">{round.totalScore}</span>
                  <span class="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Score</span>
                </div>
              </A>
            )}
          </For>
        </Show>
        <Show when={data()?.rounds.length === 0}>
           <div class="text-center py-20">
               <div class="text-6xl mb-4">⛳️</div>
               <p class="text-slate-500 font-medium">No history found yet.</p>
           </div>
        </Show>
      </div>

      <Show when={totalPages() > 1}>
        <div class="flex justify-center items-center gap-4 py-6 border-t border-white/5">
          <button
            disabled={page() === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            class="px-6 py-3 bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-white transition-all active:scale-95"
          >
            Previous
          </button>
          <span class="text-slate-400 font-mono text-sm">
            {page()} / {totalPages()}
          </span>
          <button
            disabled={page() >= totalPages()}
            onClick={() => setPage(p => p + 1)}
            class="px-6 py-3 bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-white transition-all active:scale-95"
          >
            Next
          </button>
        </div>
      </Show>
    </div>
  );
}
