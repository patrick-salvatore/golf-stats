import { createSignal, createResource, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  DriverIcon,
  WoodIcon,
  HybridIcon,
  IronIcon,
  WedgeIcon,
  PutterIcon,
} from "../components/ClubIcons";

type ClubType = "driver" | "wood" | "hybrid" | "iron" | "wedge" | "putter";

interface ClubDefinition {
  name: string;
  type: ClubType;
  defaultSelected?: boolean;
}

const AVAILABLE_CLUBS: Record<string, ClubDefinition[]> = {
  Woods: [
    { name: "Driver", type: "driver", defaultSelected: true },
    { name: "2 Wood", type: "driver" },
    { name: "3 Wood", type: "wood", defaultSelected: true },
    { name: "5 Wood", type: "wood" },
    { name: "7 Wood", type: "wood" },
  ],
  Hybrids: [
    { name: "2 Hybrid", type: "hybrid" },
    { name: "3 Hybrid", type: "hybrid" },
    { name: "4 Hybrid", type: "hybrid" },
    { name: "5 Hybrid", type: "hybrid" },
  ],
  Irons: [
    { name: "2 Iron", type: "iron" },
    { name: "3 Iron", type: "iron" },
    { name: "4 Iron", type: "iron" },
    { name: "5 Iron", type: "iron", defaultSelected: true },
    { name: "6 Iron", type: "iron", defaultSelected: true },
    { name: "7 Iron", type: "iron", defaultSelected: true },
    { name: "8 Iron", type: "iron", defaultSelected: true },
    { name: "9 Iron", type: "iron", defaultSelected: true },
  ],
  Wedges: [
    { name: "Pitching Wedge", type: "wedge", defaultSelected: true },
    { name: "Gap Wedge", type: "wedge" },
    { name: "Sand Wedge", type: "wedge", defaultSelected: true },
    { name: "Lob Wedge", type: "wedge" },
  ],
  Putter: [{ name: "Putter", type: "putter", defaultSelected: true }],
};

const getIcon = (type: ClubType) => {
  switch (type) {
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
  }
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [selectedClubs, setSelectedClubs] = createSignal<Set<string>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Initialize with defaults
  const defaults = new Set<string>();
  Object.values(AVAILABLE_CLUBS)
    .flat()
    .forEach((club) => {
      if (club.defaultSelected) defaults.add(club.name);
    });
  setSelectedClubs(defaults);

  const toggleClub = (clubName: string) => {
    const current = new Set(selectedClubs());
    if (current.has(clubName)) {
      current.delete(clubName);
    } else {
      current.add(clubName);
    }
    setSelectedClubs(current);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const clubsToCreate = Object.values(AVAILABLE_CLUBS)
      .flat()
      .filter((c) => selectedClubs().has(c.name));

    try {
      // Create clubs sequentially to ensure order (or we could parallelize)
      // Since we don't have a bulk create endpoint yet, we loop.
      for (const club of clubsToCreate) {
        await fetch("/api/clubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ club: { name: club.name, type: club.type } }),
        });
      }
      navigate("/");
    } catch (error) {
      console.error("Failed to create bag", error);
      alert("Something went wrong creating your bag. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="min-h-screen bg-golf-dark pb-24">
      <div class="max-w-md mx-auto p-6">
        <header class="mb-8 text-center">
          <h1 class="text-3xl font-bold text-white mb-2">Build Your Bag</h1>
          <p class="text-gray-400">
            Select the clubs you carry to track your stats accurately.
          </p>
        </header>

        <div class="space-y-8">
          <For each={Object.entries(AVAILABLE_CLUBS)}>
            {([category, clubs]) => (
              <section>
                <h2 class="text-xl font-semibold text-emerald-400 mb-4 px-2">
                  {category}
                </h2>
                <div class="grid grid-cols-2 gap-3">
                  <For each={clubs}>
                    {(club) => {
                      const Icon = getIcon(club.type);
                      const isSelected = () => selectedClubs().has(club.name);

                      return (
                        <button
                          onClick={() => toggleClub(club.name)}
                          class={`
                            relative group p-4 rounded-xl border transition-all duration-200 flex flex-col items-center gap-3
                            ${
                              isSelected()
                                ? "bg-emerald-900/30 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                : "bg-golf-surface border-white/5 hover:border-white/20 hover:bg-slate-800"
                            }
                          `}
                        >
                          <div
                            class={`
                            w-12 h-12 rounded-full flex items-center justify-center transition-colors
                            ${
                              isSelected()
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-700/50 text-slate-400 group-hover:text-slate-200"
                            }
                          `}
                          >
                            <Icon class="w-7 h-7" />
                          </div>
                          <span
                            class={`font-medium ${
                              isSelected() ? "text-white" : "text-gray-400"
                            }`}
                          >
                            {club.name}
                          </span>

                          <Show when={isSelected()}>
                            <div class="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>

        {/* Floating Action Bar */}
        <div class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-golf-dark via-golf-dark to-transparent backdrop-blur-sm">
          <div class="max-w-md mx-auto">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting() || selectedClubs().size === 0}
              class="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Show
                when={isSubmitting()}
                fallback={
                  <span>Complete Setup ({selectedClubs().size} clubs)</span>
                }
              >
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Bag...</span>
              </Show>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
