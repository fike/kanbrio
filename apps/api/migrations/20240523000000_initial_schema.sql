-- Create cards table with adjacency list for hierarchy
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    current_column_id UUID NOT NULL,
    current_swimlane_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for parent_id to optimize recursive CTEs
CREATE INDEX IF NOT EXISTS idx_cards_parent_id ON cards(parent_id);

-- Create card_transitions table for event auditing (as per ADR 003)
CREATE TABLE IF NOT EXISTS card_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id UUID,
    transition_type VARCHAR(50) NOT NULL,
    from_column_id UUID,
    to_column_id UUID,
    reason_id UUID,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_transitions_card_id ON card_transitions(card_id);
