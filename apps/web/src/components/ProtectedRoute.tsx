import { createEffect, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useAuth } from './AuthProvider';

export function ProtectedRoute(props: { children: JSX.Element }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  createEffect(() => {
    if (auth.loading()) return;

    const user = auth.currentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    const routeWorkspaceId = params.workspace_id;
    if (routeWorkspaceId) {
      const list = auth.workspaces();
      const hasAccess = list.some((w) => w.id === routeWorkspaceId);
      if (!hasAccess) {
        if (list.length > 0) {
          navigate(`/w/${list[0].id}`);
        } else {
          navigate('/');
        }
      }
    }
  });

  const shouldRender = () => {
    if (auth.loading()) return false;
    if (!auth.currentUser()) return false;

    const routeWorkspaceId = params.workspace_id;
    if (routeWorkspaceId) {
      const list = auth.workspaces();
      return list.some((w) => w.id === routeWorkspaceId);
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
