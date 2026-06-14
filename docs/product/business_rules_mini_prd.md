# Technical Specification & Mini-PRD: Business Rules Engine & Status Sync (v0.8)

**Status**: Proposal | **Version**: 0.8 | **Owner**: @product-manager | **Date**: 2026-06-14
**Strategic Alignment**: Flow Automation, Context Preservation, Administrative Control, Workspace Security, and Reduced Manual Overhead.

---

> [!IMPORTANT]
> This technical specification builds directly upon the product discovery documented in [Business Rules Engine & Status Synchronization Discovery](business_rules_user_stories.md) and translates the visual guidelines defined in Section 15 of `DESIGN.md` into concrete Rust Axum route handlers, PostgreSQL DDL migrations, JSON request/response payload schemas, WebSocket events, and testable Acceptance Criteria.

---

## 💾 1. Database Schema & SQL DDL Migration

To support workspace-scoped business rules, the following PostgreSQL DDL migration must be implemented in `apps/api/migrations/20260614000000_business_rules.sql`.

```sql
-- Migration: Add Business Rules Engine Table

-- 1. Create table business_rules to map trigger-action configurations scoped to workspaces
CREATE TABLE IF NOT EXISTS business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_type VARCHAR(50) NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enforce unique rule names within a single workspace to prevent name collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_rules_workspace_name
ON business_rules(workspace_id, name);

-- 3. Create optimized index on workspace_id for rules evaluation filter
CREATE INDEX IF NOT EXISTS idx_business_rules_workspace_active
ON business_rules(workspace_id)
WHERE is_active = TRUE;

-- 4. Ensure card transitions tracking records the triggering rule ID for auditability
ALTER TABLE card_transitions ADD COLUMN IF NOT EXISTS triggering_rule_id UUID REFERENCES business_rules(id) ON DELETE SET NULL;
```

---

## ⚙️ 2. Rust Backend Specs & Models

### 2.1 Backend Data Structures (Rust Models)

Define the `BusinessRule` model in `apps/api/src/models/rule.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BusinessRule {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub trigger_type: String,
    pub trigger_config: serde_json::Value,
    pub action_type: String,
    pub action_config: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### 2.2 Trigger & Action Configurations

1. **Trigger Types (`trigger_type`)**:
   - `child_status_changed`: Fired when a child card (where `parent_id` is present) transitions columns.
     - `trigger_config`: `{}`
   - `card_entered_column`: Fired when any card moves into a specific column.
     - `trigger_config`: `{ "column_id": "UUID" }`

2. **Action Types (`action_type`)**:
   - `move_parent_card`: Move the parent card of the triggering card.
     - `action_config`: `{ "in_progress_column_id": "UUID", "done_column_id": "UUID" }`
   - `assign_card`: Set or clear assignee on the triggering card.
     - `action_config`: `{ "assigned_user_id": "UUID" }` or `{ "clear_assignee": true }`

---

## 🌐 3. REST API Contracts

All endpoints are protected under the workspace context using the `WorkspaceTenantGuard` and `WorkspaceAdminGuard` middleware.

### 3.1 `GET /api/workspaces/:workspace_id/rules`
*   **Description**: Retrieves all configured business rules for a workspace.
*   **Access Control**: Workspace Admins only.
*   **Success Code**: `200 OK`
*   **Response Payload**:
```json
[
  {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "workspace_id": "8754b2c1-d218-47bc-8f43-0599c9c8bc84",
    "name": "Auto-Move Parent to Done",
    "trigger_type": "child_status_changed",
    "trigger_config": {},
    "action_type": "move_parent_card",
    "action_config": {
      "in_progress_column_id": "col-inprogress-uuid-111",
      "done_column_id": "col-done-uuid-222"
    },
    "is_active": true,
    "created_at": "2026-06-14T12:00:00Z",
    "updated_at": "2026-06-14T12:00:00Z"
  }
]
```

### 3.2 `POST /api/workspaces/:workspace_id/rules`
*   **Description**: Creates a new business rule in the workspace.
*   **Access Control**: Workspace Admins only.
*   **Success Code**: `201 Created`
*   **Request Payload Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CreateRuleRequest",
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 1, "maxLength": 255 },
    "trigger_type": { "type": "string", "enum": ["child_status_changed", "card_entered_column"] },
    "trigger_config": { "type": "object" },
    "action_type": { "type": "string", "enum": ["move_parent_card", "assign_card"] },
    "action_config": { "type": "object" },
    "is_active": { "type": "boolean" }
  },
  "required": ["name", "trigger_type", "trigger_config", "action_type", "action_config"],
  "additionalProperties": false
}
```
*   **Response Payload**: Returns the created `BusinessRule` JSON object.

