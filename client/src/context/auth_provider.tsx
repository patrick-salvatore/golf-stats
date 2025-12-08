import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  type Accessor,
  type JSX,
  Show,
} from 'solid-js';
import {
  getUser,
  setUser as saveUser,
  clearUser,
  type StoredUser,
} from '~/lib/storage';
import * as userApi from '~/api/users';

interface AuthContextValue {
  user: Accessor<StoredUser | null>;
  isLoading: Accessor<boolean>;
  setUser: (user: StoredUser) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>();

interface AuthProviderProps {
  children: JSX.Element;
  unauthenticated?: JSX.Element; // Shown when no user (e.g., Onboarding)
}

export function AuthProvider(props: AuthProviderProps) {
  const [user, setUserSignal] = createSignal<StoredUser | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  // Load user on mount and verify with server
  createEffect(async () => {
    try {
      const storedUser = await getUser();

      if (storedUser) {
        try {
          // Verify user exists on server
          const serverUser = await userApi.getMe();
          // User verified, update with server data
          setUserSignal(serverUser);
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 401) {
            // User no longer exists on server, clear local data
            await clearUser();
            setUserSignal(null);
          } else {
            // Network error or other issue - trust local user (offline mode)
            setUserSignal(storedUser);
          }
        }
      } else {
        setUserSignal(null);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  });

  const setUser = async (newUser: StoredUser) => {
    await saveUser(newUser);
    setUserSignal(newUser);
  };

  const logout = async () => {
    await clearUser();
    setUserSignal(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        setUser,
        logout,
      }}
    >
      <Show when={!isLoading()}>
        <Show when={user()} fallback={props.unauthenticated}>
          {props.children}
        </Show>
      </Show>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Get the current user synchronously (for use in API interceptors)
 * This reads directly from storage, not from context
 */
export { getUser as getCurrentUser } from '~/lib/storage';
