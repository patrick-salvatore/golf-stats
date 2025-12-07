import { createSignal, For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { db } from '../db';
import { getAuthHeaders } from '../api';
import {
  DriverIcon,
// ...
} from '../components/ClubIcons';

type ClubType = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

interface ClubDefinition {
// ...
}

const AVAILABLE_CLUBS: Record<string, ClubDefinition[]> = {
// ... (keep as is)
};

const getIcon = (type: ClubType) => {
// ... (keep as is)
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = createSignal<'user' | 'clubs'>('user');
  const [username, setUsername] = createSignal('');
  const [selectedClubs, setSelectedClubs] = createSignal<Set<string>>(
    new Set(),
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

  onMount(async () => {
    const user = await db.users.toCollection().first();
    if (user) {
      setStep('clubs');
    }
  });

  const handleUserSubmit = async (e: Event) => {
    e.preventDefault();
    if (!username()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username() }),
      });

      if (res.ok) {
        const json = await res.json();
        const user = json.data;
        
        await db.users.clear();
        await db.users.add(user);
        
        // Check if user already has a bag
        try {
          const headers = await getAuthHeaders();
          const bagRes = await fetch('/api/bag', { headers });
          if (bagRes.ok) {
            const bagJson = await bagRes.json();
            if (bagJson.data && Array.isArray(bagJson.data) && bagJson.data.length > 0) {
               await db.clubs.clear();
               await db.clubs.bulkPut(bagJson.data);
               navigate('/');
               return;
            }
          }
        } catch (e) {
          console.error("Failed to sync bag on login", e);
        }
        
        setStep('clubs');
      } else {
        alert('Failed to sign in. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleClub = (clubName: string) => {
    // ... (keep as is)
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
    const bagToCreate = Object.values(AVAILABLE_CLUBS)
      .flat()
      .filter((c) => selectedClubs().has(c.name))
      .reduce((acc, club) => ({ ...acc, [club.name]: club.type }), {});

    try {
      const headers = await getAuthHeaders();
      await fetch('/api/bag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ bag: bagToCreate }),
      });
      navigate('/');
    } catch (error) {
      console.error('Failed to create bag', error);
      alert('Something went wrong creating your bag. Please try again.');
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
            <p class="text-gray-400">
              Enter a username to track your stats.
            </p>
          </header>

          <form onSubmit={handleUserSubmit} class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
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
