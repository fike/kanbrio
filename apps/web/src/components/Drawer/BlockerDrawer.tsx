import { type Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { fetchBlockComments, createBlockComment } from '../../api/board';
import { X, Send, AlertTriangle } from 'lucide-solid';

export interface BlockerDrawerProps {
  workspaceId: string;
  cardId: string;
  cardTitle: string;
  blockedAt?: string | null;
  blockedBy?: string | null;
  blockerReason?: string | null;
  onClose: () => void;
}

const BlockerDrawer: Component<BlockerDrawerProps> = (props) => {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = createSignal('');
  let drawerEl!: HTMLDivElement;
  let inputEl!: HTMLTextAreaElement;
  let closeButtonEl!: HTMLButtonElement;

  const previousActiveElement = document.activeElement as HTMLElement;

  // Query block comments using TanStack Query
  const commentsQuery = createQuery(() => ({
    queryKey: ['block-comments', props.cardId],
    queryFn: () => fetchBlockComments(props.workspaceId, props.cardId),
    enabled: !!props.cardId,
  }));

  // Mutation to add block comments
  const addCommentMutation = createMutation(() => ({
    mutationFn: (content: string) => createBlockComment(props.workspaceId, props.cardId, content),
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['block-comments', props.cardId] });
    },
  }));

  // Calculate elapsed time (e.g., "5 mins ago", "2 hours ago", "3 days ago")
  const getElapsedTime = () => {
    if (!props.blockedAt) return 'Unknown time';
    const blockedTime = new Date(props.blockedAt).getTime();
    const now = Date.now();
    const diffMs = now - blockedTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = drawerEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  };

  onMount(() => {
    // Focus close button initially
    closeButtonEl?.focus();

    // Setup global key listener for Escape and Tab trap
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      // Focus back the original badge element or card
      previousActiveElement.focus();
    }
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const content = newComment().trim();
    if (content) {
      addCommentMutation.mutate(content);
    }
  };

  return (
    <div
      ref={drawerEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocker-drawer-title"
      data-testid="blocker-detail-drawer"
      class="fixed inset-y-0 right-0 w-[400px] bg-surface shadow-2xl border-l border-base z-50 flex flex-col animate-in slide-in-from-right duration-300"
    >
      {/* Header */}
      <div class="flex justify-between items-center p-4 border-b border-base bg-elevated/20">
        <div class="flex items-center gap-2">
          <AlertTriangle class="text-status-blocked shrink-0" size={18} />
          <h2 id="blocker-drawer-title" class="text-sm font-bold uppercase tracking-widest text-primary">
            Card Blocked Details
          </h2>
        </div>
        <button
          ref={closeButtonEl}
          onClick={() => props.onClose()}
          class="p-1 rounded-full hover:bg-base/50 text-secondary hover:text-primary transition-colors focus:ring-2 focus:ring-accent-primary focus:outline-none"
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Urgency Banner */}
      <div
        data-testid="blocker-drawer-banner"
        class="bg-status-blocked/10 border-b border-status-blocked/20 p-4 flex flex-col gap-1 shrink-0"
      >
        <div class="text-xs font-semibold text-status-blocked uppercase tracking-wider flex items-center justify-between">
          <span>URGENT: BLOCKED STATE</span>
          <span class="font-mono text-[10px]">{getElapsedTime()}</span>
        </div>
        <p class="text-xs text-primary font-medium mt-1">
          Reason: <span class="italic text-secondary">"{props.blockerReason || 'No reason provided'}"</span>
        </p>
        <Show when={props.blockedBy}>
          <div class="text-[10px] text-tertiary mt-0.5">
            Blocked by User UUID: <span class="font-mono">{props.blockedBy}</span>
          </div>
        </Show>
      </div>

      {/* Card Info Summary */}
      <div class="p-4 border-b border-base bg-elevated/5 shrink-0">
        <span class="text-[10px] uppercase font-bold text-tertiary">Context Card</span>
        <h3 class="text-sm font-semibold text-primary mt-0.5 leading-tight">{props.cardTitle}</h3>
      </div>

      {/* Block Comments Thread */}
      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <span class="text-[10px] uppercase font-bold text-tertiary mb-1">Discussion Thread</span>

        <Show when={commentsQuery.isLoading}>
          <div class="text-center text-xs text-secondary animate-pulse py-8">
            Loading comments thread...
          </div>
        </Show>

        <Show when={commentsQuery.isError}>
          <div class="text-center text-xs text-status-blocked py-8">
            Error loading discussion thread.
          </div>
        </Show>

        <Show when={commentsQuery.isSuccess}>
          <div data-testid="block-comments-container" class="flex flex-col gap-3">
            <Show
              when={commentsQuery.data && commentsQuery.data.length > 0}
              fallback={
                <div class="text-center py-8 text-xs text-tertiary border border-dashed border-base rounded-md">
                  No discussion comments yet. Start the coordination thread below.
                </div>
              }
            >
              <For each={commentsQuery.data}>
                {(comment) => (
                  <div class="flex flex-col gap-1 p-3 bg-elevated/30 border border-base rounded-md">
                    <div class="flex justify-between items-center text-[10px] text-tertiary">
                      <span class="font-semibold text-secondary truncate max-w-[150px]">
                        User {comment.user_id.split('-')[0]}
                      </span>
                      <span>{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p class="text-xs text-primary leading-normal whitespace-pre-wrap">{comment.content}</p>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>

      {/* Comment Input Box */}
      <div class="p-4 border-t border-base bg-elevated/10 shrink-0">
        <form onSubmit={handleSubmit} class="flex flex-col gap-2">
          <label for="blocker-comment-input" class="sr-only">Add comment</label>
          <textarea
            id="blocker-comment-input"
            ref={inputEl}
            rows="2"
            placeholder="Add to discussion thread..."
            value={newComment()}
            onInput={(e) => setNewComment(e.currentTarget.value)}
            class="w-full text-xs p-2 bg-surface border border-base rounded-md resize-none focus:ring-2 focus:ring-accent-primary focus:outline-none placeholder:text-tertiary"
          />
          <div class="flex justify-end">
            <button
              type="submit"
              disabled={!newComment().trim() || addCommentMutation.isPending}
              class="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary text-white text-xs font-semibold rounded-md hover:bg-accent-primary/95 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-accent-primary focus:outline-none"
            >
              <Send size={10} />
              <span>Comment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlockerDrawer;
