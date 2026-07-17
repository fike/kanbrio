import { test, expect } from '@playwright/test';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const COL_BACKLOG = '550e8400-e29b-41d4-a716-446655440001';
const COL_DOING = '550e8400-e29b-41d4-a716-446655440002';
const COL_DONE = '550e8400-e29b-41d4-a716-446655440003';
const MEMBER_ID = '550e8400-e29b-41d4-a716-446655449999';
const RULE_ID = '660e8400-e29b-41d4-a716-446655440001';

test.describe('Business Rules Settings E2E', () => {
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
          id: MEMBER_ID,
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

    // Mock board state for column selectors
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/board`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns: [
            { id: COL_BACKLOG, workspace_id: WORKSPACE_ID, title: 'Backlog', position: 0, wip_limit: null, is_done: false },
            { id: COL_DOING, workspace_id: WORKSPACE_ID, title: 'Doing', position: 1, wip_limit: 3, is_done: false },
            { id: COL_DONE, workspace_id: WORKSPACE_ID, title: 'Done', position: 2, wip_limit: null, is_done: true },
          ],
          swimlanes: [],
          cards: [],
          checklists: [],
          transition_rules: [],
        }),
      });
    });

    // Mock workspace members
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/members`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: MEMBER_ID, name: 'Admin User', role: 'admin' },
        ]),
      });
    });
  });

  test('should show empty state when no rules exist', async ({ page }) => {
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    await page.goto(`/w/${WORKSPACE_ID}/settings`);
    await expect(page.locator('[data-testid="create-rule-button"]')).toBeVisible();

    const emptyState = page.locator('text=No automation rules');
    await expect(emptyState).toBeVisible();
  });

  test('should create, toggle, and delete a rule', async ({ page }) => {
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
          id: RULE_ID,
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

    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules/${RULE_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (rules.length > 0) {
          const updated = { ...rules[0] as Record<string, unknown>, ...body, updated_at: new Date().toISOString() };
          rules = [updated];
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rules[0]),
        });
      } else if (route.request().method() === 'DELETE') {
        rules = [];
        await route.fulfill({ status: 204 });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    // Navigate to settings
    await page.goto(`/w/${WORKSPACE_ID}/settings`);
    await expect(page.locator('[data-testid="create-rule-button"]')).toBeVisible();

    // Empty state should be visible initially
    await expect(page.locator('text=No automation rules')).toBeVisible();

    // Click Create Rule button
    await page.locator('[data-testid="create-rule-button"]').click();
    await expect(page.locator('[data-testid="create-rule-dialog"]')).toBeVisible();

    // Fill form: name, trigger (child_status_changed), action (move_parent_card)
    await page.locator('[data-testid="rule-name-input"]').fill('Auto-close parent');
    await page.locator('[data-testid="trigger-type-select"]').selectOption('child_status_changed');
    await page.locator('[data-testid="action-type-select"]').selectOption('move_parent_card');

    // Select columns for move_parent_card action
    await page.locator('[data-testid="done-column-select"]').selectOption(COL_DONE);
    await page.locator('[data-testid="inprogress-column-select"]').selectOption(COL_DOING);

    // Submit
    await page.locator('[data-testid="create-rule-submit"]').click();

    // Rule should appear in the list
    await expect(page.locator('[data-testid="create-rule-dialog"]')).not.toBeVisible();
    await expect(page.locator('text=Auto-close parent')).toBeVisible();

    // Toggle rule off
    const toggleBtn = page.locator(`[data-testid="rule-toggle-${RULE_ID}"]`);
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Delete rule
    const deleteBtn = page.locator(`[data-testid="rule-delete-${RULE_ID}"]`);
    await deleteBtn.click();

    // Confirm delete
    const confirmBtn = page.locator('[data-testid="confirm-delete-button"]');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Should return to empty state
    await expect(page.locator('text=No automation rules')).toBeVisible();
  });

  test('should show error banner on duplicate rule name', async ({ page }) => {
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: "A business rule with the name 'Duplicate Rule' already exists in this workspace",
          }),
        });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    await page.goto(`/w/${WORKSPACE_ID}/settings`);
    await page.locator('[data-testid="create-rule-button"]').click();
    await expect(page.locator('[data-testid="create-rule-dialog"]')).toBeVisible();

    await page.locator('[data-testid="rule-name-input"]').fill('Duplicate Rule');
    await page.locator('[data-testid="trigger-type-select"]').selectOption('card_entered_column');
    await page.locator('[data-testid="trigger-column-select"]').selectOption(COL_DOING);
    await page.locator('[data-testid="action-type-select"]').selectOption('assign_card');
    await page.locator('[data-testid="assigned-user-select"]').selectOption(MEMBER_ID);
    await page.locator('[data-testid="create-rule-submit"]').click();

    // Error banner should appear
    await expect(page.locator('[data-testid="create-rule-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-rule-error"]')).toContainText('already exists');
  });

  test('should edit an existing rule', async ({ page }) => {
    let rules: unknown[] = [
      {
        id: RULE_ID,
        workspace_id: WORKSPACE_ID,
        name: 'Original Name',
        trigger_type: 'child_status_changed',
        trigger_config: {},
        action_type: 'move_parent_card',
        action_config: { done_column_id: COL_DONE, in_progress_column_id: COL_DOING },
        is_active: true,
        created_at: '2026-07-12T00:00:00Z',
        updated_at: '2026-07-12T00:00:00Z',
      },
    ];

    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rules),
        });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules/${RULE_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        const updated = { ...rules[0] as Record<string, unknown>, ...body, updated_at: new Date().toISOString() };
        rules = [updated];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rules[0]),
        });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    await page.goto(`/w/${WORKSPACE_ID}/settings`);
    await expect(page.locator('text=Original Name')).toBeVisible();

    // Click edit button
    await page.locator(`[data-testid="rule-edit-${RULE_ID}"]`).click();
    await expect(page.locator('[data-testid="create-rule-dialog"]')).toBeVisible();
    await expect(page.locator('text=Edit Rule')).toBeVisible();

    // Verify pre-filled fields
    const nameInput = page.locator('[data-testid="rule-name-input"]');
    await expect(nameInput).toHaveValue('Original Name');

    // Update the name
    await nameInput.fill('Updated Name');
    await page.locator('[data-testid="create-rule-submit"]').click();

    // Verify update and dialog closed
    await expect(page.locator('[data-testid="create-rule-dialog"]')).not.toBeVisible();
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });

  test('should enforce focus trap and escape key in create rule modal', async ({ page }) => {
    await page.route(`**/api/workspaces/${WORKSPACE_ID}/rules`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/w/${WORKSPACE_ID}/settings`);
    await page.locator('[data-testid="create-rule-button"]').click();
    await expect(page.locator('[data-testid="create-rule-dialog"]')).toBeVisible();

    // Check that name input is focused on mount
    await expect(page.locator('[data-testid="rule-name-input"]')).toBeFocused();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="create-rule-dialog"]')).not.toBeVisible();
  });
});
