import { type Component, createSignal, onMount, onCleanup, Show, type Accessor } from 'solid-js';
import type { WSStatus } from '../hooks/useWebSocket';

/**
 * ConnectionStatus – a small indicator fixed at the bottom-left of the screen.
 *
 * States:
 *   connected    – green dot
 *   connecting   – orange pulsing dot
 *   disconnected – red dot
 *   reconnecting – orange pulsing dot + attempt counter
 *
 * Accessible: aria-live="polite", visually hidden status text.
 * Dismissible with Escape key.
 */

interface ConnectionStatusProps {
  status: Accessor<WSStatus>;
  reconnectCount: Accessor<number>;
}

const STATUS_LABELS: Record<WSStatus, string> = {
  connected: 'Connected to real-time sync',
  connecting: 'Connecting to real-time sync…',
  disconnected: 'Disconnected from real-time sync',
  reconnecting: 'Reconnecting to real-time sync…',
};

function statusColor(status: WSStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'connecting':
    case 'reconnecting':
      return 'bg-orange-500';
    case 'disconnected':
      return 'bg-red-500';
  }
}

function statusBorder(status: WSStatus): string {
  switch (status) {
    case 'connected':
      return 'border-green-200';
    case 'connecting':
    case 'reconnecting':
      return 'border-orange-200';
    case 'disconnected':
      return 'border-red-200';
  }
}

const ConnectionStatus: Component<ConnectionStatusProps> = (props) => {
  const [visible, setVisible] = createSignal(true);

  onMount(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setVisible(false);
      }
    }
    window.addEventListener('keydown', onKeydown);
    onCleanup(() => window.removeEventListener('keydown', onKeydown));
  });

  return (
    <Show when={visible()}>
      <div
        class="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm bg-surface/95 backdrop-blur-sm"
        classList={{
          [statusBorder(props.status())]: true,
          'transition-opacity duration-300': true,
        }}
        role="status"
      >
        {/* Status dot */}
        <span
          class={`w-2 h-2 rounded-full shrink-0 ${statusColor(props.status())}`}
          classList={{
            'animate-pulse': props.status() === 'connecting' || props.status() === 'reconnecting',
          }}
        />

        {/* Human-readable label */}
        <span class="text-xs font-medium text-secondary whitespace-nowrap">
          <Show when={props.status() === 'reconnecting'} fallback={STATUS_LABELS[props.status()]}>
            {STATUS_LABELS.reconnecting} ({props.reconnectCount()})
          </Show>
        </span>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => setVisible(false)}
          class="ml-1 text-[10px] text-tertiary hover:text-primary transition-colors"
          aria-label="Dismiss connection status"
        >
          ✕
        </button>
      </div>

      {/* Visually hidden live region for screen readers */}
      <div
        class="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {STATUS_LABELS[props.status()]}
        {props.status() === 'reconnecting'
          ? ` Attempt ${props.reconnectCount()}`
          : ''}
      </div>
    </Show>
  );
};

export default ConnectionStatus;
