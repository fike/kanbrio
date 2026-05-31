import { test, expect } from '@playwright/test';

test.describe('Card Creation Inline Form E2E', () => {
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

  test('should enforce inline form mount, input validations, loading states, and error shaking', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Card: Fix Security Leak')).toBeVisible();

    const todoColId = '550e8400-e29b-41d4-a716-446655440001';
    const standardLaneId = '550e8400-e29b-41d4-a716-446655440004';

    // 2. Click "+ Add Card" in the To Do column / Standard swimlane intersection
    const addCardBtn = page.locator(`[data-testid="column-add-card-button-${todoColId}-${standardLaneId}"]`);
    await expect(addCardBtn).toBeVisible();
    await addCardBtn.click();

    // 3. Form mounted & programmatically focused
    const formCard = page.locator(`[data-testid="inline-card-form-${todoColId}-${standardLaneId}"]`);
    await expect(formCard).toBeVisible();
    const titleInput = formCard.locator('[data-testid="inline-card-title-input"]');

    // Allow up to 100ms for autofocus
    await expect(titleInput).toBeFocused();

    // 4. Validate focus trap (Textarea -> Add Button -> Cancel Button -> Textarea)
    await page.keyboard.press('Tab'); // focus Add
    const submitBtn = formCard.locator('[data-testid="inline-card-submit"]');
    await expect(submitBtn).toBeFocused();

    await page.keyboard.press('Tab'); // focus Cancel
    const cancelBtn = formCard.locator('[data-testid="inline-card-cancel"]');
    await expect(cancelBtn).toBeFocused();

    await page.keyboard.press('Tab'); // loops back to textarea
    await expect(titleInput).toBeFocused();

    // 5. Test Escape dismissal
    await page.keyboard.press('Escape');
    await expect(formCard).toBeHidden();
    await expect(addCardBtn).toBeFocused(); // Focus restored to trigger button

    // 6. Reopen and test field validation (submit empty title)
    await addCardBtn.click();
    await expect(titleInput).toBeFocused();
    await page.keyboard.press('Enter');

    const errorMsg = formCard.locator('[data-testid="inline-card-error"]');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('Card title cannot be empty.');
    await expect(formCard).toHaveClass(/animate-shake/);

    // 7. Successful creation
    await titleInput.fill('Deploy Auth Microservice');

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
      submitBtn.click()
    ]);

    // Verify closes on success and the new card appears on the board
    await expect(formCard).toBeHidden();
    await expect(page.locator('text=Deploy Auth Microservice')).toBeVisible();
  });

  test('should shake and display error banner and toast on WIP limit violation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Card: Fix Security Leak')).toBeVisible();

    const doneColId = '550e8400-e29b-41d4-a716-446655440003';
    const standardLaneId = '550e8400-e29b-41d4-a716-446655440004';

    // 1. Click "+ Add Card" in Done / Standard (limit 1, already contains 1 card)
    const addCardBtn = page.locator(`[data-testid="column-add-card-button-${doneColId}-${standardLaneId}"]`);
    await expect(addCardBtn).toBeVisible();
    await addCardBtn.click();

    const formCard = page.locator(`[data-testid="inline-card-form-${doneColId}-${standardLaneId}"]`);
    await expect(formCard).toBeVisible();

    const titleInput = formCard.locator('[data-testid="inline-card-title-input"]');
    const submitBtn = formCard.locator('[data-testid="inline-card-submit"]');

    await titleInput.fill('WIP Breach Task');

    // 2. Submit and expect 409
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/cards') && r.status() === 409),
      submitBtn.click()
    ]);

    // 3. Verify shake, error banner, and bottom-right toast
    const errorMsg = formCard.locator('[data-testid="inline-card-error"]');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('WIP limit 1 exceeded for column');
    await expect(formCard).toHaveClass(/animate-shake/);

    const toast = page.locator('[data-testid="rule-violation-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('exceeded');
  });

  test('should allow creating multiple cards in sequence using mouse clicks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Card: Fix Security Leak')).toBeVisible();

    const todoColId = '550e8400-e29b-41d4-a716-446655440001';
    const standardLaneId = '550e8400-e29b-41d4-a716-446655440004';

    const addCardBtn = page.locator(`[data-testid="column-add-card-button-${todoColId}-${standardLaneId}"]`);

    // 1. Create First Card
    await addCardBtn.click();
    const formCard = page.locator(`[data-testid="inline-card-form-${todoColId}-${standardLaneId}"]`);
    await expect(formCard).toBeVisible();
    const titleInput = formCard.locator('[data-testid="inline-card-title-input"]');
    await titleInput.fill('First Mouse Card');
    const submitBtn = formCard.locator('[data-testid="inline-card-submit"]');

    await Promise.all([
      page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
      submitBtn.click()
    ]);

    await expect(formCard).toBeHidden();
    await expect(page.locator('text=First Mouse Card')).toBeVisible();

    // 2. Attempt to Create Second Card using mouse click
    await expect(addCardBtn).toBeVisible();
    await addCardBtn.click();

    // Check if the form opens successfully
    await expect(formCard).toBeVisible();
    await titleInput.fill('Second Mouse Card');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
      submitBtn.click()
    ]);

    await expect(formCard).toBeHidden();
    await expect(page.locator('text=Second Mouse Card')).toBeVisible();
  });
});
