import { For, Show, createSignal, onCleanup } from 'solid-js';

interface ViewerInfo {
  id: string;
  name: string;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500',
  'bg-teal-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-500',
  'bg-amber-500', 'bg-emerald-500',
];

function getUserAvatarColor(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function PresenceIndicator() {
  const [viewers, setViewers] = createSignal<ViewerInfo[]>([]);

  const handler = (e: Event) => {
    const event = e as CustomEvent;
    const detail = event.detail;

    if (detail.type === 'user_joined') {
      setViewers((prev) => {
        if (prev.some((v) => v.id === detail.user_id)) return prev;
        return [...prev, { id: detail.user_id, name: detail.username }];
      });
    } else if (detail.type === 'user_left') {
      setViewers((prev) => prev.filter((v) => v.id !== detail.user_id));
    }
  };

  window.addEventListener('kanbrio:board:event', handler);
  onCleanup(() => window.removeEventListener('kanbrio:board:event', handler));

  return (
    <Show when={viewers().length > 0}>
      <div
        class="flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-300 ease-standard"
        role="group"
        aria-label={`${viewers().length} ${viewers().length === 1 ? 'person' : 'people'} viewing this board`}
        data-testid="presence-indicator"
      >
        <div class="flex items-center" data-testid="presence-avatar-stack">
          <For each={viewers().slice(0, 3)}>
            {(viewer) => (
              <div
                class="w-7 h-7 -ml-1.5 first:ml-0 rounded-full border-2 border-surface overflow-hidden animate-ws-pop transition-all"
                title={viewer.name}
                role="img"
                aria-label={`${viewer.name} is viewing`}
                data-testid={`presence-avatar-${viewer.id}`}
              >
                <div
                  class={`w-full h-full flex items-center justify-center text-[10px] font-bold text-white ${getUserAvatarColor(viewer.id)}`}
                >
                  {viewer.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              </div>
            )}
          </For>
          <Show when={viewers().length > 3}>
            <div
              class="w-7 h-7 -ml-1.5 first:ml-0 rounded-full border-2 border-surface bg-elevated flex items-center justify-center text-[10px] font-bold text-secondary animate-ws-pop"
              role="img"
              aria-label={`Plus ${viewers().length - 3} more viewers`}
            >
              +{viewers().length - 3}
            </div>
          </Show>
        </div>

        <span
          data-testid="presence-count-label"
          class="text-[10px] font-semibold text-secondary uppercase tracking-wide transition-opacity duration-300"
        >
          {viewers().length} {viewers().length === 1 ? 'viewing' : 'viewing'}
        </span>
      </div>
    </Show>
  );
}
