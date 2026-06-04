# Product Discovery: Real-time Sync with WebSockets (Issue #33)

**Status**: Phase 1 — Discovery | **Version**: 0.8 | **Date**: 2025-07-09
**Authors**: @product-manager
**Strategic Alignment**: Flow Efficiency, Collaborative Awareness, Cycle 2 "Actionable Board"

---

> [!NOTE]
> This document details the product requirements, JTBD analysis, edge-case considerations, and success metrics for implementing **WebSocket-based real-time sync** in Kanbrio. The backend already has a partially-implemented WebSocket hub and event types, but the frontend has no WebSocket client connected. The goal of this feature is to close the gap and make real-time sync the default mechanism for board state propagation, replacing HTTP polling.

---

## 👥 Part 1: Jobs-to-be-Done (JTBD) Analysis

### 1.1 The Core Job

> **"When multiple people are collaborating on a Kanban board, I want changes made by anyone on the team to appear on my screen instantly, so I can coordinate work without stale or outdated information."**

This is not a "nice-to-have" — it is table stakes for any collaborative board tool. The entire value proposition of Kanbrio as a team tool evaporates if each person sees a different snapshot of reality.

### 1.2 Current Alternative: HTTP Polling (~5s interval)

| Pain Point | Impact |
| :--- | :--- |
| **Stale state** — cards moved, blocked, or assigned by others don't appear for up to 5 seconds | Users may attempt conflicting edits (e.g., two people moving the same card) or miss blocker status updates |
| **Unnecessary network overhead** — every 5s each tab fires `GET /api/workspaces/:id/board` regardless of whether anything changed | Wastes bandwidth, increases server load, contributes to higher latency for all users |
| **Wasted battery/CPU** — mobile clients and laptops poll continuously even when no changes occur | Poor UX on mobile; unnecessary resource consumption |
| **Race conditions between polling cycles** — a user's optimistic UI update may be overwritten by the next poll if the server state differs | Frustrating "rubber-banding" where local changes appear to revert |
| **No presence awareness** — no way to know who is actively viewing the board | Teams lack coordination context; no "seeing someone else's cursor" or active-user indicators |

### 1.3 What Happens if Sync is Delayed or Lost?

| Scenario | Consequence | Severity |
| :--- | :--- | :--- |
| User A moves a card → User B still sees old position for 5s | User B may attempt to move the same card, creating a conflict | Medium — resolved on next poll |
| User A blocks a card → User B tries to move it → server rejects (422) | User B sees error toast but doesn't understand why | Medium — confusing UX |
| User A assigns card to themselves → User C also gets assigned via override | Last-write-wins without clear signal to either party | High — data integrity risk |
| Network disconnect → events pile up → client reconnects | Client misses intermediate events; needs full state refresh | Medium — requires recovery strategy |
| Large board (500+ cards) → initial WS join loads full state | Slow first paint, potential OOM on constrained devices | Medium — needs pagination or delta-on-join |

### 1.4 Opportunity Solution Tree (OST)

```
Outcome: Team members always see an accurate, up-to-date board state with minimal latency

├── Opportunity: Eliminate polling delays
│   ├── Solution: WebSocket push for board events (card moved, blocked, assigned, etc.)
│   └── Solution: Optimistic UI updates + WS confirmation
│
├── Opportunity: Reduce server load and client battery drain
│   ├── Solution: Replace periodic polling with event-driven push
│   └── Solution: Heartbeat-based connection health instead of poll-based health checks
│
├── Opportunity: Provide presence awareness
│   ├── Solution: UserJoined/UserLeft events over WS
│   └── Solution: Active user indicators on board header
│
└── Opportunity: Gracefully handle edge cases
    ├── Solution: Automatic reconnect with exponential backoff
    ├── Solution: Full-state refetch on reconnect (TanStack Query recovery)
    └── Solution: Lagged-event detection with graceful degradation
```

---

## 📖 Part 2: User Stories (JTBD Format)

### US1: Real-time Card Movement Visibility
*   **JTBD**: When a teammate moves a card between columns or swimlanes on a shared board, I want to see the card's new position update on my screen instantly, so I am always aware of the current workflow state and can react accordingly.
*   **Acceptance Criteria**:
    *   **AC1.1**: Within 200ms of a card move operation completing on the server, all other connected clients in the same workspace receive a `CardMoved` event and update their UI.
    *   **AC1.2**: The card transition is animated smoothly (CSS transition, not a hard re-render) to avoid jarring visual jumps.
    *   **AC1.3**: If a client is offline when the move occurs, upon reconnection the client's TanStack Query cache is invalidated and refetches full state.

