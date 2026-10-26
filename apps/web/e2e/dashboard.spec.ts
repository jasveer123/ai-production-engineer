import { expect, test, type Route } from '@playwright/test';
import { mockApi, SIGNED_IN } from './mock-api';

test.describe('empty dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { me: SIGNED_IN });
  });

  test('says there is nothing open and what to do next', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'No open incidents' })).toBeVisible();
    await expect(page.getByText('Nothing is waiting for a review or a decision.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Demo Owner/ })).toBeVisible();
  });

  test('the incident inbox shows its empty state', async ({ page }) => {
    await page.goto('/incidents/');
    await expect(page.getByRole('heading', { name: 'No incidents match' })).toBeVisible();
  });

  test('the account menu opens with the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Demo Owner/ }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeHidden();
  });

  test('a server failure shows a banner with the reference', async ({ page }) => {
    await mockApi(page, {
      me: SIGNED_IN,
      overrides: {
        '/incidents': (route: Route) =>
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'internal_error',
              message: 'Something went wrong',
              correlationId: 'test-corr-0003',
            }),
          }),
      },
    });
    await page.goto('/incidents/');
    await expect(page.getByText('Something went wrong (reference test-corr-0003)')).toBeVisible();
  });
});
