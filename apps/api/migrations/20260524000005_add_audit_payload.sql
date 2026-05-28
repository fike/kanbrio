-- Add JSONB payload column to card_transitions for extensible event logging
ALTER TABLE card_transitions
ADD COLUMN payload JSONB;
