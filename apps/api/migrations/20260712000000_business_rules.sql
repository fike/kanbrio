-- Migration: apps/api/migrations/20260712000000_business_rules.sql
-- Description: Create business_rules table for trigger-action configuration and audit integration.

-- 1. Create business_rules table to map trigger-action configurations scoped to workspaces
CREATE TABLE IF NOT EXISTS business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_type VARCHAR(50) NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enforce unique rule names within a single workspace to prevent name collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_rules_workspace_name
ON business_rules(workspace_id, name);

-- 3. Create optimized index on workspace_id for rules evaluation filter
CREATE INDEX IF NOT EXISTS idx_business_rules_workspace_active
ON business_rules(workspace_id)
WHERE is_active = TRUE;

-- 4. Ensure card transitions tracking records the triggering rule ID for auditability
ALTER TABLE card_transitions ADD COLUMN IF NOT EXISTS triggering_rule_id UUID REFERENCES business_rules(id) ON DELETE SET NULL;
