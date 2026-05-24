-- Create columns table for vertical board structure
CREATE TABLE IF NOT EXISTS columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    position INT NOT NULL,
    wip_limit INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for workspace lookups and ordering
CREATE INDEX IF NOT EXISTS idx_columns_workspace_id_position ON columns(workspace_id, position);

-- Create swimlanes table for horizontal board structure
CREATE TABLE IF NOT EXISTS swimlanes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for workspace lookups and ordering
CREATE INDEX IF NOT EXISTS idx_swimlanes_workspace_id_position ON swimlanes(workspace_id, position);

-- Add foreign key constraints to existing cards table
-- Note: In a production environment with existing data, we would need to ensure
-- valid column/swimlane IDs exist before applying these constraints.
ALTER TABLE cards
ADD CONSTRAINT fk_cards_column FOREIGN KEY (current_column_id) REFERENCES columns(id),
ADD CONSTRAINT fk_cards_swimlane FOREIGN KEY (current_swimlane_id) REFERENCES swimlanes(id);
