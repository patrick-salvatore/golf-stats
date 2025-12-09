import type { Component, Accessor, Setter } from "solid-js";
import { Show } from "solid-js";
import type { GIRStatus } from "~/lib/db";

interface ApproachInputProps {
  girStatus: Accessor<GIRStatus | null>;
  setGirStatus: Setter<GIRStatus | null>;
  proximity: Accessor<number>;
  setProximity: Setter<number>;
}

export const ApproachInput: Component<ApproachInputProps> = (props) => {
  return (
    <div class="card space-y-6">
      <div>
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          Approach (GIR)
        </h3>

        {/* D-Pad Layout */}
        <div class="flex flex-col items-center gap-2">
          {/* Top: Long */}
          <button
            onClick={() => props.setGirStatus("long")}
            class={`w-20 h-12 rounded-lg font-bold text-xs transition-all border border-white/5 ${
              props.girStatus() === "long"
                ? "bg-amber-500 text-white"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            Long
          </button>

          {/* Middle: Left - Hit - Right */}
          <div class="flex gap-2">
            <button
              onClick={() => props.setGirStatus("left")}
              class={`w-20 h-16 rounded-lg font-bold text-xs transition-all border border-white/5 ${
                props.girStatus() === "left"
                  ? "bg-amber-500 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              Left
            </button>
            <button
              onClick={() => props.setGirStatus("hit")}
              class={`w-24 h-16 rounded-xl font-bold text-sm transition-all shadow-lg ${
                props.girStatus() === "hit"
                  ? "bg-emerald-500 text-white ring-2 ring-emerald-400/50"
                  : "bg-slate-700 text-white"
              }`}
            >
              On Green
            </button>
            <button
              onClick={() => props.setGirStatus("right")}
              class={`w-20 h-16 rounded-lg font-bold text-xs transition-all border border-white/5 ${
                props.girStatus() === "right"
                  ? "bg-amber-500 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              Right
            </button>
          </div>

          {/* Bottom: Short */}
          <button
            onClick={() => props.setGirStatus("short")}
            class={`w-20 h-12 rounded-lg font-bold text-xs transition-all border border-white/5 ${
              props.girStatus() === "short"
                ? "bg-amber-500 text-white"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            Short
          </button>
        </div>
      </div>

      {/* Proximity Slider (Only if On Green) */}
      <Show when={props.girStatus() === "hit"}>
        <div class="pt-4 border-t border-white/5 animate-fade-in-up">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Proximity
            </h3>
            <span class="text-xl font-black text-white">
              {props.proximity() === 45 ? "45+" : props.proximity()}{" "}
              <span class="text-sm text-slate-500 font-normal">
                ft
              </span>
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="45"
            value={props.proximity()}
            onInput={(e) =>
              props.setProximity(parseInt(e.currentTarget.value))
            }
            class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div class="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>1ft</span>
            <span>15ft</span>
            <span>30ft</span>
            <span>45+ft</span>
          </div>
        </div>
      </Show>
    </div>
  );
};