### US2: Real-time Blocker & Assignment Awareness
*   **JTBD**: When a card is blocked or reassigned by someone else, I want to see the blocker badge or assignee change appear immediately on my board, so I can adjust my priorities or help resolve the blocker.
*   **Acceptance Criteria**:
    *   **AC2.1**: `CardBlocked`, `CardUnblocked`, and `CardAssigned` events are delivered to all connected clients within 200ms of the mutation.
    *   **AC2.2**: Blocker status updates include the blocker reason, displayed inline on the card.
    *   **AC2.3**: If I am blocked from moving a card because it was blocked by another user, I see the shake animation + toast notification immediately (not after next poll).

### US3: Real-time Checklist Updates
*   **JTBD**: When a teammate completes or modifies a checklist item on a card, I want the checklist progress to update instantly on my view of that card, so the team has shared visibility on task readiness.
*   **Acceptance Criteria**:
    *   **AC3.1**: `ChecklistItemUpdated` and `ChecklistItemDeleted` events propagate to all connected clients.
    *   **AC3.2**: The checklist checkbox UI reflects the change without requiring a full card re-render.

### US4: Presence Awareness
*   **JTBD**: When I am working on the board, I want to know who else is actively viewing it, so I can coordinate with teammates and avoid conflicting edits.
*   **Acceptance Criteria**:
    *   **AC4.1**: `UserJoined` and `UserLeft` events are broadcast to all connected clients when a user connects to or disconnects from the board's WebSocket channel.
    *   **AC4.2**: Active user avatars/names are displayed in a presence indicator (e.g., board header or column headers).
    *   **AC4.3**: Stale connections (users who closed their tab without clean disconnect) are detected via the 60-second sweep task and cleaned up.

### US5: Resilient Reconnection
*   **JTBD**: When my internet connection drops or the WebSocket connection is lost, I want the board to automatically reconnect and resync without me having to refresh the page, so my workflow is uninterrupted.
*   **Acceptance Criteria**:
    *   **AC5.1**: The client detects WebSocket disconnection (close event or ping/pong timeout) and initiates automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s).
    *   **AC5.2**: On successful reconnection, the client refetches full board state via `GET /api/workspaces/:id/board` to recover any missed events.
    *   **AC5.3**: During reconnection, a subtle "Reconnecting..." indicator is shown. No data is lost.
    *   **AC5.4**: The `Lagged(n)` event from `tokio::sync::broadcast` is handled gracefully — the client treats it as a signal to do a full-state refetch rather than trying to apply partial deltas.

### US6: Multiple Tabs / Same-User Coordination
*   **JTBD**: When I have the same board open in multiple browser tabs, I want changes in one tab to appear in all my other tabs instantly, so all my views stay consistent.
*   **Acceptance Criteria**:
    *   **AC6.1**: Each browser tab opens its own independent WebSocket connection to the board.
    *   **AC6.2**: Events from one tab are broadcast to all other tabs (including the originating tab) via the workspace's broadcast channel.
    *   **AC6.3**: No special deduplication is needed — TanStack Query's cache normalization ensures idempotent state updates.

---

## 🎯 Part 3: Expected Outcomes & Success Metrics

### 3.1 Expected Outcomes

| Outcome | Description |
| :--- | :--- |
| **Zero-latency collaboration** | All clients see board mutations within 200ms of server processing |
| **Reduced server load** | Elimination of periodic polling reduces API traffic by ~60-80% (depending on concurrent users) |
| **Improved mobile battery life** | Event-driven push vs. continuous polling reduces CPU/network usage on constrained devices |
| **Presence awareness** | Teams can see who is actively working on the board, enabling better coordination |
| **Graceful degradation** | If WS drops, the app falls back to HTTP-based state recovery without user intervention |

### 3.2 Success Metrics

| Metric | Target | Measurement |
| :--- | :--- | :--- |
| **P95 event delivery latency** | < 200ms | Server-side tracing (from `ws_hub.publish()` to client receipt) |
| **Reconnection success rate** | > 99% within 10s | Client-side metric: time from disconnect to successful rejoin |
| **Polling requests eliminated** | 100% of board-sync traffic moves from HTTP polling to WS | Server-side: `GET /workspaces/:id/board` requests should drop to zero (or only initial load) |
| **Lagged events per session** | < 1% of total events | Server-side `RecvError::Lagged` log frequency |
| **User-reported stale-state complaints** | → 0 | Support/issue tracker |

