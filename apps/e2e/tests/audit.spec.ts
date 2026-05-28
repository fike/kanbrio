import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CARD_ID = '550e8400-e29b-41d4-a716-446655440008'; // "Fix Security Leak"
const CARD_TITLE = 'Fix Security Leak';

test.describe('Transition Auditing E2E', () => {
  test('should record an audit event when a card is moved via UI', async ({ page, request }) => {
    // 1. Navigate to the board
    await page.goto('/');

    const card = page.getByLabel(`Card: ${CARD_TITLE}`);
    await expect(card).toBeVisible();

    // 2. Identify target column zone (Doing)
    const targetZone = page.getByTestId('column-zone-Doing').first();

    // 3. Perform Drag and Drop
    await card.dragTo(targetZone);

    // 4. Wait for potential backend sync (though dragTo is synchronous in Playwright,
    // the backend request might take a few ms)
    await page.waitForTimeout(500);

    // 5. Verify Audit Trail via API
    const response = await request.get(`${API_BASE}/api/workspaces/${WORKSPACE_ID}/cards/${CARD_ID}/history`);
    expect(response.ok()).toBeTruthy();

    const history = await response.json();

    // The history is ordered by occurred_at DESC, so the move should be the first entry
    expect(history.length).toBeGreaterThan(0);
    const latestEvent = history[0];

    expect(latestEvent.transition_type).toBe('move');
    expect(latestEvent.card_id).toBe(CARD_ID);

    // Verify payload (JSONB)
    expect(latestEvent.payload).toBeDefined();
    expect(latestEvent.payload.to_column_id).toBe('550e8400-e29b-41d4-a716-446655440002'); // Doing ID
  });
});
