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

    // Verify BLOCK event in history (might need a moment to fetch if not instant)
    await expect(sidebar.getByText('BLOCK', { exact: false }).first()).toBeVisible();
    await expect(sidebar.getByText('Reason: E2E Block Reason')).toBeVisible();

    // 3. Unblock the card
    await card.hover();
    await card.getByTitle('Unblock card').click();

    // Verify visual state
    await expect(card).toHaveAttribute('aria-label', `Card: ${CARD_TITLE}`);

    // Verify UNBLOCK event in history
    await expect(sidebar.getByText('UNBLOCK', { exact: false }).first()).toBeVisible();
  });
});
