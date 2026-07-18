-- scripts/demo.sql
-- Full demo data for Kanbrio presentations and exploration.
-- Resets all tables and inserts rich, interconnected data.
-- All demo users share the same demo credential (see README for value).
--
-- Usage:  docker compose exec -T postgres psql -U postgres -d kanbrio < scripts/demo.sql

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- 0. Clean slate
-- ══════════════════════════════════════════════════════════════════════

TRUNCATE TABLE
  card_transitions,
  card_block_comments,
  card_checklists,
  business_rules,
  transition_rules,
  workspace_invitations,
  cards,
  columns,
  swimlanes,
  workspace_members,
  user_sessions,
  user_credentials,
  users,
  workspaces
RESTART IDENTITY CASCADE;

-- ══════════════════════════════════════════════════════════════════════
-- 1. Workspaces
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workspaces (id, name)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Product Launch'),
  ('550e8400-e29b-41d4-a716-446655440100', 'Bug Tracker');

-- ══════════════════════════════════════════════════════════════════════
-- 2. Users
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO users (id, email, name)
VALUES
  ('550e8400-e29b-41d4-a716-446655449999', 'admin@test.com',     'Admin User'),
  ('550e8400-e29b-41d4-a716-446655449998', 'alice@kanbrio.dev',  'Alice Silva'),
  ('550e8400-e29b-41d4-a716-446655449997', 'bob@kanbrio.dev',    'Bob Costa'),
  ('550e8400-e29b-41d4-a716-446655449996', 'carol@kanbrio.dev',  'Carol Dias');

INSERT INTO user_credentials (user_id, password_hash)
VALUES
  ('550e8400-e29b-41d4-a716-446655449999', '$argon2id$v=19$m=15360,t=2,p=1$ou79uxagxKunnW0If0ANLQ$c3aMDRgrVuIfrSLzvtCu2UUJxYGirsF/rMlSu4+3Lls'),
  ('550e8400-e29b-41d4-a716-446655449998', '$argon2id$v=19$m=15360,t=2,p=1$qe40D0Uw6E3Tozd80xq5JA$yn7k1VyVNRGe0llaiIJMuMVMZqi/20347N0pTBVSJFM'),
  ('550e8400-e29b-41d4-a716-446655449997', '$argon2id$v=19$m=15360,t=2,p=1$U4afz/NRnZeIFFsZCkRVCg$O1qIevRdoe0R0ftndei7iJUIZvkdfzNA0WVu7n/W5/M'),
  ('550e8400-e29b-41d4-a716-446655449996', '$argon2id$v=19$m=15360,t=2,p=1$/J6e3bbcWZNTH8zW21i3+g$EMU6cogoVg2ruwjZipOd8wSWRbZWKR++c+h1FT1RnMY');

INSERT INTO user_sessions (id, user_id, session_token, expires_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655448888', '550e8400-e29b-41d4-a716-446655449999', 'demo-session-admin-123456',  NOW() + INTERVAL '90 days'),
  ('550e8400-e29b-41d4-a716-446655448887', '550e8400-e29b-41d4-a716-446655449998', 'demo-session-alice-123456',  NOW() + INTERVAL '90 days'),
  ('550e8400-e29b-41d4-a716-446655448886', '550e8400-e29b-41d4-a716-446655449997', 'demo-session-bob-123456',    NOW() + INTERVAL '90 days'),
  ('550e8400-e29b-41d4-a716-446655448885', '550e8400-e29b-41d4-a716-446655449996', 'demo-session-carol-123456',  NOW() + INTERVAL '90 days');

-- ══════════════════════════════════════════════════════════════════════
-- 3. Workspace Members
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655449999', 'admin'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655449998', 'member'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655449997', 'member'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655449996', 'viewer'),
  ('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655449999', 'admin'),
  ('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655449998', 'admin'),
  ('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655449997', 'member'),
  ('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655449996', 'member');

-- ══════════════════════════════════════════════════════════════════════
-- 4. Columns
-- ══════════════════════════════════════════════════════════════════════

