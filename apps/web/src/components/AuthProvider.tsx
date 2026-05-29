import { createContext, useContext, createSignal, onMount, JSX, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getMe, getWorkspaces, logout as apiLogout, User, Workspace } from '../api/auth';

export interface AuthContextType {
  currentUser: () => User | null;
  setCurrentUser: (user: User | null) => void;
  activeWorkspace: () => Workspace | null;
  setActiveWorkspace: (w: Workspace | null) => void;
  workspaces: () => Workspace[];
  setWorkspaces: (ws: Workspace[]) => void;
  loading: () => boolean;
  setLoading: (l: boolean) => void;
  switching: () => boolean;
  switchWorkspace: (id: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
  const [currentUser, setCurrentUser] = createSignal<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = createSignal<Workspace | null>(null);
  const [workspaces, setWorkspaces] = createSignal<Workspace[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [switching, setSwitching] = createSignal(false);
  const [toastError, setToastError] = createSignal<string | null>(null);

  const navigate = useNavigate();

  const initAuth = async () => {
    setLoading(true);
    try {
      const userPromise = getMe().catch((err) => {
        console.error('Auth initialization failed', err);
        return null;
      });
      const workspacesPromise = getWorkspaces().catch((err) => {
        console.error('Workspaces load failed', err);
        return null;
      });

      const [user, ws] = await Promise.all([userPromise, workspacesPromise]);

      if (user) {
        setCurrentUser(user);
        if (ws) {
          setWorkspaces(ws);
          if (ws.length > 0) {
            setActiveWorkspace(ws[0]);
          } else {
            setActiveWorkspace(null);
          }
        } else {
          setWorkspaces([]);
          setActiveWorkspace(null);
        }
      } else {
        setCurrentUser(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
      }
    } catch (err) {
      console.error('Unexpected auth initialization error', err);
      setCurrentUser(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    initAuth();
  });

  const switchWorkspace = async (id: string) => {
    setSwitching(true);
    // Add small visual delay for transitions and double navigation guard
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      const target = workspaces().find((w) => w.id === id);
      if (!target) {
        throw new Error('access denied');
      }
      setActiveWorkspace(target);
      navigate(`/w/${id}`);
    } catch {
      setToastError('Failed to switch workspace: access denied.');
      setTimeout(() => {
        setToastError(null);
      }, 4000);
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await apiLogout();
    } catch {
      // even if API fails, clear local session
    } finally {
      setCurrentUser(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    currentUser,
    setCurrentUser,
    activeWorkspace,
    setActiveWorkspace,
    workspaces,
    setWorkspaces,
    loading,
    setLoading,
    switching,
    switchWorkspace,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {props.children}
      <Show when={switching()}>
        <div
          data-testid="workspace-switching-shimmer"
          class="absolute top-0 left-0 right-0 z-50 h-[2px] bg-gradient-to-r from-accent-primary via-blue-400 to-accent-primary bg-[length:200%_auto] animate-shimmer-fast dark:from-blue-500 dark:via-blue-400 dark:to-blue-500"
        />
        <div class="fixed inset-0 z-[9999] pointer-events-auto cursor-wait bg-transparent" />
      </Show>
      <Show when={toastError()}>
        <div
          data-testid="workspace-switch-error-toast"
          class="bg-surface border border-status-blocked border-l-4 shadow-xl p-4 rounded-md flex items-center gap-3 absolute bottom-4 right-4 z-50 animate-shake"
        >
          <span class="text-xs font-semibold text-primary select-none">{toastError()}</span>
        </div>
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
