import { createResource, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import * as statsApi from "~/api/stats";

// --- Statistics Interface ---
interface DashboardStats {
  avgScore: number;
  avgPar3: number;
  avgPar4: number;
  avgPar5: number;
  fairways: {
    total: number;
    hit: number;
    missLeft: number;
    missRight: number;
  };
  gir: {
    total: number;
    hit: number;
  };
  approach: {
    proximity: {
      '0-10': number;
      '10-15': number;
      '15-30': number;
      '30-45': number;
      '45+': number;
    };
  };
  putting: {
    totalHoles: number;
    threePutts: number;
    puttsByProx: Record<string, { putts: number; count: number }>;
  };
  clubStats: Array<{
    id: number;
    name: string;
    usageCount: number;
    fairwayData?: {
      attempts: number;
      hits: number;
    };
  }>;
}

// --- Data Fetching ---
const fetchStats = async (): Promise<DashboardStats | null> => {
  try {
    return await statsApi.getStats();
  } catch (e) {
    console.error(e);
    return null;
  }
};

// --- Components ---

const StatCard = (props: { title: string, value: string | number, subtext?: string }) => (
    <div class="bg-slate-800 p-4 rounded-xl border border-white/5">
        <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{props.title}</div>
        <div class="text-2xl font-black text-white">{props.value}</div>
        <Show when={props.subtext}>
            <div class="text-xs text-slate-500 mt-1">{props.subtext}</div>
        </Show>
    </div>
);

const ProgressBar = (props: { label: string, value: number, max: number, color: string }) => {
    const pct = props.max > 0 ? (props.value / props.max) * 100 : 0;
    return (
        <div class="mb-3">
            <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-300 font-medium">{props.label}</span>
                <span class="text-slate-400">{Math.round(pct)}% <span class="text-slate-600 text-[10px]">({props.value})</span></span>
            </div>
            <div class="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                <div class={`h-full rounded-full ${props.color}`} style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    )
}

export default function Dashboard() {
  const [stats] = createResource<DashboardStats | null>(fetchStats);

  return (
    <div class="max-w-lg mx-auto p-4 pt-8 pb-20">
      <div class="flex items-center mb-8">
        <A href="/" class="group flex items-center text-slate-400 hover:text-white transition-colors mr-4">
            <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
            </div>
        </A>
        <h1 class="text-3xl font-bold text-white">Analytics</h1>
      </div>

      <Show when={stats()} fallback={<div class="animate-pulse space-y-4">{/* skeletons */}</div>}>
        {(s) => {
            const val = s();
            if (!val || val.gir.total === 0) {
                return (
                    <div class="text-center py-20 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
                        <div class="text-4xl mb-4">📊</div>
                        <p class="text-slate-400">Complete rounds to generate stats!</p>
                    </div>
                );
            }

            return (
                <div class="space-y-6">
                    
                    {/* Scoring Overview */}
                    <section>
                        <h2 class="text-lg font-bold text-white mb-3">Scoring</h2>
                        <div class="grid grid-cols-1 gap-3 mb-3">
                            <StatCard title="Avg Score" value={val.avgScore} />
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                            <StatCard title="Par 3 Avg" value={val.avgPar3} />
                            <StatCard title="Par 4 Avg" value={val.avgPar4} />
                            <StatCard title="Par 5 Avg" value={val.avgPar5} />
                        </div>
                    </section>

                    {/* Club Stats (New) */}
                    <section>
                        <h2 class="text-lg font-bold text-white mb-3">Club Performance</h2>
                        <div class="bg-slate-800 p-5 rounded-xl border border-white/5 space-y-4">
                            <div class="grid grid-cols-12 text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-white/5">
                                <div class="col-span-5">Club</div>
                                <div class="col-span-3 text-center">Uses</div>
                                <div class="col-span-4 text-right">Fairway %</div>
                            </div>
                            <For each={val.clubStats}>
                                {(club) => (
                                    <div class="grid grid-cols-12 items-center py-2 border-b border-white/5 last:border-0">
                                        <div class="col-span-5 font-bold text-white">{club.name}</div>
                                        <div class="col-span-3 text-center text-slate-400">{club.usageCount}</div>
                                        <div class="col-span-4 text-right">
                                            <Show when={club.fairwayData} fallback={<span class="text-slate-600">-</span>}>
                                                {(fd) => {
                                                    const pct = Math.round((fd().hits / fd().attempts) * 100);
                                                    let color = "text-white";
                                                    if(pct >= 60) color = "text-emerald-400";
                                                    else if(pct >= 40) color = "text-amber-400";
                                                    else color = "text-red-400";
                                                    
                                                    return <span class={`font-mono font-bold ${color}`}>{pct}%</span>
                                                }}
                                            </Show>
                                        </div>
                                    </div>
                                )}
                            </For>
                            <Show when={val.clubStats.length === 0}>
                                <div class="text-center text-slate-500 py-4 text-sm">No club data tracked yet.</div>
                            </Show>
                        </div>
                    </section>

                    {/* Off the Tee */}
                    <section>
                        <h2 class="text-lg font-bold text-white mb-3">Off the Tee</h2>
                        <div class="bg-slate-800 p-5 rounded-xl border border-white/5">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <div class="text-3xl font-black text-white">
                                        {val.fairways.total ? Math.round((val.fairways.hit / val.fairways.total) * 100) : 0}%
                                    </div>
                                    <div class="text-xs text-slate-400 font-bold uppercase">Fairways Hit</div>
                                </div>
                            </div>
                            
                            <div class="space-y-4">
                                <div class="relative pt-6">
                                    <div class="flex text-xs font-bold text-slate-400 mb-2 justify-between">
                                        <span>Left Miss</span>
                                        <span>Right Miss</span>
                                    </div>
                                    <div class="h-4 bg-slate-700 rounded-full flex overflow-hidden">
                                        <div class="bg-amber-500 h-full" style={{ width: `${val.fairways.total ? (val.fairways.missLeft / val.fairways.total) * 100 : 0}%` }}></div>
                                        <div class="bg-emerald-500 h-full" style={{ width: `${val.fairways.total ? (val.fairways.hit / val.fairways.total) * 100 : 0}%` }}></div>
                                        <div class="bg-amber-500 h-full" style={{ width: `${val.fairways.total ? (val.fairways.missRight / val.fairways.total) * 100 : 0}%` }}></div>
                                    </div>
                                    <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                                        <span>{val.fairways.total ? Math.round((val.fairways.missLeft / val.fairways.total) * 100) : 0}%</span>
                                        <span>{val.fairways.total ? Math.round((val.fairways.missRight / val.fairways.total) * 100) : 0}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Approach */}
                    <section>
                        <h2 class="text-lg font-bold text-white mb-3">Approach</h2>
                        <div class="bg-slate-800 p-5 rounded-xl border border-white/5">
                             <div class="flex items-center justify-between mb-6">
                                <div>
                                    <div class="text-3xl font-black text-white">
                                        {val.gir.total ? Math.round((val.gir.hit / val.gir.total) * 100) : 0}%
                                    </div>
                                    <div class="text-xs text-slate-400 font-bold uppercase">Green in Reg (GIR)</div>
                                </div>
                            </div>

                            <div class="pt-2 border-t border-white/5">
                                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 mt-2">Proximity to Hole</h3>
                                <ProgressBar label="0-10 ft" value={val.approach.proximity['0-10']} max={val.gir.hit} color="bg-emerald-400" />
                                <ProgressBar label="10-15 ft" value={val.approach.proximity['10-15']} max={val.gir.hit} color="bg-emerald-500" />
                                <ProgressBar label="15-30 ft" value={val.approach.proximity['15-30']} max={val.gir.hit} color="bg-teal-500" />
                                <ProgressBar label="30-45 ft" value={val.approach.proximity['30-45']} max={val.gir.hit} color="bg-teal-600" />
                                <ProgressBar label="45+ ft" value={val.approach.proximity['45+']} max={val.gir.hit} color="bg-slate-500" />
                            </div>
                        </div>
                    </section>

                    {/* Putting */}
                    <section>
                        <h2 class="text-lg font-bold text-white mb-3">Putting</h2>
                        <div class="grid grid-cols-2 gap-3 mb-3">
                            <StatCard 
                                title="3-Putt %" 
                                value={`${val.putting.totalHoles ? Math.round((val.putting.threePutts / val.putting.totalHoles) * 100) : 0}%`} 
                            />
                            <StatCard 
                                title="Avg Putts" 
                                value={`${(val.putting.threePutts / val.putting.totalHoles * 36).toFixed(1)}`}
                                subtext="per round (est)"
                            />
                        </div>

                        <div class="bg-slate-800 p-5 rounded-xl border border-white/5">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Avg Putts by Distance</h3>
                            <div class="space-y-3">
                                {Object.entries(val.putting.puttsByProx).map(([range, data]: [string, any]) => (
                                    <div class="flex justify-between items-center">
                                        <span class="text-sm font-medium text-slate-300">{range} ft</span>
                                        <div class="flex items-center gap-3">
                                            <div class="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
                                                <div 
                                                    class="h-full bg-emerald-500 rounded-full" 
                                                    style={{ width: `${Math.min(100, (data.count > 0 ? (data.putts / data.count) / 3 * 100 : 0))}%` }}
                                                ></div>
                                            </div>
                                            <span class="text-sm font-bold text-white w-8 text-right">
                                                {data.count > 0 ? (data.putts / data.count).toFixed(1) : '-'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                </div>
            );
        }}
      </Show>
    </div>
  );
}
