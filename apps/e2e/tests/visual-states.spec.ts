import { test, expect } from '@playwright/test';

const CARD_TITLE = 'Fix Security Leak';

test.describe('Card Lifecycle E2E', () => {
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

  test('should block/unblock a card and verify history', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE });
    await expect(card).toBeVisible();

    // Ensure clean state: unblock if already blocked
    const initialLabel = await card.getAttribute('aria-label');
    if (initialLabel?.includes('Blocked')) {
      await card.hover();
      await card.getByTitle('Unblock card').click();
      await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}`);
    }

    // 1. Block the card
    page.once('dialog', async dialog => {
      await dialog.accept('E2E Block Reason');
    });

    await card.hover();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/block') && r.status() === 200),
      card.getByTitle('Block card').click()
    ]);

    // Verify visual state (optimistic or settled)
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);
    await expect(card.locator('svg.text-status-blocked').first()).toBeVisible();

    // 2. Open History
    await card.click();
    const sidebar = page.getByTestId('card-history-sidebar');
    await expect(sidebar).toBeVisible();

    // Verify BLOCK event in history
    await expect(sidebar.getByTestId('history-event-block').first()).toBeVisible();
    await expect(sidebar.getByText('Reason: E2E Block Reason')).toBeVisible();

    // 3. Unblock the card
    await card.hover();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/unblock') && r.status() === 200),
      card.getByTitle('Unblock card').click()
    ]);

    // Verify visual state
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}`);

    // Verify UNBLOCK event in history
    await expect(sidebar.getByTestId('history-event-unblock').first()).toBeVisible();
    });

    test('should persist blocked state after page reload', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE });

    // Ensure clean state: unblock if already blocked
    const initialLabel = await card.getAttribute('aria-label');
    if (initialLabel?.includes('Blocked')) {
      await card.hover();
      await Promise.all([
        page.waitForResponse(r => r.url().includes('/unblock') && r.status() === 200),
        card.getByTitle('Unblock card').click()
      ]);
    }

    // 1. Block the card
    page.once('dialog', async dialog => {
      await dialog.accept('Persistence Test');
    });
    await card.hover();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/block') && r.status() === 200),
      card.getByTitle('Block card').click()
    ]);

    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);

    // 2. Reload the page
    await page.reload();
    // 3. Verify state is still there
    const cardAfterReload = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE });
    await expect(cardAfterReload).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);
    await expect(cardAfterReload.locator('svg.text-status-blocked').first()).toBeVisible();

    // 4. Verify history also survived
    await cardAfterReload.click();
    const sidebar = page.getByTestId('card-history-sidebar');
    await expect(sidebar.getByTestId('history-event-block').first()).toBeVisible();
    await expect(sidebar.getByText('Reason: Persistence Test')).toBeVisible();
  });

  test('should handle rapid sequential actions (move then block)', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE });
    const targetZone = page.getByTestId('column-zone-Doing').first();

    // Ensure clean state: unblock if already blocked
    const initialLabel = await card.getAttribute('aria-label');
    if (initialLabel?.includes('Blocked')) {
      await card.hover();
      await Promise.all([
        page.waitForResponse(r => r.url().includes('/unblock') && r.status() === 200),
        card.getByTitle('Unblock card').click()
      ]);
    }

    // 1. Move the card
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/move') && r.status() === 200),
      card.dragTo(targetZone)
    ]);

    // 2. Immediately block it (simulating rapid user interaction)
    page.once('dialog', async dialog => {
      await dialog.accept('Rapid Action Reason');
    });
    await card.hover();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/block') && r.status() === 200),
      card.getByTitle('Block card').click()
    ]);
    // 3. Verify both states are captured
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);

    await card.click();
    const sidebar = page.getByTestId('card-history-sidebar');

    // Both events should be visible in the timeline
    await expect(sidebar.getByTestId('history-event-block').first()).toBeVisible();
    await expect(sidebar.getByTestId('history-event-move').first()).toBeVisible();
  });
});
