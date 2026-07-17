import { createSignal, onCleanup, Show, For, type Component } from 'solid-js';

interface ToastItem {
  id: number;
  message: string;
  visible: boolean;
}

const TOAST_DURATION_MS = 4000;

let nextId = 0;

function describeEvent(detail: Record<string, unknown>): string | null {
  const type = detail.type as string | undefined;
  if (!type) return null;

  if (type === 'user_joined' || type === 'user_left') return null;

  const card = detail.card as Record<string, unknown> | undefined;
  const cardTitle = typeof card?.title === 'string' ? card.title : null;
  const item = detail.item as Record<string, unknown> | undefined;
  const itemTitle = typeof item?.title === 'string' ? item.title : null;
  const comment = detail.comment as Record<string, unknown> | undefined;
  const commentContent = typeof comment?.content === 'string' ? comment.content : null;

  switch (type) {
    case 'card_moved':
      return cardTitle ? `Card moved: ${cardTitle}` : 'Card moved';
    case 'card_created':
      return cardTitle ? `Card created: ${cardTitle}` : 'Card created';
    case 'card_blocked':
      return cardTitle ? `Card blocked: ${cardTitle}` : 'Card blocked';
    case 'card_unblocked':
      return cardTitle ? `Card unblocked: ${cardTitle}` : 'Card unblocked';
    case 'card_assigned':
      return cardTitle ? `Card assigned: ${cardTitle}` : 'Card assigned';
    case 'checklist_item_updated': {
      if (itemTitle) {
        const completed = item?.is_completed === true;
        return completed ? `Checklist completed: ${itemTitle}` : `Checklist updated: ${itemTitle}`;
      }
      return 'Checklist updated';
    }
    case 'checklist_item_deleted':
      return 'Checklist item removed';
    case 'block_comment_added': {
      if (cardTitle && commentContent) {
        const preview = commentContent.length > 50 ? commentContent.slice(0, 50) + '…' : commentContent;
        return `Comment on ${cardTitle}: ${preview}`;
      }
      return cardTitle ? `Comment added to ${cardTitle}` : 'Comment added';
    }
    default:
      return null;
  }
}

const CollaborationToast: Component = () => {
  const [toasts, setToasts] = createSignal<ToastItem[]>([]);

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail) return;

    const message = describeEvent(detail);
    if (!message) return;

    const id = ++nextId;
    setToasts((prev) => [...prev.slice(-2), { id, message, visible: true }]);

    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: false } : t)),
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, TOAST_DURATION_MS);
  };

  window.addEventListener('kanbrio:board:event', handler);
  onCleanup(() => window.removeEventListener('kanbrio:board:event', handler));

  const dismiss = (id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  return (
    <div
      class="fixed bottom-16 left-4 z-50 flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Real-time board updates"
    >
      <For each={toasts()}>
        {(item) => (
          <Show when={item.visible || true}>
            <div
              class="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border border-base/50 shadow-sm bg-surface/95 backdrop-blur-sm text-xs font-medium text-primary max-w-xs transition-all duration-300 animate-in fade-in slide-in-from-left"
              classList={{
                'opacity-0 translate-x-[-8px]': !item.visible,
              }}
            >
              <span class="flex-1 truncate">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                class="text-tertiary hover:text-primary transition-colors shrink-0 ml-1"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </Show>
        )}
      </For>
    </div>
  );
};

export default CollaborationToast;
