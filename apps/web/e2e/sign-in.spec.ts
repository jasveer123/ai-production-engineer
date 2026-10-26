import { expect, test, type Route } from '@playwright/test';
import { mockApi } from './mock-api';

test.describe('sign-in page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { me: null });
  });

  test('renders the form with labelled fields and links', async ({ page }) => {
    await page.goto('/login/');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
  });

  test('explains what is missing instead of calling the API', async ({ page }) => {
    await page.goto('/login/');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Enter your password')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows the server message for wrong credentials', async ({ page }) => {
    await mockApi(page, {
      me: null,
      overrides: {
        '/auth/login': (route: Route) =>
          route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'unauthorized',
              message: 'Wrong email or password',
              correlationId: 'test-corr-0002',
            }),
          }),
      },
    });
    await page.goto('/login/');
    await page.getByLabel('Email').fill('owner@demo.local');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Wrong email or password' }),
    ).toBeVisible();
  });

  test('signed-out visitors to the app land on sign-in', async ({ page }) => {
    await page.goto('/incidents/');
    await expect(page).toHaveURL(/\/login\/\?next=/);
  });
});
