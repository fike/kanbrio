# Mini-PRD: Real-time Sync with WebSockets (Issue #33)

**Status**: Phase 3 — Mini-PRD & API Contracts | **Version**: 0.8 | **Date**: 2025-07-09
**Authors**: @product-manager
**Depends On**: Phase 1 (Discovery — `docs/product/websocket_sync_strategy.md`), Phase 2 (UX Design)

---

## Table of Contents

1. [WebSocket Protocol Specification](#1-websocket-protocol-specification)
2. [REST Fallback (Degraded Mode)](#2-rest-fallback-degraded-mode)
3. [API Contracts](#3-api-contracts)
4. [Backend Component Breakdown](#4-backend-component-breakdown)
5. [Frontend Component Breakdown](#5-frontend-component-breakdown)
6. [Refined Acceptance Criteria](#6-refined-acceptance-criteria)
7. [Risk Register](#7-risk-register)

---

## 1. WebSocket Protocol Specification

### 1.1 Direction Model

| Direction | Purpose | Messages |
|-----------|---------|----------|
| **Server → Client** | Real-time board event broadcast (unidirectional for this release) | `BoardEvent` variants |
| **Client → Server** | Connection lifecycle only (ping/pong, close frames) | WebSocket protocol frames |

> **Rationale**: Client-to-server WebSocket commands (e.g., presence heartbeats) are explicitly out of scope. All mutations use existing REST endpoints, which then publish to the broadcast channel.

### 1.2 JSON Envelope — Server → Client

Every message on the wire is a **raw JSON object** (no outer envelope). The `type` field discriminates the event. This matches the existing `BoardEvent` serde-tagged enum.

#### Message Types

| `type` | Variant | Payload | Description |
|--------|---------|---------|-------------|
| `card_created` | `CardCreated` | `{ card: Card }` | New card added to workspace |
| `card_moved` | `CardMoved` | `{ card: Card }` | Card changed column and/or swimlane |
| `card_blocked` | `CardBlocked` | `{ card: Card }` | Card marked as blocked |
| `card_unblocked` | `CardUnblocked` | `{ card: Card }` | Card unblocked |
| `card_assigned` | `CardAssigned` | `{ card: Card }` | Card assignee changed |
| `checklist_item_updated` | `ChecklistItemUpdated` | `{ item: ChecklistItem }` | Checklist item created, toggled, or edited |
| `checklist_item_deleted` | `ChecklistItemDeleted` | `{ card_id: UUID, checklist_id: UUID }` | Checklist item removed |
| `block_comment_added` | `BlockCommentAdded` | `{ comment: BlockComment }` | Comment added to a blocked card |
| `user_joined` | `UserJoined` | `{ user_id: UUID, username: string }` | User established WS connection |
| `user_left` | `UserLeft` | `{ user_id: UUID }` | User closed WS connection |

#### Full Payload Schemas

```jsonc
// Card object (matches existing models/card::Card)
{
  "type": "card_moved",
  "card": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "parent_id": null,
    "workspace_id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "Implement login",
    "current_column_id": "550e8400-e29b-41d4-a716-446655440010",
    "current_swimlane_id": "550e8400-e29b-41d4-a716-446655440020",
    "assigned_user_id": "550e8400-e29b-41d4-a716-446655440030",
    "is_blocked": false,
    "blocked_by": null,
    "blocked_at": null,
    "blocked_reason": null,
    "is_archived": false,
    "deleted_at": null,
    "created_at": "2025-07-01T10:00:00Z",
    "updated_at": "2025-07-09T14:30:00Z"
  }
}

// UserJoined event
{
  "type": "user_joined",
  "user_id": "550e8400-e29b-41d4-a716-446655440030",
  "username": "Alice"
}

// UserLeft event
{
  "type": "user_left",
  "user_id": "550e8400-e29b-41d4-a716-446655440030"
}

// ChecklistItemUpdated event
{
  "type": "checklist_item_updated",
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "card_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Write tests",
    "is_completed": true,
    "position": 1,
    "completed_by": "550e8400-e29b-41d4-a716-446655440030",
    "completed_at": "2025-07-09T14:30:00Z",
    "created_at": "2025-07-01T10:00:00Z",
    "updated_at": "2025-07-09T14:30:00Z"
  }
}

// ChecklistItemDeleted event
{
  "type": "checklist_item_deleted",
  "card_id": "550e8400-e29b-41d4-a716-446655440000",
  "checklist_id": "550e8400-e29b-41d4-a716-446655440040"
}

// BlockCommentAdded event
{
  "type": "block_comment_added",
  "comment": {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "card_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "550e8400-e29b-41d4-a716-446655440030",
    "content": "Waiting on API changes",
    "created_at": "2025-07-09T14:30:00Z",
    "updated_at": "2025-07-09T14:30:00Z"
  }
}
```

### 1.3 Client → Server Frames

Only standard WebSocket protocol frames are expected from the client:

| Frame | Purpose |
|-------|---------|
| `Ping` | Sent by server periodically (30s interval). Client must respond with `Pong`. |
| `Pong` | Client response to server `Ping`. Used for liveness detection. |
| `Close` | Graceful connection teardown. Server responds with matching `Close`. |
| `Text` | Ignored (reserved for future client→server commands). |

### 1.4 Connection Lifecycle

```
┌──────────────┐         ┌──────────────┐
│   Client     │         │   Server     │
└──────┬───────┘         └──────┬───────┘
       │ GET /ws/workspaces/:id │
       │  Upgrade: websocket    │  ──► HTTP 101 Switching Protocols
       │                        │
       │                        │  ──► Broadcast UserJoined event
       │  ◄── BoardEvent ───    │  (to all other subscribers)
       │  ◄── BoardEvent ───    │
       │  ...                   │
       │                        │  ──► Ping (30s interval)
       │  Pong ──►              │
       │                        │
       │  Close ──►             │  (client tab close / nav away)
       │                        │  ──► Broadcast UserLeft event
```

---

## 2. REST Fallback (Degraded Mode)

### 2.1 Existing Endpoint (No Changes Required)

The fallback mechanism leverages the **existing REST endpoint** — no new endpoint is needed:

```
GET /api/workspaces/:workspace_id/board
```

**Response**: Full `BoardState` object (columns, swimlanes, cards, checklists, transition_rules).

### 2.2 Fallback Triggers

The frontend triggers a full-state refetch via TanStack Query invalidation in these scenarios:

| Trigger | Action |
|---------|--------|
| WebSocket connection lost | Invalidate `['board', workspaceId]` query → auto-refetch |
| WebSocket reconnects successfully | Invalidate query once → ensures state is current |
| `Lagged(n)` event received on broadcast receiver | Invalidate query → recover missed events |
| Component mounts (initial load) | Standard TanStack Query fetch |

### 2.3 No Polling

> **Explicit decision**: There is **no periodic polling endpoint**. The only HTTP sync is on-demand refetch triggered by WS disconnection or component lifecycle. This eliminates the ~5s polling interval entirely.

---

## 3. API Contracts

### 3.1 WebSocket Upgrade

**Request**

```
GET /ws/workspaces/:workspace_id
Host: api.kanbrio.com
Cookie: __Host-sid=<session_token>
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Key: <base64-random>
Sec-WebSocket-Version: 13
```

**Successful Upgrade (101 Switching Protocols)**

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: <computed-key>
```

**Auth Failures**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| `401 Unauthorized` | Missing `Cookie` header, invalid/expired session token | `{ "error": "No active session" }` |
| `403 Forbidden` | Valid session but user is not a member of the workspace | `{ "error": "Forbidden" }` |

### 3.2 Heartbeat (Ping/Pong)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ping interval | 30 seconds | Server initiates via Axum `ws::Message::Ping` |
| Pong timeout | 20 seconds | If no `Pong` received, server closes connection |
| Implementation | Axum WS protocol handles ping/pong at transport level | The server-side `handle_ws_connection` already responds to incoming `Ping` frames; we add an outgoing ping loop |

> **Note**: The current code responds to client-initiated `Ping` frames. For robust liveness detection, the server must also **initiate** pings. This is a Phase 4 implementation task.

### 3.3 Subscription Scope

| Dimension | Value |
|-----------|-------|
| **Scope** | Workspace-level (all boards within a workspace share the same event channel) |
| **Channel key** | `workspace_id` (UUID path parameter) |
| **Isolation** | Events from one workspace are never delivered to subscribers of another workspace |
| **Broadcast model** | `tokio::sync::broadcast::channel(capacity=64)` — fire-and-forget, no per-subscriber acknowledgment |
| **Channel creation** | Lazy — channel is created on first `subscribe()` call |
| **Channel cleanup** | Periodic sweep (every 60s) removes channels with zero receivers |

### 3.4 Rate Limits (Future)

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max connections per user | 10 | Prevents abuse (one per tab, realistic limit) |
| Max connections per workspace | 100 | Prevents broadcast spam on large teams |
| Message rate (publish) | No limit (backed by broadcast channel capacity) | 64-event burst buffer is sufficient |

> **Implementation note**: Rate limits are not enforced in this release but the architecture should accommodate them (connection count tracking in `HubInner`).

---

## 4. Backend Component Breakdown

### 4.1 Module: `websocket.rs`

#### 4.1.1 Fix: `WorkspaceHub` / `HubInner` Alias

**Problem**: The current code has two structs:
- `WorkspaceHub` — declared but **unimplemented** (references non-existent `broadcast::Map` type). No `new()` method.
- `HubInner` — fully implemented with `publish()`, `subscribe()`, `start_sweep_task()`.
- `lib.rs` calls `WorkspaceHub::new()` → **will not compile**.

**Fix**: Alias `WorkspaceHub` to `HubInner` and remove the broken `WorkspaceHub` struct.

```rust
// websocket.rs — NEW
pub type WorkspaceHub = HubInner;

impl HubInner {
    // Keep existing methods: new(), sender(), publish(), subscribe(),
    // subscriber_count(), start_sweep_task()
}
```

#### 4.1.2 Component: `BoardEvent` (enum)

```rust
// Already exists — no changes needed to the enum itself
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BoardEvent {
    CardCreated { card: Card },
    CardMoved { card: Card },
    CardBlocked { card: Card },
    CardUnblocked { card: Card },
    CardAssigned { card: Card },
    ChecklistItemUpdated { item: ChecklistItem },
    ChecklistItemDeleted { card_id: Uuid, checklist_id: Uuid },
    BlockCommentAdded { comment: BlockComment },
    UserJoined { user_id: Uuid, username: String },
    UserLeft { user_id: Uuid },
}
```

#### 4.1.3 Component: `HubInner` (struct)

```rust
#[derive(Clone)]
pub struct HubInner {
    channels: Arc<tokio::sync::Mutex<HashMap<Uuid, broadcast::Sender<BoardEvent>>>>,
}

// Public API
impl HubInner {
    /// Create a new empty hub.
    pub fn new() -> Self;

    /// Publish a board event to all subscribers of the given workspace.
    /// Fire-and-forget; silently ignores publish errors if no subscribers exist.
    pub async fn publish(&self, workspace_id: Uuid, event: BoardEvent);

    /// Subscribe to events for a workspace. Creates the channel if missing.
    pub async fn subscribe(&self, workspace_id: Uuid) -> broadcast::Receiver<BoardEvent>;

    /// Return the current number of active subscribers for a workspace.
    pub async fn subscriber_count(&self, workspace_id: Uuid) -> usize;

    /// Start a background task that periodically sweeps stale channels.
    /// Detaches and runs forever.
    pub async fn start_sweep_task(self);
}
```

#### 4.1.4 Component: `ws_upgrade` (handler)

```rust
/// WebSocket upgrade handler.
/// Route: GET /ws/workspaces/:workspace_id
/// Auth: Cookie-based (`__Host-sid`), workspace membership required.
/// Returns: HTTP 101 on success, 401 on auth failure, 403 on membership failure.
pub async fn ws_upgrade(
    ws: WsUpgrade,
    headers: axum::http::header::HeaderMap,
    ws_hub: State<Arc<WorkspaceHub>>,
    pool: State<PgPool>,
    Path(workspace_id): Path<Uuid>,
) -> impl IntoResponse;
```

#### 4.1.5 Component: `handle_ws_connection` (background task)

```rust
/// Background task spawned on successful WS upgrade.
/// Manages the bidirectional connection lifecycle:
/// - Announces UserJoined on connect
/// - Subscribes to workspace broadcast channel
/// - Forwards BoardEvents to the client as Text frames
/// - Handles Ping/Pong for liveness
/// - Announces UserLeft on disconnect
/// - Handles broadcast::RecvError::Lagged by logging (client recovers via REST)
async fn handle_ws_connection(
    socket: WebSocket,
    hub: Arc<HubInner>,
    workspace_id: Uuid,
    user: User,
    username: String,
);
```

#### 4.1.6 Component: `authenticate_ws` (helper)

```rust
/// Authenticate WebSocket connection using the same cookie-based session auth
/// as REST endpoints. Verifies workspace membership.
/// Returns: (User, is_member) tuple.
async fn authenticate_ws(
    pool: &PgPool,
    headers: &axum::http::header::HeaderMap,
    workspace_id: Uuid,
) -> Result<(User, bool), StatusCode>;
```

### 4.2 Module: `handlers/board.rs`

All existing board mutation handlers already publish `BoardEvent` to the WS hub. No changes needed to these handlers:

| Handler | WS Event Published |
|---------|-------------------|
| `create_card` | `BoardEvent::CardCreated` |
| `move_card` | `BoardEvent::CardMoved` |
| `block_card` | `BoardEvent::CardBlocked` |
| `unblock_card` | `BoardEvent::CardUnblocked` |
| `assign_card` | `BoardEvent::CardAssigned` |
| `create_checklist_item` | `BoardEvent::ChecklistItemUpdated` |
| `update_checklist_item` | `BoardEvent::ChecklistItemUpdated` |
| `delete_checklist_item` | `BoardEvent::ChecklistItemDeleted` |
| `create_block_comment` | `BoardEvent::BlockCommentAdded` |

### 4.3 Module: `lib.rs`

The `AppState` struct already includes `ws_hub: Arc<WorkspaceHub>`. Once the alias fix is applied, `create_app()` will work correctly.

### 4.4 Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `CHANNEL_CAPACITY` | 64 | `websocket.rs` | Broadcast channel buffer size per workspace |
| `SWEEP_INTERVAL_SECS` | 60 | `websocket.rs` | Interval for stale channel cleanup |
| PING_INTERVAL (NEW) | 30s | `handle_ws_connection` | Server-initiated ping interval |
| PONG_TIMEOUT (NEW) | 20s | `handle_ws_connection` | Max wait for pong response before close |

---

## 5. Frontend Component Breakdown

### 5.1 Module: `src/api/websocket.ts`

New file — WebSocket client logic and TanStack Query integration.

#### 5.1.1 Type: `BoardEvent` (union type)

```typescript
// src/api/websocket.ts

export type CardData = {
  id: string;
  parent_id: string | null;
  workspace_id: string;
  title: string;
  current_column_id: string;
  current_swimlane_id: string;
  assigned_user_id: string | null;
  is_blocked: boolean;
  blocked_by: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlockComment = {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

// Union type matching server BoardEvent enum
export type BoardEvent =
  | { type: 'card_created'; card: CardData }
  | { type: 'card_moved'; card: CardData }
  | { type: 'card_blocked'; card: CardData }
  | { type: 'card_unblocked'; card: CardData }
  | { type: 'card_assigned'; card: CardData }
  | { type: 'checklist_item_updated'; item: ChecklistItem }
  | { type: 'checklist_item_deleted'; card_id: string; checklist_id: string }
  | { type: 'block_comment_added'; comment: BlockComment }
  | { type: 'user_joined'; user_id: string; username: string }
  | { type: 'user_left'; user_id: string };
```

#### 5.1.2 Enum: `WebSocketReadyState`

```typescript
export type WSConnectionState =
  | { status: 'connected' }
  | { status: 'connecting' }
  | { status: 'disconnected'; reason?: string }
  | { status: 'reconnecting'; attempt: number };
```

### 5.2 Hook: `useWorkspaceWebSocket`

```typescript
// src/hooks/useWorkspaceWebSocket.ts

export interface UseWorkspaceWebSocketOptions {
  /** Workspace ID to subscribe to */
  workspaceId: string;
  /** Callback invoked for each incoming BoardEvent */
  onEvent?: (event: BoardEvent) => void;
  /** Callback invoked when connection state changes */
  onStateChange?: (state: WSConnectionState) => void;
}

export function useWorkspaceWebSocket(options: UseWorkspaceWebSocketOptions): {
  connectionState: WSConnectionState;
  reconnectAttempts: number;
  manualReconnect: () => void;
  disconnect: () => void;
};
```

**Implementation responsibilities**:
1. Construct WebSocket URL: `ws[s]://host/ws/workspaces/${workspaceId}`
2. Open connection on mount (automatic, cookie sent via `withCredentials`)
3. Parse incoming text messages as `BoardEvent`
4. Dispatch events to `onEvent` callback
5. On disconnect: enter `reconnecting` state with exponential backoff (1s → 2s → 4s → 8s → 15s → 30s max)
6. On reconnection: reset attempt counter
7. On `maxRetries` (15 attempts ≈ 4.5 minutes): enter `disconnected` state

**Reconnection backoff schedule**:

| Attempt | Delay (seconds) |
|---------|----------------|
| 1 | 1 |
| 2 | 2 |
| 3 | 4 |
| 4 | 8 |
| 5+ | 15 (capped at 30s) |

### 5.3 Component: `<ConnectionStatus>`

```tsx
// src/components/ConnectionStatus.tsx

export interface ConnectionStatusProps {
  connectionState: WSConnectionState;
}

export function ConnectionStatus(props: ConnectionStatusProps): void;
```

**Visual specification** (from Phase 2 UX Design):

| State | Visual | Design Token | Behavior |
|-------|--------|-------------|----------|
| `connected` | Green dot, 8px diameter | `--color-status-done` (via Tailwind `status-done`) | No animation, no text |
| `connecting` | Orange pulsing dot, 8px | `--color-status-doing` (via Tailwind `status-doing`) | `animate-pulse`, duration `--kanbrio-duration-fast` (200ms) |
| `disconnected` | Red dot, 8px + "Offline" text | `--color-status-blocked` (via Tailwind `status-blocked`) | Shows reconnect timer if applicable |
| `reconnecting` | Orange pulsing dot + "Reconnecting… (${n})" text | `--color-status-doing` | `animate-pulse`, shows attempt count |

**Placement**: Fixed bottom-left corner of the viewport (over the board area), z-index 40.

**Accessibility**:
- `aria-live="polite"` on the status region for screen reader announcements
- Screen reader-only text: "Connection status: connected" / "Connection status: reconnecting, attempt 3" / "Connection status: offline"

### 5.4 Component: `<CollaborationToast>`

```tsx
// src/components/CollaborationToast.tsx

export interface CollaborationToastProps {
  message: string;
  visible: boolean;
  onDismiss?: () => void;
}

export function CollaborationToast(props: CollaborationToastProps): void;
```

**Visual specification**:
- Position: bottom-left (below `ConnectionStatus`), z-index 50
- Content: e.g., "Alice moved 'Implement login' to In Progress"
- Duration: auto-dismiss after 4000ms
- Styling: subtle, non-intrusive (similar to existing rule-violation toast but less alarming)
- Dismissible: `Escape` key or click

**Accessibility**:
- `role="status"` for screen readers
- `aria-live="polite"` — events are informational, not urgent
- Toast text is keyboard-focusable for screen reader navigation

### 5.5 Integration: Board Component (`Board.tsx`)

**Changes to `Board.tsx`**:

1. **Import WS hook**: `import { useWorkspaceWebSocket } from '../hooks/useWorkspaceWebSocket';`
2. **Subscribe to events**: Wire `useWorkspaceWebSocket({ workspaceId, onEvent })`
3. **Event handlers**: For each relevant `BoardEvent` type, update the TanStack Query cache optimistically:
   - `card_moved` → update card position in cache
   - `card_blocked` / `card_unblocked` → update `is_blocked` in cache
   - `card_assigned` → update `assigned_user_id` in cache
   - `checklist_item_updated` / `checklist_item_deleted` → update checklists in cache
4. **Lagged-event handling**: If the broadcast receiver reports `Lagged(n)`, call `queryClient.invalidateQueries({ queryKey: ['board', workspaceId] })` to trigger full refetch
5. **Presence tracking**: Maintain a `Set<string>` of active user IDs (union of `user_joined` minus `user_left` events)

```typescript
// Event → TanStack Query cache update pattern
const handleBoardEvent = (event: BoardEvent) => {
  switch (event.type) {
    case 'card_moved':
    case 'card_blocked':
    case 'card_unblocked':
    case 'card_assigned':
      queryClient.setQueryData<BoardState>(['board', workspaceId], (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map(c => c.id === event.card.id ? event.card : c),
        };
      });
      break;
    case 'card_created':
      queryClient.setQueryData<BoardState>(['board', workspaceId], (old) => {
        if (!old) return old;
        return { ...old, cards: [...old.cards, event.card] };
      });
      break;
    case 'checklist_item_updated':
      // update checklists array
      break;
    case 'checklist_item_deleted':
      // remove from checklists array
      break;
    // user_joined / user_left handled by presence tracking
  }
};
```

### 5.6 Component Tree

```
WorkspaceLayout (App.tsx)
├── ConnectionStatus       ← NEW (bottom-left, always visible)
├── Board                   ← MODIFIED (adds WS hook + event handling)
│   ├── CollaborationToast  ← NEW (bottom-left, below ConnectionStatus)
│   ├── ColumnHeader
│   ├── Swimlane
│   │   └── ColumnZone
│   │       └── Card
│   ├── CardHistory (sidebar)
│   └── BlockerDrawer
```

---

## 6. Refined Acceptance Criteria

### AC1: WebSocket endpoint at `/ws/workspaces/:workspace_id`

| # | Assertion | Type |
|---|-----------|------|
| AC1.1 | `GET /ws/workspaces/:workspace_id` with valid session cookie and workspace membership returns `HTTP 101 Switching Protocols` | Integration |
| AC1.2 | `GET /ws/workspaces/:workspace_id` without session cookie returns `HTTP 401` | Unit |
| AC1.3 | `GET /ws/workspaces/:workspace_id` with valid session but non-member user returns `HTTP 403` | Unit |
| AC1.4 | `GET /ws/workspaces/:invalid_uuid` returns `HTTP 422` (UUID parse failure) | Unit |
| AC1.5 | After upgrade, server immediately broadcasts `UserJoined` event to other subscribers | Integration |
| AC1.6 | On client close, server broadcasts `UserLeft` event to other subscribers | Integration |

### AC2: Real-time broadcast of card moves, status changes, and assignments

| # | Assertion | Type |
|---|-----------|------|
| AC2.1 | After `POST /api/workspaces/:id/cards/:card_id/move` succeeds, all other WS subscribers in the same workspace receive a `card_moved` event within 200ms | Integration |
| AC2.2 | After `POST /api/workspaces/:id/cards/:card_id/assign` succeeds, all other WS subscribers receive a `card_assigned` event within 200ms | Integration |
| AC2.3 | After `POST /api/workspaces/:id/cards/:card_id/block` succeeds, all other WS subscribers receive a `card_blocked` event | Integration |
| AC2.4 | After `POST /api/workspaces/:id/cards/:card_id/unblock` succeeds, all other WS subscribers receive a `card_unblocked` event | Integration |
| AC2.5 | Events are NOT delivered to subscribers of other workspaces (workspace isolation) | Integration |
| AC2.6 | The originating client (that performed the mutation) also receives the event via WS (no self-exclusion) | Integration |

### AC3: Connection management with automatic reconnection

| # | Assertion | Type |
|---|-----------|------|
| AC3.1 | When WS connection drops unexpectedly, the client enters `reconnecting` state and attempts reconnection with exponential backoff starting at 1s | Unit |
| AC3.2 | On successful reconnection, the client transitions to `connected` state and resets the attempt counter | Unit |
| AC3.3 | After 15 failed reconnection attempts, the client transitions to `disconnected` state | Unit |
| AC3.4 | On reconnect, the client invalidates the board query cache triggering a full `GET /board` refetch | Integration |
| AC3.5 | The `ConnectionStatus` component correctly displays each state: connected (green), connecting (orange pulse), reconnecting (orange + count), disconnected (red) | Unit |
| AC3.6 | The `ConnectionStatus` component has `aria-live="polite"` for screen reader announcements | Unit |

### AC4: Broadcast events: `card_moved`, `card_status_changed`, `card_assigned`

> **Note**: The issue's AC4 mentions `card_status_changed`, but the existing schema uses separate `card_blocked` / `card_unblocked` events. These serve the same purpose.

| # | Assertion | Type |
|---|-----------|------|
| AC4.1 | `BoardEvent::CardMoved` serializes to JSON with `type: "card_moved"` and full `card` payload | Unit |
| AC4.2 | `BoardEvent::CardBlocked` serializes to JSON with `type: "card_blocked"` and full `card` payload | Unit |
| AC4.3 | `BoardEvent::CardUnblocked` serializes to JSON with `type: "card_unblocked"` and full `card` payload | Unit |
| AC4.4 | `BoardEvent::CardAssigned` serializes to JSON with `type: "card_assigned"` and full `card` payload | Unit |
| AC4.5 | All additional event types serialize/deserialize correctly (round-trip test for each variant) | Unit |
| AC4.6 | The frontend `BoardEvent` TypeScript union type is exhaustive — `switch` on `event.type` requires all cases | Unit (TypeScript compiler) |

### AC5: Graceful offline handling (from US5 — Resilient Reconnection)

| # | Assertion | Type |
|---|-----------|------|
| AC5.1 | While in `disconnected` state, the board remains visible (last known state from cache) | Unit |
| AC5.2 | No JavaScript errors are thrown when events arrive while the TanStack Query cache is stale | Unit |
| AC5.3 | The `CollaborationToast` component auto-dismisses after 4000ms | Unit |
| AC5.4 | The `CollaborationToast` is dismissible via `Escape` key | Unit |

---

## 7. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R1 | **`WorkspaceHub` compilation failure** — The existing `WorkspaceHub` struct has no implementation (`broadcast::Map` type does not exist). `lib.rs` calls `WorkspaceHub::new()` which will not compile. | **Certain** | **Blocking** | Resolve immediately: alias `WorkspaceHub` → `HubInner`, remove broken struct. This is the first code change. |
| R2 | **Broadcast channel lag under burst load** — If many mutations happen simultaneously (e.g., admin bulk operations), the 64-event channel buffer may overflow, causing `Lagged(n)` errors. | Low | Medium | Channel capacity of 64 is sized for normal usage. `Lagged(n)` triggers full-state refetch, which is a safe recovery path. Monitor `Lagged` log frequency post-launch. |
| R3 | **In-memory hub does not survive server restart** — All broadcast channels are in-process. Server restart drops all connections and clears all channels. | Medium | Low | Acceptable for current single-instance deployment. Clients auto-reconnect. Multi-instance scaling via Redis pub/sub is a v1.x concern. |
| R4 | **Self-event echo causes redundant UI updates** — The client that triggers a mutation receives the WS event back. Combined with optimistic UI, this could cause a double-update. | Medium | Low | TanStack Query cache normalization makes updates idempotent. The cache update handler should check if the incoming event matches the current cached state before re-rendering. |
| R5 | **Browser WebSocket limitations** — Some corporate proxies/firewalls block WebSocket connections (wss://). Users behind such proxies will fall back to no real-time sync. | Low | Medium | Graceful degradation: the app works without WS (REST-only mode). The `ConnectionStatus` component shows `disconnected` state. Future: consider SSE fallback. |
| R6 | **Cookie not sent with WebSocket upgrade** — Browsers do not automatically send cookies with WebSocket connections in some cross-origin scenarios. | Low | High | Since the frontend and API share the same origin in production (same domain or configured via proxy), cookies are sent. For dev (localhost:5173 → localhost:3000), configure Vite proxy to preserve cookies. |
| R7 | **Multiple tabs open duplicate connections** — Each tab opens a separate WS connection, creating duplicate `UserJoined` events and doubling server load. | Certain | Low | Each tab's connection is independent and necessary for cross-tab sync. Server-side max-connections-per-user limit (10) prevents abuse. Presence UI deduplicates by `user_id`. |
| R8 | **Large board state payload** — Full `GET /board` refetch on reconnect may be slow for boards with 500+ cards (~500KB+). | Medium | Low | The REST endpoint already uses parallel async queries. Skeleton loading UI masks the delay. Future optimization: delta sync on rejoin. |

### Risk Priorities

| Priority | Risks | Action |
|----------|-------|--------|
| **P0 (Blocker)** | R1 | Fix during implementation (first change) |
| **P1 (Monitor)** | R4, R6 | Address in implementation; verify in testing |
| **P2 (Accept)** | R2, R3, R5, R7, R8 | Documented mitigation, monitor post-launch |

---

## Appendix A: File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `apps/api/src/websocket.rs` | **Modify** | Fix `WorkspaceHub` alias; add server-initiated ping loop with pong timeout |
| `apps/api/src/lib.rs` | **Modify** | No changes needed after alias fix |
| `apps/web/src/api/websocket.ts` | **New** | TypeScript types for `BoardEvent`, `WSConnectionState`; WS URL builder |
| `apps/web/src/hooks/useWorkspaceWebSocket.ts` | **New** | Solid.js hook: connection management, reconnection, event dispatch |
| `apps/web/src/components/ConnectionStatus.tsx` | **New** | Bottom-left connection indicator with 4 states |
| `apps/web/src/components/ConnectionStatus.test.tsx` | **New** | Unit tests for all 4 connection states |
| `apps/web/src/components/CollaborationToast.tsx` | **New** | Bottom-left toast for real-time event notifications |
| `apps/web/src/components/CollaborationToast.test.tsx` | **New** | Unit tests for auto-dismiss, Escape key, accessibility |
| `apps/web/src/components/Board/Board.tsx` | **Modify** | Integrate WS hook; add event → cache update handlers; add `ConnectionStatus` and `CollaborationToast` |
| `apps/web/vite.config.ts` | **Modify** | Ensure `credentials: 'include'` works for WS proxy in dev |
| `apps/api/tests/` | **New** | Integration tests for WS upgrade auth, event broadcasting, workspace isolation |

## Appendix B: Design Token Reference

| Token | Usage | CSS Variable / Tailwind Class |
|-------|-------|------------------------------|
| OK (green) | `connected` state dot | `--color-status-done` / `text-status-done` / `bg-status-done` |
| Warning (orange) | `connecting` / `reconnecting` state dot | `--color-status-doing` / `text-status-doing` / `bg-status-doing` |
| Error (red) | `disconnected` state dot | `--color-status-blocked` / `text-status-blocked` / `bg-status-blocked` |
| Fast duration | Pulse animation | `200ms` (use Tailwind `duration-micro` = 150ms or custom `duration-200`) |
| Normal duration | Toast slide-in/out | `300ms` (Tailwind `duration-standard`) |

---

*This concludes Phase 3: Mini-PRD & API Contracts for Issue #33 — Real-time Sync with WebSockets.*
