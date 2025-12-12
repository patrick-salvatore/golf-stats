import { createSignal, Show } from 'solid-js';
import * as userApi from '../api/users';
import { UserStore } from '~/lib/stores';
import { ClubStore } from '~/lib/stores';
import { AxiosError } from 'axios';

const Login = () => {
  const [username, setUsername] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleUserSubmit = async (e: Event) => {
    e.preventDefault();
    if (!username()) return;
    setIsSubmitting(true);
    setError('');

    try {
      const response = await userApi.createUser(username());
      const user = response.data;

      // Save user to local storage
      await UserStore.saveUser(user);

      // Check if user already has a bag
      try {
        await ClubStore.fetchFromServer();
      } catch (e) {
        console.error('Failed to sync bag on login', e);
      }
      
      // Force reload to ensure AuthProvider picks up the new user state
      window.location.reload(); 

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

  return (
    <div class="min-h-screen bg-golf-dark flex items-center justify-center p-6">
      <div class="w-full max-w-md">
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
      </div>
    </div>
  );
};

export default Login;
