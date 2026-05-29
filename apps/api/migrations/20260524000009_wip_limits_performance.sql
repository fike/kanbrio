-- Add CHECK constraints for positive wip_limits on columns and swimlanes
ALTER TABLE columns ADD CONSTRAINT chk_columns_wip_limit CHECK (wip_limit > 0);
ALTER TABLE swimlanes ADD CONSTRAINT chk_swimlanes_wip_limit CHECK (wip_limit > 0);

-- Add active column and swimlane indexes to optimize WIP count queries
CREATE INDEX IF NOT EXISTS idx_cards_column_active
ON cards(current_column_id)
WHERE is_archived = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cards_swimlane_active
ON cards(current_swimlane_id)
WHERE is_archived = false AND deleted_at IS NULL;