-- W1: Product Launch
INSERT INTO columns (id, workspace_id, title, position, wip_limit, is_done)
VALUES
  ('550e8400-e29b-41d4-a716-446655441001', '550e8400-e29b-41d4-a716-446655440000', 'Backlog',     0, NULL, FALSE),
  ('550e8400-e29b-41d4-a716-446655441002', '550e8400-e29b-41d4-a716-446655440000', 'To Do',       1,    5, FALSE),
  ('550e8400-e29b-41d4-a716-446655441003', '550e8400-e29b-41d4-a716-446655440000', 'In Progress', 2,    3, FALSE),
  ('550e8400-e29b-41d4-a716-446655441004', '550e8400-e29b-41d4-a716-446655440000', 'Review',      3,    3, FALSE),
  ('550e8400-e29b-41d4-a716-446655441005', '550e8400-e29b-41d4-a716-446655440000', 'Done',        4, NULL, TRUE);

-- W2: Bug Tracker
INSERT INTO columns (id, workspace_id, title, position, wip_limit, is_done)
VALUES
  ('550e8400-e29b-41d4-a716-446655441201', '550e8400-e29b-41d4-a716-446655440100', 'Triage',        0, NULL, FALSE),
  ('550e8400-e29b-41d4-a716-446655441202', '550e8400-e29b-41d4-a716-446655440100', 'Investigating', 1,    5, FALSE),
  ('550e8400-e29b-41d4-a716-446655441203', '550e8400-e29b-41d4-a716-446655440100', 'Fixing',        2,    3, FALSE),
  ('550e8400-e29b-41d4-a716-446655441204', '550e8400-e29b-41d4-a716-446655440100', 'Verifying',     3,    3, FALSE),
  ('550e8400-e29b-41d4-a716-446655441205', '550e8400-e29b-41d4-a716-446655440100', 'Closed',        4, NULL, TRUE);

-- ══════════════════════════════════════════════════════════════════════
-- 5. Swimlanes
-- ══════════════════════════════════════════════════════════════════════

-- W1: Product Launch
INSERT INTO swimlanes (id, workspace_id, title, position)
VALUES
  ('550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655440000', 'Standard',    0),
  ('550e8400-e29b-41d4-a716-446655441102', '550e8400-e29b-41d4-a716-446655440000', 'Expedite',    1),
  ('550e8400-e29b-41d4-a716-446655441103', '550e8400-e29b-41d4-a716-446655440000', 'Maintenance', 2);

-- W2: Bug Tracker
INSERT INTO swimlanes (id, workspace_id, title, position)
VALUES
  ('550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655440100', 'Standard',    0),
  ('550e8400-e29b-41d4-a716-446655441302', '550e8400-e29b-41d4-a716-446655440100', 'Expedite',    1),
  ('550e8400-e29b-41d4-a716-446655441303', '550e8400-e29b-41d4-a716-446655440100', 'Maintenance', 2);

-- ══════════════════════════════════════════════════════════════════════
-- 6. Cards
-- ══════════════════════════════════════════════════════════════════════

-- Helper refs for W1 (Product Launch):
--   Columns: 1001=Backlog, 1002=To Do, 1003=In Progress, 1004=Review, 1005=Done
--   Swimlanes: 1101=Standard, 1102=Expedite, 1103=Maintenance

-- Epic 1: Landing Page Redesign (no assignee — still being refined)
INSERT INTO cards (id, workspace_id, title, current_column_id, current_swimlane_id)
VALUES ('550e8400-e29b-41d4-a716-446655442001', '550e8400-e29b-41d4-a716-446655440000',
        'Epic: Landing Page Redesign',
        '550e8400-e29b-41d4-a716-446655441001',   -- Backlog
        '550e8400-e29b-41d4-a716-446655441101');  -- Standard

