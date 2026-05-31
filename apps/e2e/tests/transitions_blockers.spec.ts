import { test, expect } from '@playwright/test';

test.describe('Transitions & Blockers Visual Language E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication endpoints
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
            { id: 'ws-1', name: 'Test Workspace', role: 'admin' }
          ]
        })
      });
    });

    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'ws-1', name: 'Test Workspace', role: 'admin' }
        ])
      });
    });
  });

  test('should render blocker styling, open Blocker Drawer, trap focus, post comments, and perform drag rollback with shake', async ({ page }) => {
    const cardData = {
      id: 'card-blocked',
      parent_id: null,
      workspace_id: 'ws-1',
      title: 'Blocked Database Migration Task',
      current_column_id: 'col-todo',
      current_swimlane_id: 'lane-1',
      assigned_user_id: '550e8400-e29b-41d4-a716-446655449999',
      is_blocked: true,
      blocked_by: '550e8400-e29b-41d4-a716-446655449999',
      blocked_at: new Date(Date.now() - 3600000).toISOString(), // 1 hr ago
      blocked_reason: 'Waiting for cloud provider provisioning',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Mock fetchBoardState response with blocked card
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
          cards: [cardData],
          checklists: [],
          transition_rules: []
        })
      });
    });

    // 2. Mock block comments retrieval
    await page.route('**/api/workspaces/*/cards/card-blocked/block/comments', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'c-1',
              card_id: 'card-blocked',
              user_id: '550e8400-e29b-41d4-a716-446655449999',
              content: 'Initial follow up on the DevOps ticket',
              created_at: new Date(Date.now() - 1800000).toISOString(),
              updated_at: new Date(Date.now() - 1800000).toISOString()
            }
          ])
        });
      } else if (route.request().method() === 'POST') {
        const payload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'c-2',
            card_id: 'card-blocked',
            user_id: '550e8400-e29b-41d4-a716-446655449999',
            content: payload.content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
      }
    });

    // 3. Mock block card move failure (422 CARD_IS_BLOCKED)
    await page.route('**/api/workspaces/*/cards/card-blocked/move', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Card is blocked and cannot be moved',
          code: 'CARD_IS_BLOCKED'
        })
      });
    });

    await page.goto('/w/ws-1');

    // Test Point 1: Blocker styling, left stripe boundary, and red blocker badge
    const card = page.getByLabel('Card: Blocked Database Migration Task, Blocked');
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/border-status-blocked/);

    const badge = page.getByTestId('blocker-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Blocked: Waiting for cloud provider provisioning');

    // Test Point 2: Click badge to slide open Blocker Drawer
    await badge.click();
    const drawer = page.getByTestId('blocker-detail-drawer');
    await expect(drawer).toBeVisible();

    // Verify Urgency Banner & elapsed time display
    const banner = page.getByTestId('blocker-drawer-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('URGENT: BLOCKED STATE');
    await expect(banner).toContainText('1h ago');

    // Verify existing comments are loaded
    const commentContainer = page.getByTestId('block-comments-container');
    await expect(commentContainer).toBeVisible();
    await expect(commentContainer).toContainText('Initial follow up on the DevOps ticket');

    // Test Point 3: Keyboard accessibility - Focus trapping and Escape key
    // Close button should be focused first
    const closeBtn = drawer.locator('button[aria-label="Close details"]');
    await expect(closeBtn).toBeFocused();

    // Escape should close drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Reopen drawer
    await badge.click();
    await expect(drawer).toBeVisible();

    // Test Point 4: Post comment
    const input = page.locator('#blocker-comment-input');
    await input.fill('Provisioning completed successfully.');
    await page.click('button[type="submit"]');

    // Input should be cleared on success
    await expect(input).toHaveValue('');

    // Close drawer manually
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();

    // Test Point 5: Drag blocked card to Doing should cause rollback, shaking physics, and error toast
    const targetZone = page.getByTestId('column-zone-Doing').first();
    await card.dragTo(targetZone);

    // Toast rejection warning should be visible
    const toast = page.getByTestId('rule-violation-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Card is blocked and cannot be moved!');

    // Card shakes (class includes animate-shake)
    const cardEl = page.locator('div[role="listitem"]').first();
    await expect(cardEl).toHaveClass(/animate-shake/);
  });
});
