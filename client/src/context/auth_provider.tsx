import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  type Accessor,
  type JSX,
  Show,
} from 'solid-js';
import { UserStore , LocalUser} from '~/lib/stores';
import * as userApi from '~/api/users';

interface AuthContextValue {
  user: Accessor<LocalUser | null>;
  isLoading: Accessor<boolean>;
  setUser: (user: LocalUser) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>();

interface AuthProviderProps {
  children: JSX.Element;
  unauthenticated?: JSX.Element; // Shown when no user (e.g., Onboarding)
}

export function AuthProvider(props: AuthProviderProps) {
  const [user, setUserSignal] = createSignal<LocalUser | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  const setUser = async (newUser: LocalUser) => {
    await UserStore.saveUser(newUser);
    setUserSignal(newUser);
  };

  const logout = async () => {
    await UserStore.clearUser();
    setUserSignal(null);
  };

  // Load user on mount and verify with server
  createEffect(async () => {
    try {
      const storedUser = await UserStore.getUser();

      if (storedUser) {
        try {
          const serverUser = await userApi.getMe();
          setUserSignal(serverUser);
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 401) {
            await UserStore.clearUser();
            setUserSignal(null);
          } else {
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