INSERT INTO cards (id, workspace_id, parent_id, title, current_column_id, current_swimlane_id, assigned_user_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655442011', '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655442001',
   'Design new hero section',
   '550e8400-e29b-41d4-a716-446655441002',   -- To Do
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   '550e8400-e29b-41d4-a716-446655449998'),  -- Alice
  ('550e8400-e29b-41d4-a716-446655442012', '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655442001',
   'Implement responsive layout',
   '550e8400-e29b-41d4-a716-446655441003',   -- In Progress
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   '550e8400-e29b-41d4-a716-446655449997'),  -- Bob
  ('550e8400-e29b-41d4-a716-446655442013', '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655442001',
   'Write copy for all sections',
   '550e8400-e29b-41d4-a716-446655441005',   -- Done
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   '550e8400-e29b-41d4-a716-446655449998'),  -- Alice
  ('550e8400-e29b-41d4-a716-446655442014', '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655442001',
   'Add scroll animations',
   '550e8400-e29b-41d4-a716-446655441001',   -- Backlog
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   NULL);

-- Epic 2: Payment Integration
INSERT INTO cards (id, workspace_id, title, current_column_id, current_swimlane_id)
VALUES ('550e8400-e29b-41d4-a716-446655442002', '550e8400-e29b-41d4-a716-446655440000',
        'Epic: Payment Integration',
        '550e8400-e29b-41d4-a716-446655441003',   -- In Progress
        '550e8400-e29b-41d4-a716-446655441101');  -- Standard

INSERT INTO cards (id, workspace_id, parent_id, title, current_column_id, current_swimlane_id, assigned_user_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655442021', '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655442002',
   'Integrate Stripe SDK',
   '550e8400-e29b-41d4-a716-446655441004',   -- Review
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   '550e8400-e29b-41d4-a716-446655449997'),  -- Bob
  ('550e8400-e29b-41d4-a716-446655442022', '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655442002',
   'Set up webhook handlers',
   '550e8400-e29b-41d4-a716-446655441003',   -- In Progress
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   '550e8400-e29b-41d4-a716-446655449998'),  -- Alice
  ('550e8400-e29b-41d4-a716-446655442023', '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655442002',
   'Test payment flow',
   '550e8400-e29b-41d4-a716-446655441002',   -- To Do
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   '550e8400-e29b-41d4-a716-446655449997');  -- Bob

-- Standalone cards — W1
INSERT INTO cards (id, workspace_id, title, current_column_id, current_swimlane_id, assigned_user_id,
                   is_blocked, blocked_by, blocked_at, blocked_reason)
VALUES ('550e8400-e29b-41d4-a716-446655442030', '550e8400-e29b-41d4-a716-446655440000',
        'Fix login redirect bug',
        '550e8400-e29b-41d4-a716-446655441003',   -- In Progress
        '550e8400-e29b-41d4-a716-446655441101',   -- Standard
        '550e8400-e29b-41d4-a716-446655449997',   -- Bob
        TRUE,
        '550e8400-e29b-41d4-a716-446655449998',   -- blocked_by: Alice
        NOW() - INTERVAL '2 days',
        'Waiting for design team to provide the new redirect flow spec.');

INSERT INTO cards (id, workspace_id, title, current_column_id, current_swimlane_id, assigned_user_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655442031', '550e8400-e29b-41d4-a716-446655440000',
   'Write API documentation',
   '550e8400-e29b-41d4-a716-446655441002',   -- To Do
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   '550e8400-e29b-41d4-a716-446655449996'),  -- Carol
  ('550e8400-e29b-41d4-a716-446655442032', '550e8400-e29b-41d4-a716-446655440000',
   'Performance audit',
   '550e8400-e29b-41d4-a716-446655441001',   -- Backlog
   '550e8400-e29b-41d4-a716-446655441101',   -- Standard
   NULL),
  ('550e8400-e29b-41d4-a716-446655442033', '550e8400-e29b-41d4-a716-446655440000',
   'Critical: SSL certificate renewal',
   '550e8400-e29b-41d4-a716-446655441005',   -- Done
   '550e8400-e29b-41d4-a716-446655441102',   -- Expedite
   '550e8400-e29b-41d4-a716-446655449999'),  -- Admin
  ('550e8400-e29b-41d4-a716-446655442034', '550e8400-e29b-41d4-a716-446655440000',
   'Database backup automation',
   '550e8400-e29b-41d4-a716-446655441002',   -- To Do
   '550e8400-e29b-41d4-a716-446655441103',   -- Maintenance
   NULL);

