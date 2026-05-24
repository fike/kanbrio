-- Add swimlane fields to card_transitions for 2D board auditing
ALTER TABLE card_transitions
ADD COLUMN from_swimlane_id UUID,
ADD COLUMN to_swimlane_id UUID;
