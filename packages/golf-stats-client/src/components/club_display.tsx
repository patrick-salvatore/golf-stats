import { type Component, For, Show, type JSX } from "solid-js";
import type { LocalClub } from "~/lib/stores";
import {
  DriverIcon,
  WoodIcon,
  HybridIcon,
  IronIcon,
  WedgeIcon,
  PutterIcon,
} from "./club_icons";

interface ClubDisplayProps {
  clubs: LocalClub[];
  clubIds?: number[];
}

type ClubType = "driver" | "wood" | "hybrid" | "iron" | "wedge" | "putter";

const getClubIcon = (
  type: string | undefined
): ((props: { class?: string }) => JSX.Element) => {
  switch (type?.toLowerCase() as ClubType | undefined) {
    case "driver":
      return DriverIcon;
    case "wood":
      return WoodIcon;
    case "hybrid":
      return HybridIcon;
    case "iron":
      return IronIcon;
    case "wedge":
      return WedgeIcon;
    case "putter":
      return PutterIcon;
    default:
      return IronIcon;
  }
};

export const ClubDisplay: Component<ClubDisplayProps> = (props) => {
  const resolvedClubs = () => {
    if (!props.clubIds || props.clubIds.length === 0) return [];
    
    return props.clubIds
      .map((id) => props.clubs.find((c) => c.id === id || c.serverId === id))
      .filter((c): c is LocalClub => c !== undefined);
  };

  return (
    <div class="card">
      <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
        Clubs Used
      </h3>
      <Show
        when={resolvedClubs().length > 0}
        fallback={
          <div class="text-center py-4 text-slate-500 text-sm italic">
            No clubs recorded
          </div>
        }
      >
        <div class="flex flex-wrap gap-2 items-center">
          <For each={resolvedClubs()}>
            {(club, index) => {
              const Icon = getClubIcon(club.type);
              return (
                <>
                  <div class="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-white/5">
                    <div class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-emerald-400">
                      <Icon class="w-4 h-4" />
                    </div>
                    <span class="text-sm font-medium text-white">
                      {club.name}
                    </span>
                  </div>
                  <Show when={index() < resolvedClubs().length - 1}>
                    <span class="text-slate-500 text-lg">→</span>
                  </Show>
                </>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};