-- Archived card
INSERT INTO cards (id, workspace_id, title, current_column_id, current_swimlane_id,
                   is_archived, deleted_at)
VALUES ('550e8400-e29b-41d4-a716-446655442035', '550e8400-e29b-41d4-a716-446655440000',
        'Old feature flag cleanup',
        '550e8400-e29b-41d4-a716-446655441005',   -- Done
        '550e8400-e29b-41d4-a716-446655441101',   -- Standard
        TRUE, NOW() - INTERVAL '7 days');

-- Cards — W2 (Bug Tracker)
--   Columns: 1201=Triage, 1202=Investigating, 1203=Fixing, 1204=Verifying, 1205=Closed
--   Swimlanes: 1301=Standard, 1302=Expedite, 1303=Maintenance

INSERT INTO cards (id, workspace_id, title, current_column_id, current_swimlane_id, assigned_user_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655443001', '550e8400-e29b-41d4-a716-446655440100',
   'Login page crashes on Safari',
   '550e8400-e29b-41d4-a716-446655441201',   -- Triage
   '550e8400-e29b-41d4-a716-446655441301',   -- Standard
   NULL),
  ('550e8400-e29b-41d4-a716-446655443002', '550e8400-e29b-41d4-a716-446655440100',
   'Report export shows wrong totals',
   '550e8400-e29b-41d4-a716-446655441202',   -- Investigating
   '550e8400-e29b-41d4-a716-446655441301',   -- Standard
   '550e8400-e29b-41d4-a716-446655449997'),  -- Bob
  ('550e8400-e29b-41d4-a716-446655443003', '550e8400-e29b-41d4-a716-446655440100',
   'Null pointer in order processing',
   '550e8400-e29b-41d4-a716-446655441203',   -- Fixing
   '550e8400-e29b-41d4-a716-446655441301',   -- Standard
   '550e8400-e29b-41d4-a716-446655449998'),  -- Alice
  ('550e8400-e29b-41d4-a716-446655443004', '550e8400-e29b-41d4-a716-446655440100',
   'UI glitch on mobile menu',
   '550e8400-e29b-41d4-a716-446655441204',   -- Verifying
   '550e8400-e29b-41d4-a716-446655441301',   -- Standard
   '550e8400-e29b-41d4-a716-446655449997'),  -- Bob
  ('550e8400-e29b-41d4-a716-446655443005', '550e8400-e29b-41d4-a716-446655440100',
   'Typo in welcome email',
   '550e8400-e29b-41d4-a716-446655441205',   -- Closed
   '550e8400-e29b-41d4-a716-446655441301',   -- Standard
   '550e8400-e29b-41d4-a716-446655449996'),  -- Carol
  ('550e8400-e29b-41d4-a716-446655443006', '550e8400-e29b-41d4-a716-446655440100',
   'Memory leak on dashboard',
   '550e8400-e29b-41d4-a716-446655441203',   -- Fixing
   '550e8400-e29b-41d4-a716-446655441302',   -- Expedite
   '550e8400-e29b-41d4-a716-446655449998');  -- Alice

-- Sub-cards for Memory Leak (W2)
INSERT INTO cards (id, workspace_id, parent_id, title, current_column_id, current_swimlane_id, assigned_user_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655443011', '550e8400-e29b-41d4-a716-446655440100',
   '550e8400-e29b-41d4-a716-446655443006',
   'Profile heap usage in dashboard',
   '550e8400-e29b-41d4-a716-446655441203',   -- Fixing
   '550e8400-e29b-41d4-a716-446655441302',   -- Expedite
   '550e8400-e29b-41d4-a716-446655449997'),  -- Bob
  ('550e8400-e29b-41d4-a716-446655443012', '550e8400-e29b-41d4-a716-446655440100',
   '550e8400-e29b-41d4-a716-446655443006',
   'Fix component unmount cleanup',
   '550e8400-e29b-41d4-a716-446655441202',   -- Investigating
   '550e8400-e29b-41d4-a716-446655441302',   -- Expedite
   '550e8400-e29b-41d4-a716-446655449996');  -- Carol

