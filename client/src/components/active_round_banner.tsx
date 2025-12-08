import { For, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { useRounds } from "~/context/round_provider";

export default function ActiveRoundBanner() {
  const { activeRounds } = useRounds();
  const location = useLocation();

  return (
    <Show when={activeRounds().length > 0 && location.pathname === '/'}>
      <div class="fixed top-4 left-4 right-4 z-50 animate-fade-in-up">
        <div class="max-w-md mx-auto glass rounded-2xl p-4 shadow-2xl border-l-4 border-emerald-500">
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-bold text-xs uppercase tracking-widest text-emerald-400">Active Round</h3>
                <span class="flex h-2 w-2 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
            </div>
            <div class="space-y-2">
                <For each={[activeRounds()[0]]}>
                    {(round) => (
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="block font-bold text-white text-lg leading-tight">{round.courseName}</span>
                                <span class="text-slate-400 text-xs">{round.date}</span>
                            </div>
                            <A href={`/track?id=${round.id}`} class="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-emerald-900/20">
                                Resume
                            </A>
                        </div>
                    )}
                </For>
            </div>
        </div>
      </div>
    </Show>
  );
}
