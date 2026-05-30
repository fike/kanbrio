import { createSignal, createEffect, Show, onCleanup } from 'solid-js';
import { useAuth } from '../AuthProvider';

interface CreateWorkspaceModalProps {
  isOpen: () => boolean;
  onClose: () => void;
  triggerRef: () => HTMLButtonElement | undefined;
}

export function CreateWorkspaceModal(props: CreateWorkspaceModalProps) {
  const auth = useAuth();
  const [name, setName] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [shake, setShake] = createSignal(false);
  const [showToast, setShowToast] = createSignal(false);

  let modalRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let cancelButtonRef: HTMLButtonElement | undefined;
  let submitButtonRef: HTMLButtonElement | undefined;

  // 1. Focus input upon render/mount
  createEffect(() => {
    if (props.isOpen()) {
      setName('');
      setError(null);
      setLoading(false);
      setShake(false);
      setTimeout(() => {
        inputRef?.focus();
      }, 50);
    }
  });

  // 2. Keyboard listeners: Escape key dismisses the dialog
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen()) return;

    if (e.key === 'Escape') {
      handleClose();
      e.preventDefault();
    } else if (e.key === 'Tab') {
      // 3. Keyboard focus trap loop
      const focusableElements = [inputRef, cancelButtonRef, submitButtonRef].filter(Boolean) as HTMLElement[];
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

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

  const handleClose = () => {
    props.onClose();
    // Programmatically restore focus to the trigger button to prevent focus loss (a11y)
    const trigger = props.triggerRef();
    if (trigger) {
      setTimeout(() => {
        trigger.focus();
      }, 50);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();

    // Client-side sanitization and bounds check
    if (trimmed.length === 0) {
      triggerError('Workspace name must contain at least 1 non-whitespace character.');
      return;
    }
    if (trimmed.length > 50) {
      triggerError('Maximum allowed length is 50 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await auth.createWorkspace(trimmed);

      // Toast notification on success
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 3000);

      // Close the modal immediately on success
      props.onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      triggerError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const triggerError = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => {
      setShake(false);
    }, 300);
  };

  // Add keydown listener to window for Escape key handling
  createEffect(() => {
    if (props.isOpen()) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <>
      <Show when={props.isOpen()}>
        {/* Backdrop Fade In Overlay */}
        <div
          data-testid="workspace-backdrop-overlay"
          onClick={handleClose}
          class="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ease-in-out opacity-100"
        />

        {/* Modal Pop Scale-up Card Viewport Center */}
        <div
          ref={modalRef}
          data-testid="create-workspace-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-modal-title"
          class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 bg-surface border border-base rounded-lg shadow-2xl flex flex-col gap-4 transform transition-all duration-300 scale-100"
          classList={{ 'animate-shake': shake() }}
        >
          <div class="flex items-center justify-between">
            <h2 id="workspace-modal-title" class="text-lg font-bold text-primary">
              Create New Workspace
            </h2>
            <button
              onClick={handleClose}
              class="text-secondary hover:text-primary transition-colors text-lg font-semibold"
              aria-label="Close dialog"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="workspace-name" class="text-xs font-semibold text-secondary">
                Workspace Name
              </label>
              <input
                ref={inputRef}
                id="workspace-name"
                data-testid="workspace-name-input"
                type="text"
                placeholder="e.g. Acme Corp Software"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                disabled={loading()}
                aria-disabled={loading() ? 'true' : 'false'}
                class="w-full px-3 py-2 text-sm bg-elevated border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-primary"
                classList={{
                  'border-status-blocked ring-2 ring-status-blocked/20': error() !== null,
                  'border-base focus:border-accent-primary': error() === null,
                }}
              />
              <Show when={error()}>
                <span
                  data-testid="workspace-modal-error"
                  class="text-xs text-status-blocked font-medium"
                >
                  {error()}
                </span>
              </Show>
            </div>

            <div class="flex items-center justify-end gap-3 mt-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={handleClose}
                disabled={loading()}
                aria-disabled={loading() ? 'true' : 'false'}
                class="px-4 py-2 text-xs font-semibold text-secondary hover:bg-elevated rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                ref={submitButtonRef}
                type="submit"
                disabled={loading()}
                aria-disabled={loading() ? 'true' : 'false'}
                data-testid="workspace-modal-submit"
                class="px-4 py-2 text-xs font-semibold text-white bg-accent-primary hover:bg-accent-primary/95 rounded-md transition-all flex items-center gap-2"
              >
                <Show when={loading()}>
                  <div class="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                </Show>
                <span>{loading() ? 'Creating...' : 'Create Workspace'}</span>
              </button>
            </div>
          </form>
        </div>
      </Show>

      {/* WCAG Success Toast Notification */}
      <Show when={showToast()}>
        <div
          role="status"
          aria-live="polite"
          data-testid="workspace-success-toast"
          class="fixed bottom-4 right-4 z-50 bg-surface border-status-done border-l-4 shadow-xl p-4 rounded-md text-sm font-medium text-primary flex items-center gap-2 animate-fade-in"
        >
          <svg class="w-4 h-4 text-status-done" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>Workspace created successfully!</span>
        </div>
      </Show>
    </>
  );
}