### 3.3 `PATCH /api/workspaces/:workspace_id/rules/:rule_id`
*   **Description**: Modifies settings or active status of a business rule.
*   **Access Control**: Workspace Admins only.
*   **Success Code**: `200 OK`
*   **Request Payload Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UpdateRuleRequest",
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 1, "maxLength": 255 },
    "is_active": { "type": "boolean" },
    "trigger_config": { "type": "object" },
    "action_config": { "type": "object" }
  },
  "additionalProperties": false
}
```
*   **Response Payload**: Returns the updated `BusinessRule` JSON object.

### 3.4 `DELETE /api/workspaces/:workspace_id/rules/:rule_id`
*   **Description**: Deletes a business rule configuration.
*   **Access Control**: Workspace Admins only.
*   **Success Code**: `204 No Content`
*   **Response Payload**: Empty.

### 3.5 Standardized Error Payloads

#### A. Bad Request / Validation Failure (`400 Bad Request`)
Returned if trigger or action configurations are missing mandatory parameters or fail format verification.
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid rule configuration: trigger_config of 'card_entered_column' must contain a valid column_id."
}
```

#### B. Access Restriction (`403 Forbidden`)
Returned if the session is authenticated but the user is not a Workspace Admin, or if the rule referenced does not belong to the target workspace (tenancy mismatch).
```json
{
  "error": "FORBIDDEN",
  "message": "You do not have permission to manage business rules for this workspace."
}
```

#### C. Rule Name Collision (`409 Conflict`)
Returned if a rule name already exists within the target workspace.
```json
{
  "error": "DUPLICATE_RULE_NAME",
  "message": "A business rule with the name 'Auto-Move Parent to Done' already exists in this workspace."
}
```

#### D. WIP Limit Conflict (`409 Conflict`)
Returned when an automated action is aborted because the target assignee's WIP limit is exceeded.
```json
{
  "error": "WIP_LIMIT_EXCEEDED",
  "message": "Automation rule execution rejected: target user's Work-in-Progress limit would be exceeded.",
  "entity": "user",
  "limit": 3
}
```

#### E. Recursion Loop Detected (`422 Unprocessable Entity`)
Returned when the backend aborts a rule cascade to prevent infinite automation cycles.
```json
{
  "error": "RECURSION_LIMIT_EXCEEDED",
  "message": "Rule execution aborted: maximum automation recursion depth (5) exceeded."
}
```

---

## 📡 4. WebSocket Event Contracts

When automation rules execute, the changes are committed inside the database transaction and broadcast to all active clients.

### 4.1 Card Moved Event (`card:moved`)
Triggered when status sync transitions a card (such as parent card moving to Done or In Progress).
*   **Event Envelope**:
```json
{
  "event": "card:moved",
  "data": {
    "card_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "workspace_id": "8754b2c1-d218-47bc-8f43-0599c9c8bc84",
    "column_id": "col-done-uuid-222",
    "swimlane_id": "swimlane-main-uuid-333",
    "assigned_user_id": "user-dev-uuid-444",
    "transition_type": "system_auto_move",
    "triggering_rule_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "updated_at": "2026-06-14T22:00:00Z"
  }
}
```

### 4.2 Card Assigned/Updated Event (`card:updated`)
Triggered when auto-assignment configures a new card owner.
*   **Event Envelope**:
```json
{
  "event": "card:updated",
  "data": {
    "card_id": "d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2",
    "workspace_id": "8754b2c1-d218-47bc-8f43-0599c9c8bc84",
    "assigned_user_id": "user-qa-uuid-555",
    "triggering_rule_id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "updated_at": "2026-06-14T22:01:00Z"
  }
}
```

---

## ⚙️ 5. Numbered Functional Requirements (FR)

### 5.1 Rules Administration Page Access & Layout
*   **FR-80 (Admin Scoped Access)**:
    *   Access to the route `/workspaces/:workspace_id/settings/rules` is locked to Workspace Admins. If a standard member attempts access, return a blank template with an error banner, or redirect to dashboard. Backend API endpoints must enforce `WorkspaceAdminGuard` returning a `403 Forbidden` JSON error payload.
*   **FR-81 (Rules Table List)**:
    *   The settings screen must render active and inactive rules in a dense grid/list container (`data-testid="rules-settings-container"`). Each card must display the rule's name, description, active/inactive badge, a binary toggle switch (`data-testid="rule-toggle-{rule_id}"`), and a delete button (`data-testid="rule-delete-{rule_id}"`).
*   **FR-82 (Shimmer Skeleton)**:
    *   While retrieving rule records from the database, the page must mount a shimmer skeleton element (`data-testid="rules-loading-skeleton"`) with `aria-busy="true"`.
