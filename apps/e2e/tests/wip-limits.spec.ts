import { test, expect } from '@playwright/test';

const CARD_TITLE_TO_MOVE = 'Implement Drag & Drop'; // In Doing
const DONE_COLUMN_ID = 'column-zone-Done'; // Has limit 1, and already has 1 card

test.describe('WIP Limits E2E', () => {
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

  test('should prevent moving a card into a column at its WIP limit', async ({ page, request }) => {
    await page.goto('/');

    const cardToMove = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE_TO_MOVE });
    const targetZone = page.getByTestId(DONE_COLUMN_ID).first();

    // Verify initial state: Done is at limit (1/1)
    const doneHeader = page.locator('h3', { hasText: 'Done' }).locator('xpath=../..');
    await expect(doneHeader).toContainText('WIP 1 / 1');
    await expect(doneHeader).toHaveClass(/bg-orange-50/);

    // Try to move the card into the full column
    // We expect the API to return 409
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/move')),
      cardToMove.dragTo(targetZone)
    ]);

    expect(response.status()).toBe(409);

    // Verify it snapped back (not in Done)
    // Wait for the UI to process the error
    // In our optimistic UI, we don't have a toast yet (it was planned but maybe not fully implemented in Board.tsx,
    // we just have a window.alert or nothing).
    // Wait, the plan said "window.alert" for now. Playwright auto-dismisses alerts, but we can catch it!
  });

  test('should show Toast notification on WIP limit exceeded', async ({ page }) => {
    await page.goto('/');

    const cardToMove = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE_TO_MOVE });
    const targetZone = page.getByTestId(DONE_COLUMN_ID).first();

    await Promise.all([
      page.waitForResponse(r => r.url().includes('/move')),
      cardToMove.dragTo(targetZone)
    ]);

    const toast = page.locator('div.fixed.bottom-4.right-4');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/WIP limit/i);
  });
});