---

## 🚫 Part 4: Non-Goals

The following are **explicitly out of scope** for Issue #33 and this feature cycle:

| Non-Goal | Rationale |
| :--- | :--- |
| **Operational transforms (OT) or CRDTs** | We use a fire-and-forget event model. Conflicts are resolved by last-write-wins with full-state recovery. OT/CRDT is a future consideration for v1.x. |
| **Client-to-server WebSocket commands** | The WS channel is **unidirectional** (server → client) for this release. All mutations continue to use REST API endpoints. Client-to-server WS is a future enhancement for presence heartbeats. |
| **Cross-workspace event routing** | Events are scoped to a single workspace. No pub/sub across workspaces. |
| **Redis-backed horizontal scaling** | The current `WorkspaceHub` uses in-memory `broadcast` channels per workspace. Multi-instance server scaling via Redis pub/sub is a v1.x concern. |
| **Full board state sent on WS join** | On initial WS connect, clients receive only incremental events from that point. Full state is loaded via the existing REST API (`GET /workspaces/:id/board`). |
| **E2E encryption beyond TLS** | WebSocket connections inherit the TLS of the underlying HTTP connection. Additional E2E encryption is out of scope. |

---

## ⚠️ Part 5: Edge Cases & Risks (PM Flags)

### 5.1 Network Disconnect / Reconnect

| Scenario | Risk | Mitigation |
| :--- | :--- | :--- |
| Client disconnects (Wi-Fi loss, tab close, browser crash) | Missed events during outage | On reconnect, client invalidates TanStack Query cache → full `GET /board` refetch recovers state |
| Server restarts | All WS connections drop, broadcast channels cleared | Clients auto-reconnect with backoff. Full-state refetch on reconnect recovers. Server `start_sweep_task` cleans stale channels. |
| Slow network (high latency, packet loss) | Ping/pong timeouts, spurious reconnects | Configurable ping interval (default 30s) and pong timeout (default 20s). Exponential backoff prevents connection storms. |
| Broadcast channel lag (`Lagged(n)` error) | Client falls behind the event stream | `Lagged(n)` triggers a full-state refetch. Channel capacity (64 events) is sized for burst handling during normal operation. |

### 5.2 Multiple Tabs / Same User

| Scenario | Risk | Mitigation |
| :--- | :--- | :--- |
| Same user, multiple tabs → each opens WS | Duplicate `UserJoined` events per tab | Each tab connection is independent. `UserJoined` includes `user_id`, so clients can deduplicate presence indicators. |
| Tab closes without clean disconnect | Stale `UserJoined` presence until sweep | 60-second sweep task cleans channels with zero receivers. Presence UI shows "last seen" timestamps as fallback. |
| Self-event echo (my own WS connection receives my own event) | Redundant UI update causing flicker | TanStack Query cache normalization makes updates idempotent. Optimistic UI + WS confirmation prevents double-updates. |

### 5.3 Conflicting Edits (Concurrent Mutations)

| Scenario | Risk | Mitigation |
| :--- | :--- | :--- |
| **User A moves Card X to Column B, User B moves Card X to Column C simultaneously** | Last-write-wins at DB level (pessimistic `FOR UPDATE` lock serializes). One HTTP request wins, the other gets a conflict response. | The losing client sees an error (e.g., toast), and the WS event for the winning mutation updates all clients. The losing client's optimistic UI rollback + WS event = correct final state. |
| **User A edits Card X checklist, User B moves Card X simultaneously** | Independent mutations on different aspects — no conflict at DB level | Both events are broadcast. The client applies them sequentially — order doesn't matter for independent fields. |
| **User A assigns Card X to themselves, User C admin-overrides to someone else** | Admin override wins at DB level (checked via `is_admin` flag) | WS `CardAssigned` event carries the final state. The non-admin user sees a toast: "Card was reassigned by admin." |

### 5.4 Large Board State on Initial Join

