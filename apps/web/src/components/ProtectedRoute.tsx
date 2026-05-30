import { createEffect, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useAuth } from './AuthProvider';

export function ProtectedRoute(props: { children: JSX.Element }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  createEffect(() => {
    console.log('[ProtectedRoute Effect] loading:', auth.loading(), 'user:', auth.currentUser(), 'params:', JSON.stringify(params), 'workspaces:', JSON.stringify(auth.workspaces()));
    if (auth.loading()) return;

    const user = auth.currentUser();
    if (!user) {
      console.log('[ProtectedRoute Effect] No user, navigating to /login');
      navigate('/login');
      return;
    }

    const routeWorkspaceId = params.workspace_id;
    if (routeWorkspaceId) {
      const list = auth.workspaces();
      const hasAccess = list.some((w) => w.id === routeWorkspaceId);
      console.log('[ProtectedRoute Effect] routeWorkspaceId:', routeWorkspaceId, 'hasAccess:', hasAccess);
      if (!hasAccess) {
        if (list.length > 0) {
          console.log('[ProtectedRoute Effect] No access, redirecting to first workspace:', list[0].id);
          navigate(`/w/${list[0].id}`);
        } else {
          console.log('[ProtectedRoute Effect] No workspaces, redirecting to /');
          navigate('/');
        }
      }
    }
  });

  const shouldRender = () => {
    console.log('[ProtectedRoute shouldRender] loading:', auth.loading(), 'user:', auth.currentUser() ? 'yes' : 'no', 'params:', JSON.stringify(params), 'workspaces:', JSON.stringify(auth.workspaces()));
    if (auth.loading()) return false;
    if (!auth.currentUser()) return false;

    const routeWorkspaceId = params.workspace_id;
    if (routeWorkspaceId) {
      const list = auth.workspaces();
      const hasAccess = list.some((w) => w.id === routeWorkspaceId);
      console.log('[ProtectedRoute shouldRender] routeWorkspaceId:', routeWorkspaceId, 'hasAccess:', hasAccess);
      return hasAccess;
    }
    return true;
  };

  return (
    <Show
      when={shouldRender()}
      fallback={
        <div
          data-testid="workspace-switching-shimmer"
          class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-primary via-blue-400 to-accent-primary bg-[length:200%_auto] animate-shimmer-fast"
        />
      }
    >
      {props.children}
    </Show>
  );
}
