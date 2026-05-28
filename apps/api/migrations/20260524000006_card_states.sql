-- Add states to cards
ALTER TABLE cards
ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN deleted_at TIMESTAMPTZ;

-- Optional: Add reason table if we want to support reason_id as a foreign key,
-- but for now we'll use the payload for the reason text.
