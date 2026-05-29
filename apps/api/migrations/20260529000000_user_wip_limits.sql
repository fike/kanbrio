-- Migration: Add User WIP Limits and Card Assignees

-- 1. Add is_done to columns to distinguish active from completed states
ALTER TABLE columns ADD COLUMN IF NOT EXISTS is_done BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add wip_limit to workspace_members for workspace-specific user limits
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS wip_limit INT;
ALTER TABLE workspace_members ADD CONSTRAINT chk_workspace_members_wip_limit CHECK (wip_limit > 0);

-- 3. Add assigned_user_id to cards to represent assignee
ALTER TABLE cards ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Create an optimized partial index for active cards per assignee in a workspace
-- This ignores archived, soft-deleted, and unassigned cards, optimizing O(log N) count lookups.
CREATE INDEX IF NOT EXISTS idx_cards_assigned_active
ON cards(workspace_id, assigned_user_id)
WHERE is_archived = FALSE AND deleted_at IS NULL AND assigned_user_id IS NOT NULL;
