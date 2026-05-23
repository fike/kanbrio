# ADR 003: Data Core Design (Hierarchy & Event Logging)

**Date**: 2026-05-22
**Status**: Proposed
**Owner**: @architect

## Context
Kanbrio's primary competitive advantage is its ability to handle infinite portfolio hierarchies and perform complex predictive analytics (Monte Carlo). The underlying database architecture must support these features without sacrificing real-time board performance.

We need to decide on the schema patterns for two critical subsystems:
1. **Hierarchical Relationships**: How cards relate to each other (e.g., Initiative -> Project -> Epic -> Task).
2. **State Auditing**: How we record card movements to calculate Lead Time, Cycle Time, and Flow Efficiency.

## Options Considered

### 1. Hierarchical Relationships
*   **Option 1A: Closure Tables**: Storing every ancestor-descendant relationship.
    *   *Pros*: Blazing fast reads.
    *   *Cons*: Extreme write amplification. Moving a subtree requires massive recalculations.
*   **Option 1B: Adjacency List (Recursive CTEs)**: Storing only `parent_id`.
    *   *Pros*: Fast writes, simple schema. Moving subtrees is trivial (one row update).
    *   *Cons*: Deeper reads require recursive queries (`WITH RECURSIVE`), which were historically slow but are highly optimized in modern PostgreSQL.

### 2. State Auditing
*   **Option 2A: Pure Event Sourcing**: The database only stores events. The "current state" is calculated by replaying all events.
    *   *Pros*: Absolute auditability.
    *   *Cons*: High complexity. Fetching the current board state becomes computationally expensive.
*   **Option 2B: State + Audit Log (Hybrid)**: A primary table stores the "hot" current state, while an append-only log table records every transition.
    *   *Pros*: Fast real-time reads (querying current state) while preserving immutable history for analytics.
    *   *Cons*: Requires double-writes (handled via transactions) and eventual data volume management.

## Decision
We will use a **PostgreSQL Hybrid Architecture**:
1. **Adjacency List + Recursive CTEs** for the hierarchy.
2. **State + Audit Log (Event Sourcing Lite)** for tracking flow.

### Proposed Schema Draft

```sql
-- The "Hot State" Table
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES cards(id), -- Adjacency List
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    current_column_id UUID NOT NULL,
    current_swimlane_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- The Immutable Log
CREATE TABLE card_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES cards(id),
    user_id UUID,
    transition_type VARCHAR(50) NOT NULL, -- e.g., 'move', 'block', 'unblock'
    from_column_id UUID,
    to_column_id UUID,
    reason_id UUID, -- For Blocker analysis
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Rationale
1. **Recursion Performance**: In a Kanban context, users frequently reprioritize or move entire branches of work. The Adjacency List model (`parent_id`) makes these writes O(1). PostgreSQL 14+ handles the recursive read queries efficiently enough for our expected depth (< 10 levels).
2. **Analytics Foundation**: The `card_transitions` table is the "gold mine" for the Monte Carlo engine. By separating it from the "hot state", we ensure that complex historical queries do not lock or slow down the real-time Kanban board updates.
3. **WIP Enforcement**: The current state is readily available in the `cards` table, allowing the backend to quickly run `COUNT(*)` checks against column WIP limits before allowing a transaction to commit.

## Consequences
- **Positive**: We achieve the exact balance needed for a high-performance, analytics-heavy application. The schema is easy to understand for developers but powerful enough for complex statistics.
- **Negative**: The backend (Rust) must ensure that every card movement is wrapped in a strict SQL transaction that updates `cards` AND inserts into `card_transitions`. Failure to do so will corrupt the analytics data.

## Critical Files
- `apps/api/migrations/001_initial_schema.sql` (To be created)
