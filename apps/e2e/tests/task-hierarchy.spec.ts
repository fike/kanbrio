import { test, expect } from '@playwright/test';

test.describe('Task Hierarchy & Decomposition E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set authenticated session cookie for real backend requests
    await context.addCookies([{
      name: '__Host-sid',
      value: 'e2e-session-token-for-testing-123456',
      domain: 'localhost',
      path: '/',
      secure: true
    }]);

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
            { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Default Workspace', role: 'admin' }
          ]
        })
      });
    });

    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Default Workspace', role: 'admin' }
        ])
      });
    });
  });

  test('should display parent badge, scroll/focus/flash on click, show subtask counts, and render decomposition panel', async ({ page }) => {
    // Mock the board state request to return cards with a hierarchy relation
    await page.route('**/api/workspaces/550e8400-e29b-41d4-a716-446655440000/board', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns: [
            { id: 'col-1', workspace_id: 'w-1', title: 'To Do', position: 1, wip_limit: null, is_done: false },
            { id: 'col-2', workspace_id: 'w-1', title: 'Doing', position: 2, wip_limit: null, is_done: false },
            { id: 'col-3', workspace_id: 'w-1', title: 'Done', position: 3, wip_limit: null, is_done: true },
          ],
          swimlanes: [
            { id: 'lane-1', workspace_id: 'w-1', title: 'Default', position: 1, wip_limit: null },
          ],
          cards: [
            {
              id: 'parent-id-1234567890',
              parent_id: null,
              workspace_id: 'w-1',
              title: 'Epic Parent Task',
              current_column_id: 'col-1',
              current_swimlane_id: 'lane-1',
              assigned_user_id: null,
              is_blocked: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'child-id-1234567890',
              parent_id: 'parent-id-1234567890',
              workspace_id: 'w-1',
              title: 'Decomposed Child Task',
              current_column_id: 'col-2',
              current_swimlane_id: 'lane-1',
              assigned_user_id: null,
              is_blocked: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          ],
          checklists: [],
          transition_rules: [],
        })
      });
    });

    await page.goto('/');

    // 1. Verify Parent Badge is rendered on the child card
    const parentBadge = page.locator('[data-testid="card-parent-badge-child-id-1234567890"]');
    await expect(parentBadge).toBeVisible();
    await expect(parentBadge).toHaveTextContent('↑ Epic Parent Task');

    // 2. Click parent badge, which triggers highlighting & scrolling.
    const parentCard = page.locator('[data-card-id="parent-id-1234567890"]');
    await expect(parentCard).toBeVisible();
    await parentBadge.click();

    // Verify parent card visual highlight classes and focus
    await expect(parentCard).toHaveClass(/border-accent-primary/);
    await expect(parentCard).toHaveClass(/animate-pulse/);
    await expect(parentCard).toHaveClass(/shadow-glow/);
    await expect(parentCard).toBeFocused();

    // 3. Open Details Drawer by clicking the child card
    const childCard = page.locator('[data-card-id="child-id-1234567890"]');
    await childCard.click();

    // Verify Details Drawer matches 'card-history-sidebar' test ID
    const drawer = page.locator('[data-testid="card-history-sidebar"]');
    await expect(drawer).toBeVisible();

    // Verify Decomposition Panel inside details drawer
    const decompositionPanel = page.locator('[data-testid="card-decomposition-panel"]');
    await expect(decompositionPanel).toBeVisible();

    // Child card has no subtasks yet, so it should display empty state recovery placeholder
    const emptyState = decompositionPanel.locator('[data-testid="decomposition-empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveTextContent('No subtasks created yet. Add one below to start decomposing this task.');

    // 4. Test quick-add input and submission validation
    const subtaskInput = page.locator('[data-testid="decomposition-add-input"]');
    const subtaskSubmit = page.locator('[data-testid="decomposition-add-submit"]');
    await expect(subtaskInput).toBeVisible();
    await expect(subtaskInput).toBeFocused(); // Autofocus on drawer mount

    // Test validation (submitting empty subtask)
    await subtaskSubmit.click();
    const errorBanner = page.locator('[data-testid="decomposition-error-banner"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveTextContent('Subtask title cannot be empty.');
    await expect(errorBanner).toHaveClass(/animate-shake/);

    // Mock successful subtask creation response
    await page.route('**/api/workspaces/550e8400-e29b-41d4-a716-446655440000/cards', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        expect(body.parent_id).toBe('child-id-1234567890');
        expect(body.title).toBe('New Brand Subtask');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sub-child-uuid',
            parent_id: 'child-id-1234567890',
            workspace_id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'New Brand Subtask',
            current_column_id: 'col-1',
            current_swimlane_id: 'lane-1',
            assigned_user_id: null,
            is_blocked: false,
          })
        });
      }
    });

    // Mock board state refresh with the new subtask added to display it in the list
    await page.route('**/api/workspaces/550e8400-e29b-41d4-a716-446655440000/board', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columns: [
            { id: 'col-1', workspace_id: 'w-1', title: 'To Do', position: 1, wip_limit: null, is_done: false },
            { id: 'col-2', workspace_id: 'w-1', title: 'Doing', position: 2, wip_limit: null, is_done: false },
            { id: 'col-3', workspace_id: 'w-1', title: 'Done', position: 3, wip_limit: null, is_done: true },
          ],
          swimlanes: [
            { id: 'lane-1', workspace_id: 'w-1', title: 'Default', position: 1, wip_limit: null },
          ],
          cards: [
            {
              id: 'parent-id-1234567890',
              parent_id: null,
              workspace_id: 'w-1',
              title: 'Epic Parent Task',
              current_column_id: 'col-1',
              current_swimlane_id: 'lane-1',
              assigned_user_id: null,
              is_blocked: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'child-id-1234567890',
              parent_id: 'parent-id-1234567890',
              workspace_id: 'w-1',
              title: 'Decomposed Child Task',
              current_column_id: 'col-2',
              current_swimlane_id: 'lane-1',
              assigned_user_id: null,
              is_blocked: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'sub-child-uuid',
              parent_id: 'child-id-1234567890',
              workspace_id: 'w-1',
              title: 'New Brand Subtask',
              current_column_id: 'col-1',
              current_swimlane_id: 'lane-1',
              assigned_user_id: null,
              is_blocked: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          ],
          checklists: [],
          transition_rules: [],
        })
      });
    });

    // Type title and submit subtask creation
    await subtaskInput.fill('New Brand Subtask');
    await subtaskSubmit.click();

    // Verify empty state is gone, and the new subtask is listed with completion checkbox
    await expect(emptyState).toBeHidden();
    const checkbox = page.locator('[data-testid="subtask-checkbox-sub-child-uuid"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // 5. Test Accessibility focus trap in drawer
    await page.keyboard.press('Tab'); // focus next element
    await page.keyboard.press('Tab'); // focus next element
  });
});
