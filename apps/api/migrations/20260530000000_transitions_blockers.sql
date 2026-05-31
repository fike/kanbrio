-- Migration: apps/api/migrations/20260530000000_transitions_blockers.sql
-- Description: Schema updates for card blockers and block comments threads.

-- 1. Add blocker columns to cards table
ALTER TABLE cards
ADD COLUMN blocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN blocked_at TIMESTAMPTZ,
ADD COLUMN blocked_reason TEXT;

-- 2. Add structural check constraint to guarantee integrity of blocked state
ALTER TABLE cards
ADD CONSTRAINT chk_card_blocked_state_integrity CHECK (
    (is_blocked = TRUE AND blocked_by IS NOT NULL AND blocked_at IS NOT NULL AND blocked_reason IS NOT NULL AND length(trim(blocked_reason)) > 0)
    OR
    (is_blocked = FALSE AND blocked_by IS NULL AND blocked_at IS NULL AND blocked_reason IS NULL)
);

-- 3. Create card_block_comments table for targeted discussions while blocked
CREATE TABLE IF NOT EXISTS card_block_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create chronologically sorted index on card_id for comments
CREATE INDEX IF NOT EXISTS idx_card_block_comments_card_id ON card_block_comments(card_id, created_at ASC);