*   **FR-83 (Actionable Empty State)**:
    *   If no business rules are configured for the current workspace, the page must render a dashed border panel (`data-testid="rules-empty-state"`) with a "Configure First Rule" CTA button.

### 5.2 Creation Wizard Modal (a11y)
*   **FR-84 (Modal Focus Trap)**:
    *   Clicking "Create Rule" opens a modal dialog (`data-testid="create-rule-modal"`). Focus must instantly trap within this window. Tab navigates sequentially and wraps from the Cancel/Create button back to the Close button.
*   **FR-85 (Autofocus & Input Reset)**:
    *   When the modal opens, keyboard focus must immediately mount on the Rule Name input field. The modal fields must reset to empty states.
*   **FR-86 (Modal Dismissal)**:
    *   Users can close the modal by clicking the Close button, clicking the backdrop overlay, or pressing the `Escape` key. Closing returns focus to the trigger button.
*   **FR-87 (Conditional Config Fields)**:
    *   Selecting "Card entered a specific column" as Trigger must display a Column Selector dropdown.
    *   Selecting "Assign card to member" as Action must display an Assignee User Selector dropdown.

### 5.3 Interactive Rule Modification
*   **FR-88 (Optimistic Toggle Update)**:
    *   Toggling a switch next to a rule must optimistically toggle the UI state, dispatch a PATCH request to the backend, and display a success toast in the bottom right corner of the screen upon success.
*   **FR-89 (Form Validation Error Feedback)**:
    *   If creation fails validation or gets rejected by the server, the modal must run a horizontal shake animation (`animate-shake`), highlight invalid inputs in red, and mount an alert banner (`data-testid="rule-modal-error"`) with `aria-live="assertive"`.

### 5.4 Core Rules Engine Automation (IFTTT)
*   **FR-90 (Transactional Status Sync)**:
    *   When a child card is updated, evaluate active status sync rules.
    *   If a child card moves to any column other than the first (backlog) column and the parent card is in a backlog column, move the parent card to the first in-progress column.
    *   If a child card moves to a column with `is_done = true`, check siblings. If all siblings are in columns with `is_done = true`, transition the parent card to the Done column.
*   **FR-91 (Auto-Assignment with WIP Limit Guard)**:
    *   When a card transitions into a configured column, update the assignee.
    *   If the target assignee's active card count in the workspace would exceed their WIP limit, reject the card movement, rollback the transaction, and return a validation error.
*   **FR-92 (Infinite Loop Prevention)**:
    *   The rules engine must count recursive executions. If the cascade exceeds 5 levels, abort, rollback the transaction, log the error, and return `422 Unprocessable Entity` to prevent infinite loops.

---

## 🚦 6. Acceptance Criteria (AC) mapping to beads tasks

### AC-1: Database Migration for Business Rules Schema
*Reference Bead Issue: `kanbrio-1780076620524-19-c281fdad.1`*
*   **AC1.1 (DDL Migrations)**: A PostgreSQL migration file must create the `business_rules` table containing columns `id`, `workspace_id`, `name`, `trigger_type`, `trigger_config`, `action_type`, `action_config`, `is_active`, and timestamps.
*   **AC1.2 (Workspace Scoping & Integrity)**: The table must include a foreign key constraint linking `workspace_id` to `workspaces(id)` with `ON DELETE CASCADE`.
*   **AC1.3 (Unique Name Index)**: A database unique index `idx_business_rules_workspace_name` must enforce unique rule names per workspace.
*   **AC1.4 (Audit Integration)**: A foreign key column `triggering_rule_id` linking `business_rules(id)` must be added to the `card_transitions` table.
*   **AC1.5 (Migration Verification)**: The migration script must run successfully forward (`up`) and backward (`down`) without losing database integrity.

### AC-2: Rust Backend Business Rules Core Engine
*Reference Bead Issue: `kanbrio-1780076620524-19-c281fdad.2`*
*   **AC2.1 (Rust Models)**: The backend must define a matching `BusinessRule` struct and parse configurations safely from `serde_json::Value` objects.
*   **AC2.2 (Transactional Isolation)**: The rule evaluation engine must execute within the SQL transaction scope of the card movement. If any automation rule fails (e.g. database error, limit check), the entire transaction must rollback.
*   **AC2.3 (Recursion Cap)**: A thread-safe call depth recursion counter must be passed through the evaluation context. If depth exceeds 5, the execution must abort, rollback, and return HTTP `422 Unprocessable Entity` with `RECURSION_LIMIT_EXCEEDED` error code.
*   **AC2.4 (Unit Tests)**: The core engine evaluation function must be validated with Unit Tests using mocked inputs for both normal execution and recursion breach scenarios.

