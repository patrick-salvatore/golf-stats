import { createStore } from 'solid-js/store';
import { For, Show, onMount, type JSX } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { ClubStore } from '~/lib/stores';
import {
  DriverIcon,
  WoodIcon,
  HybridIcon,
  IronIcon,
  WedgeIcon,
  PutterIcon,
} from '../components/club_icons';
import { ClubDefinition } from '~/lib/db';

const getIcon = (
  type: string,
): ((props: { class?: string }) => JSX.Element) => {
  switch (type) {
    case 'driver':
      return DriverIcon;
    case 'wood':
      return WoodIcon;
    case 'hybrid':
      return HybridIcon;
    case 'iron':
      return IronIcon;
    case 'wedge':
      return WedgeIcon;
    case 'putter':
      return PutterIcon;
    default:
      return IronIcon;
  }
};

type OnboardingStore = {
  isLoading: boolean;
  selectedClubs: Set<string>;
  availableClubs: Record<string, ClubDefinition[]>;
  isSubmitting: boolean;
  error: string;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [onboaringStore, setOnboardingStore] = createStore<OnboardingStore>({
    isLoading: false,
    selectedClubs: new Set(),
    availableClubs: {},
    isSubmitting: false,
    error: '',
  });

  const isEditMode = () => location.pathname === '/bag';

  onMount(async () => {
    try {
      setOnboardingStore('isLoading', true);

      const currentClubs = await ClubStore.getAll();
      const definitions = await ClubStore.getClubDefinitions();

      if (!isEditMode() && currentClubs.length > 0) {
        navigate('/', { replace: true });
        return;
      }

      if (currentClubs.length > 0) {
        const existingSet = new Set<string>();
        currentClubs.forEach((club) => {
          existingSet.add(club.name);
        });
        setOnboardingStore('selectedClubs', existingSet);
      } else {
        const defaults = new Set<string>();
        definitions.forEach((club) => {
          if (club.default_selected) {
            defaults.add(club.name);
          }
        });
        setOnboardingStore('selectedClubs', defaults);
      }

      const grouped = definitions.reduce(
        (grouped, def) => {
          if (!grouped[def.category]) {
            grouped[def.category] = [];
          }
          grouped[def.category].push(def);

          return grouped;
        },
        {} as Record<string, ClubDefinition[]>,
      );
      setOnboardingStore('availableClubs', grouped);
    } catch (e) {
      console.error('Failed to load club definitions', e);
      setOnboardingStore(
        'error',
        'Failed to load club options. Please refresh.',
      );
    } finally {
      setOnboardingStore('isLoading', false);
    }
  });

  const toggleClub = (clubName: string) => {
    const current = new Set(onboaringStore.selectedClubs);
    if (current.has(clubName)) {
      current.delete(clubName);
    } else {
      current.add(clubName);
    }
    setOnboardingStore('selectedClubs', current);
  };

  const handleSubmit = async () => {
    setOnboardingStore('isSubmitting', true);

    const allDefs = Object.values(onboaringStore.availableClubs).flat();

    const bagToCreate = allDefs
      .filter((c) => onboaringStore.selectedClubs.has(c.name))
      .reduce(
        (acc, club) => ({ ...acc, [club.name]: club.type }),
        {} as Record<string, string>,
      );

    try {
      if (isEditMode()) {
        await ClubStore.updateBag(bagToCreate);
      } else {
        await ClubStore.createBag(bagToCreate);
      }
      // Reload to trigger AuthProvider to pick up new user
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to save bag', error);
      setOnboardingStore(
        'error',
        'Something went wrong saving your bag. Please try again.',
      );
    } finally {
      setOnboardingStore('isSubmitting', false);
    }
  };

  return (
    <div class="min-h-screen bg-golf-dark pb-24">
      <div class="max-w-md mx-auto p-6">
        <header class="mb-8 text-center">
          <h1 class="text-3xl font-bold text-white mb-2">
            {isEditMode() ? 'Edit Your Bag' : 'Build Your Bag'}
          </h1>
          <p class="text-gray-400">
            Select the clubs you carry to track your stats accurately.
          </p>
        </header>

        <div class="space-y-8">
          <Show when={onboaringStore.isLoading}>
            <div class="flex justify-center p-8">
              <div class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </Show>
          <For each={Object.entries(onboaringStore.availableClubs)}>
            {([category, clubs]) => (
              <section>
                <h2 class="text-xl font-semibold text-emerald-400 mb-4 px-2">
                  {category}
                </h2>
                <div class="grid grid-cols-2 gap-3">
                  <For each={clubs}>
                    {(club) => {
                      const Icon = getIcon(club.type);
                      const isSelected = () =>
                        onboaringStore.selectedClubs.has(club.name);

                      return (
                        <button
                          onClick={() => toggleClub(club.name)}
                          class={`
                              relative group p-4 rounded-xl border transition-all duration-200 flex flex-col items-center gap-3
                              ${
                                isSelected()
                                  ? 'bg-emerald-900/30 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                  : 'bg-golf-surface border-white/5 hover:border-white/20 hover:bg-slate-800'
                              }
                            `}
                        >
                          <div
                            class={`
                              w-12 h-12 rounded-full flex items-center justify-center transition-colors
                              ${
                                isSelected()
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-700/50 text-slate-400 group-hover:text-slate-200'
                              }
                            `}
                          >
                            <Icon class="w-7 h-7" />
                          </div>
                          <span
                            class={`font-medium ${
                              isSelected() ? 'text-white' : 'text-gray-400'
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
            <Show when={onboaringStore.error}>
              <div class="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm mb-4">
                {onboaringStore.error}
              </div>
            </Show>
            <button
              onClick={handleSubmit}
              disabled={
                onboaringStore.isSubmitting ||
                onboaringStore.selectedClubs.size === 0
              }
              class="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Show
                when={onboaringStore.isSubmitting}
                fallback={
                  <span>
                    {isEditMode() ? 'Update Bag' : 'Complete Setup'} (
                    {onboaringStore.selectedClubs.size} clubs)
                  </span>
                }
              >
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>
                  {isEditMode() ? 'Updating Bag...' : 'Creating Bag...'}
                </span>
              </Show>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
