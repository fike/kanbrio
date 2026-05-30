-- Migration: Add Card Checklists and Column Transition Rules

-- 1. Create card_checklists table
CREATE TABLE IF NOT EXISTS card_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for retrieving card checklists ordered by position
CREATE INDEX IF NOT EXISTS idx_card_checklists_card_id_position ON card_checklists(card_id, position);

-- 2. Create transition_rules table
CREATE TABLE IF NOT EXISTS transition_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('arrival', 'departure')),
    criteria_type VARCHAR(50) NOT NULL CHECK (criteria_type IN ('assignee_required', 'checklist_completed', 'subtasks_completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to optimize rule lookups for a specific column and rule type
CREATE INDEX IF NOT EXISTS idx_transition_rules_column_rules ON transition_rules(column_id, rule_type);