### AC-3: Status Sync Automation Rules
*Reference Bead Issue: `kanbrio-1780076620524-19-c281fdad.3`*
*   **AC3.1 (Trigger Execution)**: Triggering a child card transition must initiate evaluation for `child_status_changed` rules matching the parent card.
*   **AC3.2 (In-Progress Rule)**: If a child card moves to any non-backlog column while parent is in the backlog column, the engine must transition the parent card to the first in-progress column of the workspace.
*   **AC3.3 (Done Rule)**: If a child card transitions to a column marked `is_done = true`, the engine must query siblings. If all siblings are in columns marked `is_done = true`, the engine must transition the parent card to the Done column.
*   **AC3.4 (Transitions Logging)**: The parent card movement must insert a row into `card_transitions` with `transition_type` logged as `'system_auto_move'` and `triggering_rule_id` pointing to the matching rule.

### AC-4: Auto-Assignment Rules on Column Entry
*Reference Bead Issue: `kanbrio-1780076620524-19-c281fdad.4`*
*   **AC4.1 (Trigger Execution)**: Moving a card to a column configured in a `card_entered_column` rule must execute the `assign_card` action.
*   **AC4.2 (Assignee Mutation)**: The action must set the card's `assigned_user_id` to the configured user UUID, or clear the assignee if configured with `clear_assignee: true`.
*   **AC4.3 (WIP Limit Checking)**: The action must fetch the user's active WIP limit in the workspace. If assigning the card would cause the user's active cards count to exceed this limit, the transaction must abort and return HTTP `409 Conflict` (WIP_LIMIT_EXCEEDED).
*   **AC4.4 (Integration Tests)**: Implement backend integration tests verifying auto-assignment on entry, clear assignee, and WIP limit violations.

### AC-5: HTTP REST API Endpoints for Admin Rules CRUD
*Reference Bead Issue: `kanbrio-1780076620524-19-c281fdad.5`*
*   **AC5.1 (CRUD Endpoints)**: Implement the following endpoints under `/api/workspaces/:workspace_id/rules`:
    *   `GET /api/workspaces/:workspace_id/rules` - returns `200 OK` with JSON array.
    *   `POST /api/workspaces/:workspace_id/rules` - returns `201 Created` with JSON object.
    *   `PATCH /api/workspaces/:workspace_id/rules/:rule_id` - returns `200 OK` with JSON object.
    *   `DELETE /api/workspaces/:workspace_id/rules/:rule_id` - returns `204 No Content`.
*   **AC5.2 (Admin Lock)**: Endpoint guards must return `403 Forbidden` if the authenticated user is not a Workspace Admin.
*   **AC5.3 (Tenancy Isolation)**: Querying or modifying a rule that belongs to a different workspace than the one provided in the URI parameter must return `403 Forbidden` (tenancy mismatch).
*   **AC5.4 (JSON Validations)**: Payload fields must be parsed against JSON schemas. Invalid inputs must return `400 Bad Request` validation errors. Duplicate rule names must return `409 Conflict`.

### AC-6: Workspace Settings Rules Interface
*Reference Bead Issue: `kanbrio-1780076620524-19-c281fdad.6`*
*   **AC6.1 (Settings Tab & UI)**: Develop the settings layout at `/workspaces/:workspace_id/settings/rules` using Tailwind utility classes matching Section 15 of `DESIGN.md`.
*   **AC6.2 (State Handling)**: Implement Skeleton loading states, Actionable Empty States, and Success Toast Notifications that auto-dismiss after 4000ms.
*   **AC6.3 (Modal Accessibility)**: The Create Rule Modal must trap keyboard focus, autofocus the name field, support Escape key close, backdrop dismiss, and Enter key form submission.
*   **AC6.4 (Validation & Error Cues)**: On form submission rejection, the UI must display a horizontal shake animation (`animate-shake`), highlight invalid fields in red, and display a form-level error banner (`data-testid="rule-modal-error"`).
*   **AC6.5 (Interactive Controls)**: The switch toggles must update rules optimistically and revert if the backend request fails.

### AC-7: WebSocket Integration & Playwright E2E verification
*Reference Bead Issue: `kanbrio-1780076620524-19-c281fdad.7`*
*   **AC7.1 (Real-time Broadcasts)**: Triggering parent movement or card auto-assignment via automation must emit a WebSocket event (`card:moved` or `card:updated`) to all active clients of the workspace.
*   **AC7.2 (E2E User Flow)**: Implement a Playwright E2E test verifying that a user completing a child card triggers status sync which moves the parent card on the board, updating in real-time.
*   **AC7.3 (E2E Admin CRUD)**: Write Playwright E2E tests validating the CRUD lifecycle of business rules in the settings modal, including verification of accessibility features (focus trap, Escape closing).
