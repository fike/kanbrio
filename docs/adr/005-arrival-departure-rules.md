# ADR 005: Arrival & Departure Rules (Checklists & Column Policies)

**Date**: 2026-05-29
**Status**: Proposed
**Owner**: @architect

## Context
In high-predictability Lean/Kanban systems, ensuring that work items satisfy explicit quality standards before advancing is critical to minimizing Lead Time variability and rework.

We need to implement **Arrival & Departure Rules** (Checklists & Column Policies) to act as automated gatekeepers on the board. We need to decide on the schema patterns for two primary components:
1. **Card Checklists**: How we represent and store checklist items on individual cards.
2. **Transition Rules (Column Policies)**: How we store and evaluate the entry (arrival) and exit (departure) rules for columns.

## Options Considered

### 1. Card Checklists Storage

#### Option 1A: Strict Relational Table (`card_checklists`)
*   **Description**: A dedicated table where each checklist item is a separate row referencing a `card_id`.
*   **Pros**:
    *   *Auditability*: Easy to track who checked off each item (`completed_by` referencing `users.id`) and when (`completed_at`).
    *   *Relational Integrity*: Clean foreign keys, positions, and constraints.
    *   *Transaction Performance*: Easy to query uncompleted checklist items inside database transactions using standard count: `SELECT COUNT(*) WHERE is_completed = FALSE`.
*   **Cons**:
    *   *Join Amplification*: Fetching cards with their checklists requires SQL joins, though highly optimized via indexes.

#### Option 1B: JSONB Array inside `cards` Table
*   **Description**: Checklist items stored as a serialized JSON array (`[{"title": "...", "done": true}]`) inside a `checklists` column on the `cards` table.
*   **Pros**:
    *   *No Joins*: Checklists are fetched automatically with the card.
*   **Cons**:
    *   *No Foreign Keys*: Cannot easily reference users who completed items or audit timestamps cleanly.
    *   *Write Contention*: Updating a single checklist item requires rewriting the entire JSON array in PostgreSQL.

---

### 2. Transition Rules (Column Policies) Storage

#### Option 2A: Dedicated Relational Table (`transition_rules`)
*   **Description**: A separate config table (`id`, `workspace_id`, `column_id`, `rule_type`, `criteria_type`).
*   **Pros**:
    *   *Flexibility*: A column can have multiple distinct transition policies (e.g. entry requires assignee AND all checklists completed).
    *   *Index Lookups*: Very fast index-only scans on `(column_id, rule_type)`.
*   **Cons**:
    *   *Additional Table*: One more relation to migrate.

#### Option 2B: JSONB Column on the `columns` Table
*   **Description**: A `policies` JSONB field in `columns` (e.g. `{"arrival": ["assignee_required"], "departure": ["checklist_completed"]}`).
*   **Pros**:
    *   *Simple Table Layout*: Avoids a new table.
*   **Cons**:
    *   *No Referential Integrity*: Harder to ensure that criteria types are constrained by database-level validation checks.

---

## Decision
We will adopt the **Relational Tables Approach (Option 1A & Option 2A)**:
1. **`card_checklists`** dedicated table to store checklist items, offering full audit trails (`completed_by`, `completed_at`).
2. **`transition_rules`** dedicated configuration table to enforce entry/exit policies on columns.

### Schema Draft
```sql
CREATE TABLE card_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transition_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('arrival', 'departure')),
    criteria_type VARCHAR(50) NOT NULL CHECK (criteria_type IN ('assignee_required', 'checklist_completed', 'subtasks_completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Rationale
1. **Predicatable Flow & Analytics**: Storing checklist items relationally allows us to run aggregate analytics (e.g. "which checklist items are the most frequent bottlenecks?") which is a strategic priority for Kanbrio.
2. **Operational Safety**: A separate rules table allows us to easily add new criteria types in the future (e.g. custom field checks) without rewriting the primary board layout relations.
3. **Audit Trails**: Having explicit `completed_by` and `completed_at` timestamps per checklist item provides high-integrity logs for agile audits.

## Consequences
*   **Positive**: High-performance validation checking inside Rust card-movement database transactions; simple, extensible, and fully-auditable schema.
*   **Negative**: Requires managing two additional relational tables.

## Critical Files
- `apps/api/migrations/20260529000001_arrival_departure_rules.sql` (To be created)
