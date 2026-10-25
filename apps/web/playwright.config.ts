import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// The CI runner has no backend: every API call is answered in the browser (see e2e/mock-api.ts).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Same-origin /api, as behind CloudFront, so the browser needs no CORS for the mocked answers.
    command: `NEXT_PUBLIC_API_URL=/api pnpm build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
