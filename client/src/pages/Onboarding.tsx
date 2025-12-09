import { createSignal, For, Show, onMount, type JSX } from 'solid-js';
import * as userApi from '../api/users';
import * as bagApi from '../api/bag';
import { getUser, setUser } from '~/lib/storage';
import { ClubStore } from '~/lib/local-data';
import { AxiosError } from 'axios';
import {
  DriverIcon,
  WoodIcon,
  HybridIcon,
  IronIcon,
  WedgeIcon,
  PutterIcon,
} from '../components/club_icons';

type ClubType = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

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

const Onboarding = () => {
  const [step, setStep] = createSignal<'user' | 'clubs'>('user');
  const [username, setUsername] = createSignal('');
  const [selectedClubs, setSelectedClubs] = createSignal<Set<string>>(
    new Set(),
  );
  const [availableClubs, setAvailableClubs] = createSignal<
    Record<string, bagApi.ClubDefinition[]>
  >({});
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(async () => {
    // Load User
    const user = await getUser();
    if (user) {
      setStep('clubs');
    }

    // Load Club Definitions
    try {
      const definitions = await bagApi.getClubDefinitions();
      
      // Group by category (preserving order from server which is sorted by sort_order)
      const grouped: Record<string, bagApi.ClubDefinition[]> = {};
      definitions.forEach((def) => {
        if (!grouped[def.category]) {
          grouped[def.category] = [];
        }
        grouped[def.category].push(def);
      });
      
      setAvailableClubs(grouped);

      // Set defaults
      const defaults = new Set<string>();
      definitions.forEach((club) => {
        if (club.default_selected) defaults.add(club.name);
      });
      setSelectedClubs(defaults);
    } catch (e) {
      console.error('Failed to load club definitions', e);
      setError('Failed to load club options. Please refresh.');
    }
  });

  const handleUserSubmit = async (e: Event) => {
    e.preventDefault();
    if (!username()) return;
    setIsSubmitting(true);
    setError('');

    try {
      const response = await userApi.createUser(username());
      const user = response.data;

      // Save user to local storage
      await setUser(user);

      // Check if user already has a bag
      try {
        const clubs = await ClubStore.fetchFromServer();
        if (clubs && clubs.length > 0) {
          // User already has a bag, skip to home
          window.location.href = '/';
          return;
        }
      } catch (e) {
        console.error('Failed to sync bag on login', e);
      }

      setStep('clubs');
    } catch (err) {
      console.error(err);
      const axiosError = err as AxiosError<{
        errors?: { username?: string[] };
      }>;
      if (axiosError.response?.data?.errors?.username) {
        setError(`Username ${axiosError.response.data.errors.username[0]}`);
      } else {
        setError('Error connecting to server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
    
    const allDefs = Object.values(availableClubs()).flat();
    
    const bagToCreate = allDefs
      .filter((c) => selectedClubs().has(c.name))
      .reduce(
        (acc, club) => ({ ...acc, [club.name]: club.type }),
        {} as Record<string, string>,
      );

    try {
      await ClubStore.createBag(bagToCreate);
      // Reload to trigger AuthProvider to pick up new user
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to create bag', error);
      setError('Something went wrong creating your bag. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="min-h-screen bg-golf-dark pb-24">
      <div class="max-w-md mx-auto p-6">
        <Show when={step() === 'user'}>
          <header class="mb-8 text-center">
            <h1 class="text-3xl font-bold text-white mb-2">Welcome</h1>
            <p class="text-gray-400">Enter a username to track your stats.</p>
          </header>

          <form onSubmit={handleUserSubmit} class="space-y-6">
            <Show when={error()}>
              <div class="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm">
                {error()}
              </div>
            </Show>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username()}
                onInput={(e) =>
                  setUsername(
                    e.currentTarget.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, ''),
                  )
                }
                onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
                class="w-full bg-golf-surface border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-emerald-500"
                placeholder="Tiger"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting() || !username()}
              class="w-full btn-primary disabled:opacity-50 flex justify-center"
            >
              <Show when={isSubmitting()} fallback="Continue">
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </Show>
            </button>
          </form>
        </Show>

        <Show when={step() === 'clubs'}>
          <header class="mb-8 text-center">
            <h1 class="text-3xl font-bold text-white mb-2">Build Your Bag</h1>
            <p class="text-gray-400">
              Select the clubs you carry to track your stats accurately.
            </p>
          </header>

          <div class="space-y-8">
            <Show when={Object.keys(availableClubs()).length === 0}>
                <div class="flex justify-center p-8">
                    <div class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </Show>
            <For each={Object.entries(availableClubs())}>
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
        </Show>
      </div>
    </div>
  );
};

export default Onboarding;
