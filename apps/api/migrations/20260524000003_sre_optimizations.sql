-- SRE Fix: Add index on cards(workspace_id) to optimize board state retrieval
CREATE INDEX IF NOT EXISTS idx_cards_workspace_id ON cards(workspace_id);
