import { test, expect } from '@playwright/test';

test.describe('Arrival & Departure Rules E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication endpoints to bypass login redirect
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
            { id: 'ws-1', name: 'Rule Workspace', role: 'admin' }
          ]
        })
      });
    });

    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'ws-1', name: 'Rule Workspace', role: 'admin' }
        ])
      });
    });
  });

  test('should render active column rules and checklist items on card', async ({ page }) => {
    // Mock fetchBoardState response to include checklists and transition_rules
    await page.route('**/api/workspaces/*/board', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns: [
            { id: 'col-todo', workspace_id: 'ws-1', title: 'To Do', position: 0, wip_limit: null, is_done: false },
            { id: 'col-doing', workspace_id: 'ws-1', title: 'Doing', position: 1, wip_limit: null, is_done: false }
          ],
          swimlanes: [
            { id: 'lane-1', workspace_id: 'ws-1', title: 'Standard', position: 0, wip_limit: null }
          ],
          cards: [
            { id: 'card-1', parent_id: null, workspace_id: 'ws-1', title: 'Test Card', current_column_id: 'col-todo', current_swimlane_id: 'lane-1', assigned_user_id: null, is_blocked: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ],
          checklists: [
            { id: 'chk-1', card_id: 'card-1', title: 'Checklist Task 1', is_completed: false, position: 0, completed_by: null, completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ],
          transition_rules: [
            { id: 'rule-1', workspace_id: 'ws-1', column_id: 'col-doing', rule_type: 'arrival', criteria_type: 'assignee_required', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ]
        })
      });
    });

    await page.goto('/w/ws-1');

    // Verify policy badge on "Doing" column header
    const ruleIndicator = page.getByTestId('column-rule-indicator-col-doing');
    await expect(ruleIndicator).toBeVisible();

    // Verify checklist item is visible on card
    const checklistContainer = page.getByTestId('card-checklist-container');
    await expect(checklistContainer).toBeVisible();
    await expect(checklistContainer).toContainText('Checklist Task 1');
  });

  test('should reject drop and trigger shake and Toast notification on policy violation', async ({ page }) => {
    // Mock board state and a failed move (422)
    await page.route('**/api/workspaces/*/board', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns: [
            { id: 'col-todo', workspace_id: 'ws-1', title: 'To Do', position: 0, wip_limit: null, is_done: false },
            { id: 'col-doing', workspace_id: 'ws-1', title: 'Doing', position: 1, wip_limit: null, is_done: false }
          ],
          swimlanes: [
            { id: 'lane-1', workspace_id: 'ws-1', title: 'Standard', position: 0, wip_limit: null }
          ],
          cards: [
            { id: 'card-1', parent_id: null, workspace_id: 'ws-1', title: 'Test Card', current_column_id: 'col-todo', current_swimlane_id: 'lane-1', assigned_user_id: null, is_blocked: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ],
          checklists: [],
          transition_rules: [
            { id: 'rule-1', workspace_id: 'ws-1', column_id: 'col-doing', rule_type: 'arrival', criteria_type: 'assignee_required', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ]
        })
      });
    });

    // Mock move failure (422)
    await page.route('**/api/workspaces/*/cards/card-1/move', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Assignee is required before entering Doing' })
      });
    });

    await page.goto('/w/ws-1');

    const card = page.getByLabel('Card: Test Card');
    const targetZone = page.getByTestId('column-zone-Doing').first();

    // Drag card to Doing
    await card.dragTo(targetZone);

    // Verify red alert toast is visible
    const toast = page.getByTestId('rule-violation-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Assignee is required/);

    // Verify card shakes (class includes animate-shake)
    const cardEl = page.locator('div[role="listitem"]').first();
    await expect(cardEl).toHaveClass(/animate-shake/);
  });
});
