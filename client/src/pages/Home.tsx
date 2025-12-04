import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { db } from "../db";

const fetchRounds = async () => {
  return await db.rounds.orderBy('date').reverse().toArray();
};

export default function Home() {
  const [rounds, { refetch }] = createResource(fetchRounds);

  const syncRound = async (roundId: number) => {
    try {
      const round = await db.rounds.get(roundId);
      if (!round) return;

      const holes = await db.holes.where('roundId').equals(roundId).toArray();
      
      const payload = {
        round: {
          ...round,
          holes
        }
      };

      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await db.rounds.update(roundId, { synced: 1 });
        refetch();
        alert('Round synced successfully!');
      } else {
        const error = await response.text();
        alert('Failed to sync: ' + error);
      }
    } catch (e) {
      console.error(e);
      alert('Error syncing round');
    }
  };

  return (
    <div class="p-4 max-w-md mx-auto">
      <h1 class="text-3xl font-bold mb-6 text-emerald-600">Golf Stats</h1>
      
      <A href="/track" class="block w-full bg-emerald-600 text-white text-center py-3 rounded-lg font-semibold mb-8 hover:bg-emerald-700 transition">
        Start New Round
      </A>

      <h2 class="text-xl font-semibold mb-4">Recent Rounds</h2>
      
      <div class="space-y-4">
        <Show when={rounds()} fallback={<p>Loading rounds...</p>}>
          <For each={rounds()}>
            {(round) => (
              <div class="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
                <div class="flex justify-between items-center">
                  <div>
                    <div class="font-bold text-lg">{round.courseName}</div>
                    <div class="text-gray-400 text-sm">{round.date}</div>
                  </div>
                  <div class="text-2xl font-bold text-emerald-400">{round.totalScore}</div>
                </div>
                <div class="mt-2 text-right">
                   {!round.synced && (
                     <button onClick={() => round.id && syncRound(round.id)} class="text-xs text-blue-400 hover:text-blue-300">
                       Sync to Cloud
                     </button>
                   )}
                </div>
              </div>
            )}
          </For>
        </Show>
        <Show when={rounds()?.length === 0}>
          <p class="text-gray-500 text-center">No rounds tracked yet.</p>
        </Show>
      </div>
    </div>
  );
}
