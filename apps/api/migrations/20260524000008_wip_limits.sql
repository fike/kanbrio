-- Add wip_limit to swimlanes
ALTER TABLE swimlanes ADD COLUMN IF NOT EXISTS wip_limit INT;
