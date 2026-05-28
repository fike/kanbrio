-- SRE Performance Fix: Optimize card history API
CREATE INDEX IF NOT EXISTS idx_card_transitions_history
ON card_transitions (card_id, occurred_at DESC);

-- SRE Performance Fix: Partial index for active cards in board view
CREATE INDEX IF NOT EXISTS idx_cards_workspace_active
ON cards(workspace_id)
WHERE deleted_at IS NULL;
