import { test, expect } from '@playwright/test';

const CARD_TITLE = 'Fix Security Leak';

test.describe('Card Lifecycle E2E', () => {
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
    await card.getByTitle('Block card').click();

    // Verify visual state (optimistic or settled)
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);
    await expect(card.locator('svg.text-status-blocked').first()).toBeVisible();

    // 2. Open History
    await card.click();
    const sidebar = page.locator('div:has-text("Card History")').last();
    await expect(sidebar).toBeVisible();

    // Verify BLOCK event in history
    await expect(sidebar.getByTestId('history-event-block').first()).toBeVisible();
    await expect(sidebar.getByText('Reason: E2E Block Reason')).toBeVisible();

    // 3. Unblock the card
    await card.hover();
    await card.getByTitle('Unblock card').click();

    // Verify visual state
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}`);

    // Verify UNBLOCK event in history
    await expect(sidebar.getByTestId('history-event-unblock').first()).toBeVisible();
  });

  test('should persist blocked state after page reload', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE });

    // 1. Block the card
    page.once('dialog', async dialog => {
      await dialog.accept('Persistence Test');
    });
    await card.hover();
    await card.getByTitle('Block card').click();
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);

    // 2. Reload the page
    await page.reload();

    // 3. Verify state is still there
    const cardAfterReload = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE });
    await expect(cardAfterReload).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);
    await expect(cardAfterReload.locator('svg.text-status-blocked').first()).toBeVisible();

    // 4. Verify history also survived
    await cardAfterReload.click();
    const sidebar = page.locator('div:has-text("Card History")').last();
    await expect(sidebar.getByTestId('history-event-block').first()).toBeVisible();
    await expect(sidebar.getByText('Reason: Persistence Test')).toBeVisible();
  });

  test('should handle rapid sequential actions (move then block)', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('div[role="listitem"]').filter({ hasText: CARD_TITLE });
    const targetZone = page.getByTestId('column-zone-Doing').first();

    // 1. Move the card
    await card.dragTo(targetZone);

    // 2. Immediately block it (simulating rapid user interaction)
    page.once('dialog', async dialog => {
      await dialog.accept('Rapid Action Reason');
    });
    await card.hover();
    await card.getByTitle('Block card').click();

    // 3. Verify both states are captured
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}, Blocked`);

    await card.click();
    const sidebar = page.locator('div:has-text("Card History")').last();

    // Both events should be visible in the timeline
    await expect(sidebar.getByTestId('history-event-block').first()).toBeVisible();
    await expect(sidebar.getByTestId('history-event-move').first()).toBeVisible();
  });
});