-- ══════════════════════════════════════════════════════════════════════
-- 7. Checklists
-- ══════════════════════════════════════════════════════════════════════

-- Card 2013: Write copy for all sections (now Done — checklists completed)
INSERT INTO card_checklists (id, card_id, title, is_completed, position, completed_by, completed_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655445001', '550e8400-e29b-41d4-a716-446655442013',
   'Draft hero section copy',        TRUE,  0,
   '550e8400-e29b-41d4-a716-446655449998', NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655445002', '550e8400-e29b-41d4-a716-446655442013',
   'Draft feature list copy',        TRUE,  1,
   '550e8400-e29b-41d4-a716-446655449998', NOW() - INTERVAL '4 days'),
  ('550e8400-e29b-41d4-a716-446655445003', '550e8400-e29b-41d4-a716-446655442013',
   'Review with marketing team',     TRUE,  2,
   '550e8400-e29b-41d4-a716-446655449998', NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655445004', '550e8400-e29b-41d4-a716-446655442013',
   'Final proofread',                TRUE,  3,
   '550e8400-e29b-41d4-a716-446655449997', NOW() - INTERVAL '3 days');

-- Card 2030: Fix login redirect bug (Blocked — checklist partially done)
INSERT INTO card_checklists (id, card_id, title, is_completed, position, completed_by, completed_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655445011', '550e8400-e29b-41d4-a716-446655442030',
   'Reproduce the bug locally',      TRUE,  0,
   '550e8400-e29b-41d4-a716-446655449997', NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655445012', '550e8400-e29b-41d4-a716-446655442030',
   'Identify root cause',            TRUE,  1,
   '550e8400-e29b-41d4-a716-446655449997', NOW() - INTERVAL '2 days'),
  ('550e8400-e29b-41d4-a716-446655445013', '550e8400-e29b-41d4-a716-446655442030',
   'Implement fix',                  FALSE, 2, NULL, NULL),
  ('550e8400-e29b-41d4-a716-446655445014', '550e8400-e29b-41d4-a716-446655442030',
   'Write regression test',          FALSE, 3, NULL, NULL);

-- Card 2031: Write API documentation (To Do — no items started)
INSERT INTO card_checklists (id, card_id, title, is_completed, position)
VALUES
  ('550e8400-e29b-41d4-a716-446655445021', '550e8400-e29b-41d4-a716-446655442031',
   'Document authentication endpoints',   FALSE, 0),
  ('550e8400-e29b-41d4-a716-446655445022', '550e8400-e29b-41d4-a716-446655442031',
   'Document board endpoints',            FALSE, 1),
  ('550e8400-e29b-41d4-a716-446655445023', '550e8400-e29b-41d4-a716-446655442031',
   'Document analytics endpoints',        FALSE, 2),
  ('550e8400-e29b-41d4-a716-446655445024', '550e8400-e29b-41d4-a716-446655442031',
   'Add OpenAPI spec file',               FALSE, 3);

-- ══════════════════════════════════════════════════════════════════════
-- 8. Block Comments
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO card_block_comments (id, card_id, user_id, content)
VALUES
  ('550e8400-e29b-41d4-a716-446655446001',
   '550e8400-e29b-41d4-a716-446655442030',
   '550e8400-e29b-41d4-a716-446655449997',   -- Bob
   'Hey team, I need the new redirect flow design to proceed. Who owns this?'),
  ('550e8400-e29b-41d4-a716-446655446002',
   '550e8400-e29b-41d4-a716-446655442030',
   '550e8400-e29b-41d4-a716-446655449998',   -- Alice
   'The design spec is in Figma, I will share the link by tomorrow.'),
  ('550e8400-e29b-41d4-a716-446655446003',
   '550e8400-e29b-41d4-a716-446655442030',
   '550e8400-e29b-41d4-a716-446655449999',   -- Admin
   'Let me follow up with the design team. @Alice can you share what you have so far?');

-- ══════════════════════════════════════════════════════════════════════
-- 9. Card Transitions (Historical — enables analytics)
-- ══════════════════════════════════════════════════════════════════════

