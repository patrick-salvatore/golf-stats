import { For } from "solid-js";
import {
  DriverIcon,
  WoodIcon,
  HybridIcon,
  IronIcon,
  WedgeIcon,
  PutterIcon,
} from "./club_icons";
import { Club } from "~/lib/db";

const getIcon = (type: string) => {
  switch (type.toLowerCase()) {
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

interface ClubSelectorProps {
  clubs: Club[];
  onClubSelect: (club: Club) => void;
  selectedClubs: Club[];
}

export const ClubSelector = (props: ClubSelectorProps) => {
  return (
    <div class="w-full overflow-x-auto pb-4 scrollbar-hide">
      <div class="flex gap-3 px-1 min-w-min">
        <For each={props.clubs}>
          {(club) => {            
            const Icon = getIcon(club.type);

            return (
              <button
                onClick={() => props.onClubSelect(club)}
                class={`
                  flex flex-col items-center justify-center min-w-[70px] h-[80px] rounded-xl border transition-all active:scale-95
                  ${
                    props.selectedClubs.find((c) => c.id === club.id)
                      ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700 hover:text-white"
                  }
                `}
              >
                <Icon class="w-6 h-6 mb-2" />
                <span class="text-xs font-bold truncate max-w-[60px]">
                  {club.name}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};
