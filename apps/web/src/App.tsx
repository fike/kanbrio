import { type Component, createEffect, Show, type JSX } from 'solid-js';
import { Route, useNavigate, useParams } from '@solidjs/router';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './components/Login/Login';
import { Register } from './components/Register/Register';
import { WorkspaceSelector } from './components/WorkspaceSelector/WorkspaceSelector';
import Board from './components/Board/Board';

export function WorkspaceLayout() {
  const auth = useAuth();
  const params = useParams();
  console.log('[WorkspaceLayout] Rendered with params:', JSON.stringify(params));

  return (
    <ProtectedRoute>
      <div class="h-screen flex flex-col">
        <header class="h-14 shrink-0 bg-surface border-b border-base flex items-center justify-between px-6 z-30 shadow-sm">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 bg-accent-primary rounded flex items-center justify-center text-white font-bold text-xs">
              K
            </div>
            <h1 class="text-md font-semibold tracking-tight">Kanbrio</h1>
          </div>

          <nav class="flex items-center gap-4 text-xs font-medium text-secondary">
            <span class="px-2 py-1 bg-elevated rounded border border-base">Board</span>
            <span class="opacity-40">Analytics</span>
            <span class="opacity-40">Settings</span>
          </nav>

          <div class="flex items-center gap-3">
            <button
              data-testid="logout-button"
              onClick={auth.logout}
              class="text-xs text-secondary hover:text-accent-primary font-medium"
            >
              Logout
            </button>
            <div class="w-8 h-8 rounded-full bg-elevated border border-base flex items-center justify-center text-[10px] font-bold text-tertiary">
              {auth.currentUser()?.name.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        <div class="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside class="w-64 bg-surface border-r border-base p-4 flex flex-col gap-4 shrink-0">
            <WorkspaceSelector />
          </aside>

          {/* Board content */}
          <main class="flex-1 overflow-hidden">
            <Board workspaceId={params.workspace_id || ''} />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export function IntelligentRedirect() {
  const auth = useAuth();
  const navigate = useNavigate();

  createEffect(() => {
    if (auth.loading()) return;
    const user = auth.currentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    const ws = auth.workspaces();
    if (ws.length > 0) {
      const active = auth.activeWorkspace();
      if (active) {
        navigate(`/w/${active.id}`);
      } else {
        navigate(`/w/${ws[0].id}`);
      }
    }
  });

  return (
    <Show
      when={!auth.loading()}
      fallback={
        <div
          data-testid="workspace-switching-shimmer"
          class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-primary via-blue-400 to-accent-primary bg-[length:200%_auto] animate-shimmer-fast"
        />
      }
    >
      <div class="h-screen flex items-center justify-center bg-base p-6">
        <WorkspaceSelector />
      </div>
    </Show>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';

const queryClient = new QueryClient();

const App: Component<{ children?: JSX.Element }> = (props) => {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </AuthProvider>
  );
};

export const AppRoutes = () => (
  <>
    <Route path="/login" component={Login} />
    <Route path="/register" component={Register} />
    <Route path="/w/:workspace_id" component={WorkspaceLayout} />
    <Route path="/" component={IntelligentRedirect} />
    <Route path="*path" component={IntelligentRedirect} />
  </>
);

export default App;
