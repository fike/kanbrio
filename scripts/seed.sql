-- scripts/seed.sql
-- Default seed data for Kanbrio local development

-- 1. Create a default Workspace
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Default Workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Create Columns
INSERT INTO columns (id, workspace_id, title, position, wip_limit)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'To Do', 0, NULL),
  ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Doing', 1, 3),
  ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Done', 2, 1)
ON CONFLICT (id) DO NOTHING;

-- 3. Create Swimlanes
INSERT INTO swimlanes (id, workspace_id, title, position)
VALUES
  ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Standard', 0),
  ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'Expedite', 1)
ON CONFLICT (id) DO NOTHING;

-- 4. Create Sample Cards
INSERT INTO cards (id, workspace_id, title, current_column_id, current_swimlane_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440000', 'Implement Drag & Drop', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004'),
  ('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440000', 'Design System Tokens', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004'),
  ('550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440000', 'Fix Security Leak', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005')
ON CONFLICT (id) DO NOTHING;

-- 5. Create Default User for E2E and Local testing
INSERT INTO users (id, email, name, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655449999', 'admin@test.com', 'Admin User', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Associate Default User with Default Workspace as Admin
INSERT INTO workspace_members (workspace_id, user_id, role, joined_at, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655449999', 'admin', NOW(), NOW(), NOW())
ON CONFLICT (workspace_id, user_id) DO NOTHING;
