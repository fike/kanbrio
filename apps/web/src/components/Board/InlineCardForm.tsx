import { type Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { createCard, type CardData } from '../../api/board';

interface InlineCardFormProps {
  columnId: string;
  swimlaneId: string;
  workspaceId: string;
  onSuccess: (newCard: CardData) => void;
  onCancel: () => void;
  showToast: (message: string) => void;
}

export const InlineCardForm: Component<InlineCardFormProps> = (props) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isShaking, setIsShaking] = createSignal(false);

  let formContainerRef!: HTMLDivElement;
  let textareaRef!: HTMLTextAreaElement;
  let addBtnRef!: HTMLButtonElement;
  let cancelBtnRef!: HTMLButtonElement;

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isLoading()) return;

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift-Tab loop: Textarea -> Cancel -> Add -> Textarea
        if (document.activeElement === textareaRef) {
          e.preventDefault();
          cancelBtnRef.focus();
        } else if (document.activeElement === cancelBtnRef) {
          e.preventDefault();
          addBtnRef.focus();
        } else if (document.activeElement === addBtnRef) {
          e.preventDefault();
          textareaRef.focus();
        }
      } else {
        // Tab loop: Textarea -> Add -> Cancel -> Textarea
        if (document.activeElement === textareaRef) {
          e.preventDefault();
          addBtnRef.focus();
        } else if (document.activeElement === addBtnRef) {
          e.preventDefault();
          cancelBtnRef.focus();
        } else if (document.activeElement === cancelBtnRef) {
          e.preventDefault();
          textareaRef.focus();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      props.onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitForm();
    }
  };

  const clickOutside = (e: MouseEvent) => {
    if (isLoading()) return;
    if (formContainerRef && !formContainerRef.contains(e.target as Node)) {
      props.onCancel();
    }
  };

  onMount(() => {
    // Autofocus within 50ms
    setTimeout(() => {
      textareaRef?.focus();
    }, 20);

    // Register click-outside after current event loop to avoid immediate close
    setTimeout(() => {
      document.addEventListener('pointerdown', clickOutside);
    }, 0);
  });

  onCleanup(() => {
    document.removeEventListener('pointerdown', clickOutside);
  });

  const submitForm = async () => {
    if (isLoading()) return;

    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      setError('Card title cannot be empty.');
      triggerShake();
      return;
    }

    if (trimmedTitle.length > 255) {
      setError('Card title must be 255 characters or less.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newCard = await createCard(
        props.workspaceId,
        trimmedTitle,
        props.columnId,
        props.swimlaneId
      );
      // Invalidate board queries on success
      await queryClient.invalidateQueries({ queryKey: ['board', props.workspaceId] });
      props.onSuccess(newCard);
    } catch (err: unknown) {
      setIsLoading(false);
      triggerShake();

      let errorMessage = 'Failed to create card';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      // On server errors (like WIP limit breach), also show the bottom-right toast
      props.showToast(errorMessage);
    }
  };

  return (
    <div
      ref={formContainerRef}
      onKeyDown={handleKeyDown}
      class="p-3 bg-surface border rounded-lg shadow-sm flex flex-col gap-2 transition-all duration-300 ease-standard"
      classList={{
        'border-base': !error(),
        'border-status-blocked bg-status-blocked/5': !!error(),
        'animate-shake': isShaking(),
        'opacity-60 cursor-not-allowed select-none bg-elevated/50': isLoading(),
      }}
      data-testid={`inline-card-form-${props.columnId}-${props.swimlaneId}`}
      role="form"
      aria-label="Add new card"
    >
      <Show when={error()}>
        <div
          class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start"
          data-testid="inline-card-error"
          role="alert"
        >
          <svg class="w-4 h-4 text-status-blocked flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1 flex flex-col gap-0.5 text-left">
            <span class="font-semibold">Validation Error</span>
            <span>{error()}</span>
          </div>
        </div>
      </Show>

      <textarea
        ref={textareaRef}
        value={title()}
        onInput={(e) => setTitle(e.currentTarget.value)}
        class="w-full px-3 py-2 text-sm bg-surface border rounded-md focus:outline-none transition-all placeholder:text-tertiary resize-none"
        classList={{
          'border-base text-primary focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20': !error() && !isLoading(),
          'border-status-blocked/50 focus:border-status-blocked focus:ring-2 focus:ring-status-blocked/20 text-status-blocked placeholder:text-status-blocked/40': !!error() && !isLoading(),
          'bg-elevated/50 border-base text-secondary cursor-not-allowed': isLoading(),
        }}
        data-testid="inline-card-title-input"
        placeholder="Enter a title for this card..."
        rows="2"
        disabled={isLoading()}
        aria-disabled={isLoading() ? 'true' : 'false'}
        aria-invalid={error() ? 'true' : 'false'}
        aria-required="true"
      />

      <div class="flex items-center justify-end gap-2">
        <button
          ref={cancelBtnRef}
          type="button"
          onClick={() => props.onCancel()}
          class="text-secondary font-semibold px-3 py-1 rounded-md text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
          classList={{
            'hover:bg-elevated': !isLoading(),
            'cursor-not-allowed opacity-50': isLoading(),
          }}
          data-testid="inline-card-cancel"
          disabled={isLoading()}
          aria-disabled={isLoading() ? 'true' : 'false'}
          role="button"
        >
          Cancel
        </button>
        <button
          ref={addBtnRef}
          type="button"
          onClick={submitForm}
          class="bg-accent-primary text-white font-semibold py-1 px-3 rounded-md text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center gap-1.5 justify-center"
          classList={{
            'hover:bg-accent-primary/95': !isLoading(),
            'cursor-not-allowed': isLoading(),
          }}
          data-testid="inline-card-submit"
          disabled={isLoading()}
          aria-disabled={isLoading() ? 'true' : 'false'}
          role="button"
        >
          <Show when={isLoading()}>
            <svg class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true" />
            <span>Adding...</span>
          </Show>
          <Show when={!isLoading()}>
            <span>Add</span>
          </Show>
        </button>
      </div>
    </div>
  );
};
