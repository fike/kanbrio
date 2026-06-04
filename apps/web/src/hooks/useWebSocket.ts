import { createSignal, onMount, onCleanup, type Accessor } from 'solid-js';

export type WSStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface WebSocketState {
  status: Accessor<WSStatus>;
  reconnectCount: Accessor<number>;
  lastEvent: Accessor<unknown | null>;
}

/**
 * Exponential backoff parameters.
 */
const RECONNECT_CONFIG = {
  initialDelay: 1_000,   // 1s
  maxDelay: 30_000,       // 30s
  multiplier: 2,          // 1s -> 2s -> 4s -> 8s -> 16s -> 30s
  maxAttempts: 15,
};

const HEARTBEAT_INTERVAL_MS = 25_000; // ping every 25s
const HEARTBEAT_TIMEOUT_MS = 20_000;  // expect pong within 20s

/**
 * Get the WebSocket URL for the given workspace.
 */
function getWsUrl(workspaceId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_API_URL
    ? new URL(import.meta.env.VITE_API_URL).host
    : window.location.host;
  return `${proto}//${host}/ws/workspaces/${workspaceId}`;
}

/**
 * Hook: connect a WebSocket to the board event stream for a workspace.
 *
 * Dispatches `CustomEvent("kanbrio:board:event", { detail: event })` on the
 * `window` for every incoming JSON message so that any component can listen.
 */
export function useWebSocket(workspaceId: string): WebSocketState {
  const [status, setStatus] = createSignal<WSStatus>('disconnected');
  const [reconnectCount, setReconnectCount] = createSignal(0);
  const [lastEvent, setLastEvent] = createSignal<unknown | null>(null);

  onMount(() => {
    let socket: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let pongTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let isIntentionalClose = false;

    function clearTimers() {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    }

    function scheduleReconnect() {
      if (isIntentionalClose) return;
      if (attempt >= RECONNECT_CONFIG.maxAttempts) {
        setStatus('disconnected');
        return;
      }
      const delay = Math.min(
        RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.multiplier, attempt),
        RECONNECT_CONFIG.maxDelay,
      );
      attempt++;
      setStatus('reconnecting');
      setReconnectCount(attempt);

      reconnectTimer = setTimeout(() => {
        connect();
      }, delay);
    }

    function connect() {
      setStatus('connecting');
      try {
        socket = new WebSocket(getWsUrl(workspaceId));
      } catch {
        setStatus('disconnected');
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        attempt = 0;
        setReconnectCount(0);
        setStatus('connected');

        // Start heartbeat
        heartbeatTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
            // Expect pong within 20s
            pongTimeout = setTimeout(() => {
              if (socket?.readyState === WebSocket.OPEN) {
                socket.close(); // trigger reconnect
              }
            }, HEARTBEAT_TIMEOUT_MS);
          }
        }, HEARTBEAT_INTERVAL_MS);
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(data);

          // Dispatch as a custom event on window for any listener
          window.dispatchEvent(
            new CustomEvent('kanbrio:board:event', { detail: data }),
          );
        } catch {
          // Non-JSON message (e.g. ping/pong handled separately)
        }
      };

      socket.onclose = () => {
        clearTimers();
        if (isIntentionalClose) {
          setStatus('disconnected');
          return;
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        // onerror is always followed by onclose
      };
    }

    connect();

    onCleanup(() => {
      isIntentionalClose = true;
      clearTimers();
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
      socket = null;
      setStatus('disconnected');
    });
  });

  return { status, reconnectCount, lastEvent };
}