| Scenario | Risk | Mitigation |
| :--- | :--- | :--- |
| Board with 500+ cards and 200+ checklist items | Full `GET /board` state payload is large (~500KB+), slow first paint | The WS connection is established independently of board load. Initial state is loaded via REST with existing `BoardState` query (parallel async fetches). WS events only carry deltas, which are small. |
| Client joins during burst of activity (e.g., admin bulk-moving cards) | Client may lag behind the broadcast channel (64-event capacity) | `Lagged(n)` detection triggers full-state refetch. Channel capacity of 64 is sufficient for normal burst patterns. |
| Client on slow 3G network | Full state fetch takes several seconds | Skeleton loading UI ("Loading Board...") shown during fetch. WS connection establishes in parallel so events are queued once state arrives. |

### 5.5 Backend Code Quality Flags

> [!CAUTION]
> **Existing WebSocket code has compilation issues** that must be resolved before this feature can ship. The current `workspace.rs` defines two structs:
> - `WorkspaceHub` — has a field `inner: Arc<broadcast::Map<broadcast::Sender<BoardEvent>>>` referencing a non-existent `broadcast::Map` type. No `impl` block is defined.
> - `HubInner` — has a working implementation with `Mutex<HashMap<...>>`, `publish()`, `subscribe()`, and `start_sweep_task()`.
>
> `lib.rs` creates `Arc::new(WorkspaceHub::new())` which will fail to compile since `WorkspaceHub` has no `new()` method. **Recommendation**: The `WorkspaceHub` struct should either be aliased to `HubInner` or the implementation should be moved into `WorkspaceHub` with `HubInner` removed. This is a Phase 2 (Technical) fix but needs to be called out now.

---

## 📊 Part 6: RICE Prioritization

| Feature Component | Reach (1-10) | Impact (0.5-3) | Confidence (50%-100%) | Effort (Person-Weeks) | RICE Score | MoSCoW |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend WS hub fix + event publishing** | 10 (All users) | 2.0 (Core infra) | 95% (Existing partial code) | 0.3 | **633** | **Must Have** |
| **Frontend WS client + TanStack Query integration** | 10 (All users) | 2.5 (Primary value) | 90% (Standard pattern) | 0.5 | **450** | **Must Have** |
| **Reconnection with exponential backoff** | 10 (All users) | 2.0 (Reliability) | 90% (Well-understood) | 0.3 | **600** | **Must Have** |
| **Presence indicators (UserJoined/UserLeft)** | 8 (Collaborators) | 1.5 (Awareness) | 85% (Events exist) | 0.3 | **340** | **Should Have** |
| **Multiple-tab consistency testing** | 7 (Power users) | 1.0 (Edge case) | 80% (Broadcast model) | 0.2 | **280** | **Should Have** |
| **Lagged-event full-state recovery** | 6 (Large boards) | 1.5 (Edge case) | 85% (TanStack Query) | 0.2 | **315** | **Should Have** |

**Verdict**: Backend hub fix, frontend WS client, and resilient reconnection are **Must Haves** for this cycle. Presence indicators and edge-case handling are **Should Haves** that should ship in the same cycle if time permits.

---

## 🔗 Part 7: Dependencies & Next Steps

### 7.1 Technical Dependencies
- Backend `WorkspaceHub` compilation fix (Phase 2 — Architect)
- Frontend WebSocket client module (Solid.js-compatible; can leverage existing `SocketState` signal pattern mentioned in project context)
- TanStack Query integration for WS-driven cache invalidation
- Ping/pong heartbeat implementation in the server-side WS handler

### 7.2 Phase 2 Handoff
When Phase 1 discovery is approved, the following will be produced in the Mini-PRD:
- **Numbered Functional Requirements (FR)** derived from the acceptance criteria above
- **Technical Constraints** (broadcast channel sizing, backoff parameters, REST + WS interaction contract)
- **API Contract** (WS message schema, error codes, reconnection protocol)
- **Security Considerations** (cookie auth over WS, workspace membership enforcement)

### 7.3 Related Issues
- [Issue #37 — User WIP Limits](docs/product/v0.3_user_wip_limits_discovery.md) — WIP limit enforcement already publishes WS events; depends on WS client being connected
- [Issue #40 — Arrival/Departure Rules](docs/product/v0.4_arrival_departure_rules_discovery.md) — Rule violation toasts depend on real-time sync for immediate feedback
- [Issue #42 — Task Hierarchy](docs/product/v0.7_task_hierarchy_discovery.md) — AC3.2 explicitly calls for real-time WebSocket sync of parent progress bars

---

*This concludes Phase 1: Discovery for Issue #33 — Real-time Sync with WebSockets.*