-- Card 2011: Design new hero section (Backlog → To Do)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447001',
   '550e8400-e29b-41d4-a716-446655442011',
   '550e8400-e29b-41d4-a716-446655449998', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441001',
   NULL, '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '28 days'),
  ('550e8400-e29b-41d4-a716-446655447002',
   '550e8400-e29b-41d4-a716-446655442011',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441001', '550e8400-e29b-41d4-a716-446655441002',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '14 days');

-- Card 2012: Implement responsive layout (Backlog → To Do → In Progress)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447003',
   '550e8400-e29b-41d4-a716-446655442012',
   '550e8400-e29b-41d4-a716-446655449997', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441001',
   NULL, '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '28 days'),
  ('550e8400-e29b-41d4-a716-446655447004',
   '550e8400-e29b-41d4-a716-446655442012',
   '550e8400-e29b-41d4-a716-446655449997', 'move',
   '550e8400-e29b-41d4-a716-446655441001', '550e8400-e29b-41d4-a716-446655441002',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '21 days'),
  ('550e8400-e29b-41d4-a716-446655447005',
   '550e8400-e29b-41d4-a716-446655442012',
   '550e8400-e29b-41d4-a716-446655449997', 'move',
   '550e8400-e29b-41d4-a716-446655441002', '550e8400-e29b-41d4-a716-446655441003',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '7 days');

-- Card 2013: Write copy for all sections (Backlog → To Do → In Progress → Review → Done)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447006',
   '550e8400-e29b-41d4-a716-446655442013',
   '550e8400-e29b-41d4-a716-446655449998', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441001',
   NULL, '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '28 days'),
  ('550e8400-e29b-41d4-a716-446655447007',
   '550e8400-e29b-41d4-a716-446655442013',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441001', '550e8400-e29b-41d4-a716-446655441002',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '21 days'),
  ('550e8400-e29b-41d4-a716-446655447008',
   '550e8400-e29b-41d4-a716-446655442013',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441002', '550e8400-e29b-41d4-a716-446655441003',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '14 days'),
  ('550e8400-e29b-41d4-a716-446655447009',
   '550e8400-e29b-41d4-a716-446655442013',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441003', '550e8400-e29b-41d4-a716-446655441004',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '7 days'),
  ('550e8400-e29b-41d4-a716-446655447010',
   '550e8400-e29b-41d4-a716-446655442013',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441004', '550e8400-e29b-41d4-a716-446655441005',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '3 days');

-- Card 2021: Integrate Stripe SDK (Backlog → To Do → In Progress → Review)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447011',
   '550e8400-e29b-41d4-a716-446655442021',
   '550e8400-e29b-41d4-a716-446655449997', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441001',
   NULL, '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '25 days'),
  ('550e8400-e29b-41d4-a716-446655447012',
   '550e8400-e29b-41d4-a716-446655442021',
   '550e8400-e29b-41d4-a716-446655449997', 'move',
   '550e8400-e29b-41d4-a716-446655441001', '550e8400-e29b-41d4-a716-446655441002',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '18 days'),
  ('550e8400-e29b-41d4-a716-446655447013',
   '550e8400-e29b-41d4-a716-446655442021',
   '550e8400-e29b-41d4-a716-446655449997', 'move',
   '550e8400-e29b-41d4-a716-446655441002', '550e8400-e29b-41d4-a716-446655441003',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655447014',
   '550e8400-e29b-41d4-a716-446655442021',
   '550e8400-e29b-41d4-a716-446655449997', 'move',
   '550e8400-e29b-41d4-a716-446655441003', '550e8400-e29b-41d4-a716-446655441004',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '2 days');

-- Card 2022: Set up webhook handlers (Backlog → To Do → In Progress)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447015',
   '550e8400-e29b-41d4-a716-446655442022',
   '550e8400-e29b-41d4-a716-446655449998', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441001',
   NULL, '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '20 days'),
  ('550e8400-e29b-41d4-a716-446655447016',
   '550e8400-e29b-41d4-a716-446655442022',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441001', '550e8400-e29b-41d4-a716-446655441002',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '12 days'),
  ('550e8400-e29b-41d4-a716-446655447017',
   '550e8400-e29b-41d4-a716-446655442022',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441002', '550e8400-e29b-41d4-a716-446655441003',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '4 days');

-- Card 2030: Fix login redirect bug — block events
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447018',
   '550e8400-e29b-41d4-a716-446655442030',
   '550e8400-e29b-41d4-a716-446655449997', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441003',
   NULL, '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655447019',
   '550e8400-e29b-41d4-a716-446655442030',
   '550e8400-e29b-41d4-a716-446655449998', 'block',
   '550e8400-e29b-41d4-a716-446655441003', '550e8400-e29b-41d4-a716-446655441003',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '2 days');

-- Card 2033: SSL certificate renewal (Expedite — done)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447020',
   '550e8400-e29b-41d4-a716-446655442033',
   '550e8400-e29b-41d4-a716-446655449999', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441002',
   NULL, '550e8400-e29b-41d4-a716-446655441102',
   NOW() - INTERVAL '4 days'),
  ('550e8400-e29b-41d4-a716-446655447021',
   '550e8400-e29b-41d4-a716-446655442033',
   '550e8400-e29b-41d4-a716-446655449999', 'move',
   '550e8400-e29b-41d4-a716-446655441002', '550e8400-e29b-41d4-a716-446655441003',
   '550e8400-e29b-41d4-a716-446655441102', '550e8400-e29b-41d4-a716-446655441102',
   NOW() - INTERVAL '2 days'),
  ('550e8400-e29b-41d4-a716-446655447022',
   '550e8400-e29b-41d4-a716-446655442033',
   '550e8400-e29b-41d4-a716-446655449999', 'move',
   '550e8400-e29b-41d4-a716-446655441003', '550e8400-e29b-41d4-a716-446655441005',
   '550e8400-e29b-41d4-a716-446655441102', '550e8400-e29b-41d4-a716-446655441102',
   NOW() - INTERVAL '1 day');

-- Card 2035: Archived
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447023',
   '550e8400-e29b-41d4-a716-446655442035',
   '550e8400-e29b-41d4-a716-446655449997', 'archive',
   '550e8400-e29b-41d4-a716-446655441005', '550e8400-e29b-41d4-a716-446655441005',
   '550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655441101',
   NOW() - INTERVAL '7 days');

-- W2 transitions
-- Card 3003: Null pointer in order processing (Triage → Investigating → Fixing)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447024',
   '550e8400-e29b-41d4-a716-446655443003',
   '550e8400-e29b-41d4-a716-446655449998', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441201',
   NULL, '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '6 days'),
  ('550e8400-e29b-41d4-a716-446655447025',
   '550e8400-e29b-41d4-a716-446655443003',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441201', '550e8400-e29b-41d4-a716-446655441202',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '4 days'),
  ('550e8400-e29b-41d4-a716-446655447026',
   '550e8400-e29b-41d4-a716-446655443003',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441202', '550e8400-e29b-41d4-a716-446655441203',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '1 day');

-- Card 3004: UI glitch on mobile menu (Triage → Investigating → Verifying)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447027',
   '550e8400-e29b-41d4-a716-446655443004',
   '550e8400-e29b-41d4-a716-446655449997', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441201',
   NULL, '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '14 days'),
  ('550e8400-e29b-41d4-a716-446655447028',
   '550e8400-e29b-41d4-a716-446655443004',
   '550e8400-e29b-41d4-a716-446655449997', 'move',
   '550e8400-e29b-41d4-a716-446655441201', '550e8400-e29b-41d4-a716-446655441202',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655447029',
   '550e8400-e29b-41d4-a716-446655443004',
   '550e8400-e29b-41d4-a716-446655449997', 'move',
   '550e8400-e29b-41d4-a716-446655441202', '550e8400-e29b-41d4-a716-446655441204',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '2 days');

-- Card 3005: Typo in welcome email (Triage → Investigating → Fixing → Verifying → Closed)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447030',
   '550e8400-e29b-41d4-a716-446655443005',
   '550e8400-e29b-41d4-a716-446655449996', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441201',
   NULL, '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '20 days'),
  ('550e8400-e29b-41d4-a716-446655447031',
   '550e8400-e29b-41d4-a716-446655443005',
   '550e8400-e29b-41d4-a716-446655449996', 'move',
   '550e8400-e29b-41d4-a716-446655441201', '550e8400-e29b-41d4-a716-446655441202',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '15 days'),
  ('550e8400-e29b-41d4-a716-446655447032',
   '550e8400-e29b-41d4-a716-446655443005',
   '550e8400-e29b-41d4-a716-446655449996', 'move',
   '550e8400-e29b-41d4-a716-446655441202', '550e8400-e29b-41d4-a716-446655441203',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655447033',
   '550e8400-e29b-41d4-a716-446655443005',
   '550e8400-e29b-41d4-a716-446655449996', 'move',
   '550e8400-e29b-41d4-a716-446655441203', '550e8400-e29b-41d4-a716-446655441204',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655447034',
   '550e8400-e29b-41d4-a716-446655443005',
   '550e8400-e29b-41d4-a716-446655449996', 'move',
   '550e8400-e29b-41d4-a716-446655441204', '550e8400-e29b-41d4-a716-446655441205',
   '550e8400-e29b-41d4-a716-446655441301', '550e8400-e29b-41d4-a716-446655441301',
   NOW() - INTERVAL '1 day');

-- Card 3006: Memory leak on dashboard (Expedite — Triage → Fixing)
INSERT INTO card_transitions (id, card_id, user_id, transition_type,
                              from_column_id, to_column_id,
                              from_swimlane_id, to_swimlane_id,
                              occurred_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655447035',
   '550e8400-e29b-41d4-a716-446655443006',
   '550e8400-e29b-41d4-a716-446655449998', 'create',
   NULL, '550e8400-e29b-41d4-a716-446655441201',
   NULL, '550e8400-e29b-41d4-a716-446655441302',
   NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655447036',
   '550e8400-e29b-41d4-a716-446655443006',
   '550e8400-e29b-41d4-a716-446655449998', 'move',
   '550e8400-e29b-41d4-a716-446655441201', '550e8400-e29b-41d4-a716-446655441203',
   '550e8400-e29b-41d4-a716-446655441302', '550e8400-e29b-41d4-a716-446655441302',
   NOW() - INTERVAL '1 day');

-- ══════════════════════════════════════════════════════════════════════
-- 10. Business Rules & Transition Rules
-- ══════════════════════════════════════════════════════════════════════

-- Transition rules — W1
INSERT INTO transition_rules (id, workspace_id, column_id, rule_type, criteria_type)
VALUES
  ('550e8400-e29b-41d4-a716-446655448001',
   '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655441004',  -- Review
   'arrival', 'checklist_completed'),
  ('550e8400-e29b-41d4-a716-446655448002',
   '550e8400-e29b-41d4-a716-446655440000',
   '550e8400-e29b-41d4-a716-446655441003',  -- In Progress
   'arrival', 'assignee_required');

-- Business rules — W1 (auto-move parent when all children reach Done)
INSERT INTO business_rules (id, workspace_id, name, trigger_type, trigger_config, action_type, action_config)
VALUES
  ('550e8400-e29b-41d4-a716-446655449001',
   '550e8400-e29b-41d4-a716-446655440000',
   'Auto-close epic when all subtasks are Done',
   'child_status_changed',
   '{"target_column_ids": ["550e8400-e29b-41d4-a716-446655441005"]}',
   'move_parent_card',
   '{"target_column_id": "550e8400-e29b-41d4-a716-446655441005"}');

-- Business rules — W2 (auto-assign when card enters Fixing)
INSERT INTO business_rules (id, workspace_id, name, trigger_type, trigger_config, action_type, action_config)
VALUES
  ('550e8400-e29b-41d4-a716-446655449002',
   '550e8400-e29b-41d4-a716-446655440100',
   'Auto-assign to Bob when moved to Fixing',
   'card_entered_column',
   '{"column_id": "550e8400-e29b-41d4-a716-446655441203"}',
   'assign_card',
   '{"user_id": "550e8400-e29b-41d4-a716-446655449997"}');

-- ══════════════════════════════════════════════════════════════════════

COMMIT;
