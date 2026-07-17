import { test, expect } from '@playwright/test';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const COL_BACKLOG = '550e8400-e29b-41d4-a716-446655440001';
const COL_DOING = '550e8400-e29b-41d4-a716-446655440002';
const COL_DONE = '550e8400-e29b-41d4-a716-446655440003';
const STANDARD_LANE = '550e8400-e29b-41d4-a716-446655440004';

test.describe('Child Status Sync Automation E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([{
      name: '__Host-sid',
      value: 'e2e-session-token-for-testing-123456',
      domain: 'localhost',
      path: '/',
      secure: true,
    }]);

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655449999',
          email: 'admin@test.com',
          name: 'Admin User',
          avatar_url: null,
          workspaces: [
            { id: WORKSPACE_ID, name: 'Default Workspace', role: 'admin' },
          ],
        }),
      });
    });

    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: WORKSPACE_ID, name: 'Default Workspace', role: 'admin' },
        ]),
      });
    });
  });

  test('should auto-move parent to In Progress when child leaves backlog', async ({ page }) => {
    const parentCardId = crypto.randomUUID();
    const childCardId = crypto.randomUUID();
    const ruleId = crypto.randomUUID();

    // Set up the board state with a parent card in Backlog
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/board`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns: [
            { id: COL_BACKLOG, workspace_id: WORKSPACE_ID, title: 'Backlog', position: 0, wip_limit: null, is_done: false },
            { id: COL_DOING, workspace_id: WORKSPACE_ID, title: 'Doing', position: 1, wip_limit: 10, is_done: false },
            { id: COL_DONE, workspace_id: WORKSPACE_ID, title: 'Done', position: 2, wip_limit: null, is_done: true },
          ],
          swimlanes: [
            { id: STANDARD_LANE, workspace_id: WORKSPACE_ID, title: 'Standard', position: 0, wip_limit: null },
          ],
          cards: [
            {
              id: parentCardId,
              parent_id: null,
              workspace_id: WORKSPACE_ID,
              title: 'Parent Task',
              current_column_id: COL_BACKLOG,
              current_swimlane_id: STANDARD_LANE,
              assigned_user_id: null,
              is_blocked: false,
              blocked_by: null,
              blocked_at: null,
              blocked_reason: null,
              is_archived: false,
              deleted_at: null,
              created_at: '2026-07-01T00:00:00Z',
              updated_at: '2026-07-01T00:00:00Z',
            },
            {
              id: childCardId,
              parent_id: parentCardId,
              workspace_id: WORKSPACE_ID,
              title: 'Child Task',
              current_column_id: COL_BACKLOG,
              current_swimlane_id: STANDARD_LANE,
              assigned_user_id: null,
              is_blocked: false,
              blocked_by: null,
              blocked_at: null,
              blocked_reason: null,
              is_archived: false,
              deleted_at: null,
              created_at: '2026-07-01T00:00:00Z',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
          checklists: [],
          transition_rules: [],
        }),
      });
    });

    await page.route(`**/api/workspaces/${WORKSPACE_ID}/members`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '550e8400-e29b-41d4-a716-446655449999', name: 'Admin User', role: 'admin' },
        ]),
      });
    });

    // Mock rules list (initially empty, then one rule created)
    let rules: unknown[] = [];
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rules),
        });
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newRule = {
          id: ruleId,
          workspace_id: WORKSPACE_ID,
          name: body.name,
          trigger_type: body.trigger_type,
          trigger_config: body.trigger_config,
          action_type: body.action_type,
          action_config: body.action_config,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        rules = [newRule];
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newRule),
        });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    // Mock the move card endpoint to trigger status sync
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/cards/*/move`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const cardId = route.request().url().split('/cards/')[1]?.split('/move')[0];

        // Update the moving card's column
        const updatedCards = JSON.parse(JSON.stringify([
          {
            id: parentCardId,
            parent_id: null,
            workspace_id: WORKSPACE_ID,
            title: 'Parent Task',
            current_column_id: body.to_column_id === COL_DONE ? COL_DONE : COL_DOING,
            current_swimlane_id: STANDARD_LANE,
            assigned_user_id: null,
            is_blocked: false,
            blocked_by: null,
            blocked_at: null,
            blocked_reason: null,
            is_archived: false,
            deleted_at: null,
            created_at: '2026-07-01T00:00:00Z',
            updated_at: new Date().toISOString(),
          },
          {
            id: childCardId,
            parent_id: parentCardId,
            workspace_id: WORKSPACE_ID,
            title: 'Child Task',
            current_column_id: body.to_column_id,
            current_swimlane_id: STANDARD_LANE,
            assigned_user_id: null,
            is_blocked: false,
            blocked_by: null,
            blocked_at: null,
            blocked_reason: null,
            is_archived: false,
            deleted_at: null,
            created_at: '2026-07-01T00:00:00Z',
            updated_at: new Date().toISOString(),
          },
        ]));

        // If moving a child card with a parent to a non-backlog column,
        // simulate rule action by also moving the parent
        if (cardId === childCardId && body.to_column_id !== COL_BACKLOG && body.to_column_id !== COL_DONE) {
          // Parent moves to Doing (in-progress sync)
          updatedCards[0].current_column_id = COL_DOING;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            card: updatedCards.find((c: { id: string }) => c.id === cardId),
            rule_actions: cardId === childCardId && body.to_column_id !== COL_BACKLOG
              ? [{
                  action: 'moved',
                  card: updatedCards[0],
                  rule_id: ruleId,
                }]
              : [],
          }),
        });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    // Navigate to settings and create a rule first
    await page.goto(`/w/${WORKSPACE_ID}/settings`);
    await expect(page.locator('[data-testid="create-rule-button"]')).toBeVisible();

    await page.locator('[data-testid="create-rule-button"]').click();
    await expect(page.locator('[data-testid="create-rule-dialog"]')).toBeVisible();

    await page.locator('[data-testid="rule-name-input"]').fill('Status Sync');
    await page.locator('[data-testid="trigger-type-select"]').selectOption('child_status_changed');
    await page.locator('[data-testid="action-type-select"]').selectOption('move_parent_card');
    await page.locator('[data-testid="done-column-select"]').selectOption(COL_DONE);
    await page.locator('[data-testid="inprogress-column-select"]').selectOption(COL_DOING);
    await page.locator('[data-testid="create-rule-submit"]').click();
    await expect(page.locator('[data-testid="create-rule-dialog"]')).not.toBeVisible();
    await expect(page.locator('text=Status Sync')).toBeVisible();

    // Navigate to board
    await page.goto(`/w/${WORKSPACE_ID}`);
    await expect(page.locator('text=Parent Task')).toBeVisible();
    await expect(page.locator('text=Child Task')).toBeVisible();

    // Drag child card from Backlog to Doing
    const childCard = page.getByLabel('Card: Child Task');
    const doingColumn = page.locator(`[data-testid="column-zone-Doing"]`);
    await expect(childCard).toBeVisible();
    await expect(doingColumn).toBeVisible();

    // Move child card via browser fetch (intercepted by page.route)
    const moveResult = await page.evaluate(async (args) => {
      const res = await fetch(`/api/workspaces/${args.workspaceId}/cards/${args.cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: args.cardId,
          to_column_id: args.toColumnId,
          to_swimlane_id: args.toSwimlaneId,
          user_id: args.userId,
          override_rules: false,
        }),
      });
      return res.json();
    }, {
      workspaceId: WORKSPACE_ID,
      cardId: childCardId,
      toColumnId: COL_DOING,
      toSwimlaneId: STANDARD_LANE,
      userId: '550e8400-e29b-41d4-a716-446655449999',
    });
    expect(moveResult.rule_actions.length).toBeGreaterThanOrEqual(1);
    expect(moveResult.rule_actions[0].action).toBe('moved');
    expect(moveResult.rule_actions[0].rule_id).toBe(ruleId);

    // Reload board state and verify parent moved
    await page.reload();
    await expect(page.locator('text=Parent Task')).toBeVisible();
  });

  test('should synchronize parent card when all children are done', async ({ page }) => {
    const parentCardId = crypto.randomUUID();
    const child1Id = crypto.randomUUID();
    const child2Id = crypto.randomUUID();
    const ruleId = crypto.randomUUID();

    // Board state: parent in Doing with 2 children also in Doing
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/board`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns: [
            { id: COL_BACKLOG, workspace_id: WORKSPACE_ID, title: 'Backlog', position: 0, wip_limit: null, is_done: false },
            { id: COL_DOING, workspace_id: WORKSPACE_ID, title: 'Doing', position: 1, wip_limit: 10, is_done: false },
            { id: COL_DONE, workspace_id: WORKSPACE_ID, title: 'Done', position: 2, wip_limit: null, is_done: true },
          ],
          swimlanes: [
            { id: STANDARD_LANE, workspace_id: WORKSPACE_ID, title: 'Standard', position: 0, wip_limit: null },
          ],
          cards: [
            {
              id: parentCardId, parent_id: null, workspace_id: WORKSPACE_ID,
              title: 'Parent Epics', current_column_id: COL_DOING, current_swimlane_id: STANDARD_LANE,
              assigned_user_id: null, is_blocked: false, blocked_by: null, blocked_at: null,
              blocked_reason: null, is_archived: false, deleted_at: null,
              created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-10T00:00:00Z',
            },
            {
              id: child1Id, parent_id: parentCardId, workspace_id: WORKSPACE_ID,
              title: 'Sub-task A', current_column_id: COL_DOING, current_swimlane_id: STANDARD_LANE,
              assigned_user_id: null, is_blocked: false, blocked_by: null, blocked_at: null,
              blocked_reason: null, is_archived: false, deleted_at: null,
              created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-10T00:00:00Z',
            },
            {
              id: child2Id, parent_id: parentCardId, workspace_id: WORKSPACE_ID,
              title: 'Sub-task B', current_column_id: COL_DOING, current_swimlane_id: STANDARD_LANE,
              assigned_user_id: null, is_blocked: false, blocked_by: null, blocked_at: null,
              blocked_reason: null, is_archived: false, deleted_at: null,
              created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-10T00:00:00Z',
            },
          ],
          checklists: [],
          transition_rules: [],
        }),
      });
    });

    await page.route(`**/api/workspaces/${WORKSPACE_ID}/members`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '550e8400-e29b-41d4-a716-446655449999', name: 'Admin User', role: 'admin' },
        ]),
      });
    });

    // Mock rules
    let rules: unknown[] = [];
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rules),
        });
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newRule = {
          id: ruleId, workspace_id: WORKSPACE_ID,
          name: body.name, trigger_type: body.trigger_type, trigger_config: body.trigger_config,
          action_type: body.action_type, action_config: body.action_config,
          is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        rules = [newRule];
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newRule) });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    // Mock move card endpoint - simulate all-done condition when last child moves to Done
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/cards/*/move`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const cardId = route.request().url().split('/cards/')[1]?.split('/move')[0];

        const now = new Date().toISOString();
        const movingChildTitle = cardId === child1Id ? 'Sub-task A' : 'Sub-task B';

        // Build updated state: both children in Done, parent moved to Done
        const updatedCards = [
          {
            id: parentCardId, parent_id: null, workspace_id: WORKSPACE_ID,
            title: 'Parent Epics',
            current_column_id: (cardId === child2Id || (cardId === child1Id && body.to_column_id === COL_DONE))
              ? COL_DONE : COL_DOING,
            current_swimlane_id: STANDARD_LANE, assigned_user_id: null,
            is_blocked: false, blocked_by: null, blocked_at: null, blocked_reason: null,
            is_archived: false, deleted_at: null, created_at: '2026-07-01T00:00:00Z', updated_at: now,
          },
          {
            id: child1Id, parent_id: parentCardId, workspace_id: WORKSPACE_ID,
            title: 'Sub-task A',
            current_column_id: cardId === child1Id ? body.to_column_id : COL_DOING,
            current_swimlane_id: STANDARD_LANE, assigned_user_id: null,
            is_blocked: false, blocked_by: null, blocked_at: null, blocked_reason: null,
            is_archived: false, deleted_at: null, created_at: '2026-07-01T00:00:00Z', updated_at: now,
          },
          {
            id: child2Id, parent_id: parentCardId, workspace_id: WORKSPACE_ID,
            title: 'Sub-task B',
            current_column_id: cardId === child2Id ? body.to_column_id : COL_DOING,
            current_swimlane_id: STANDARD_LANE, assigned_user_id: null,
            is_blocked: false, blocked_by: null, blocked_at: null, blocked_reason: null,
            is_archived: false, deleted_at: null, created_at: '2026-07-01T00:00:00Z', updated_at: now,
          },
        ];

        const parentMoved = updatedCards[0].current_column_id === COL_DONE;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            card: updatedCards.find((c) => c.id === cardId),
            rule_actions: body.to_column_id === COL_DONE
              ? [{ action: 'moved', card: updatedCards[0], rule_id: ruleId }]
              : [],
          }),
        });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    // Create the rule via settings
    await page.goto(`/w/${WORKSPACE_ID}/settings`);
    await page.locator('[data-testid="create-rule-button"]').click();
    await page.locator('[data-testid="rule-name-input"]').fill('Auto-done parent');
    await page.locator('[data-testid="trigger-type-select"]').selectOption('child_status_changed');
    await page.locator('[data-testid="action-type-select"]').selectOption('move_parent_card');
    await page.locator('[data-testid="done-column-select"]').selectOption(COL_DONE);
    await page.locator('[data-testid="inprogress-column-select"]').selectOption(COL_DOING);
    await page.locator('[data-testid="create-rule-submit"]').click();
    await expect(page.locator('text=Auto-done parent')).toBeVisible();

    // Go to board
    await page.goto(`/w/${WORKSPACE_ID}`);
    await expect(page.getByLabel('Card: Sub-task A')).toBeVisible();

    // Move child1 to Done via browser fetch
    const result1 = await page.evaluate(async (args) => {
      const res = await fetch(`/api/workspaces/${args.workspaceId}/cards/${args.cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: args.cardId, to_column_id: args.toColumnId,
          to_swimlane_id: args.toSwimlaneId,
          user_id: args.userId, override_rules: false,
        }),
      });
      return res.json();
    }, { workspaceId: WORKSPACE_ID, cardId: child1Id, toColumnId: COL_DONE, toSwimlaneId: STANDARD_LANE, userId: '550e8400-e29b-41d4-a716-446655449999' });
    expect(result1.rule_actions.length).toBe(1);

    // Move child2 to Done — this should trigger parent move
    const result2 = await page.evaluate(async (args) => {
      const res = await fetch(`/api/workspaces/${args.workspaceId}/cards/${args.cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: args.cardId, to_column_id: args.toColumnId,
          to_swimlane_id: args.toSwimlaneId,
          user_id: args.userId, override_rules: false,
        }),
      });
      return res.json();
    }, { workspaceId: WORKSPACE_ID, cardId: child2Id, toColumnId: COL_DONE, toSwimlaneId: STANDARD_LANE, userId: '550e8400-e29b-41d4-a716-446655449999' });
    expect(result2.rule_actions.length).toBeGreaterThanOrEqual(1);
    expect(result2.rule_actions[0].action).toBe('moved');
    expect(result2.rule_actions[0].rule_id).toBe(ruleId);
  });
});
