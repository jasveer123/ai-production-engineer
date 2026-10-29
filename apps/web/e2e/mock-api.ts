import type { Page, Route } from '@playwright/test';

type Handler = (route: Route) => unknown;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const SIGNED_IN = {
  user: {
    id: 'u1',
    email: 'owner@demo.local',
    name: 'Demo Owner',
    avatarUrl: null,
    emailVerified: true,
    hasPassword: true,
  },
  workspaces: [{ id: 'ws-1', name: 'Demo Shop', role: 'owner' }],
  authProviders: { password: true, github: false, devLogin: false },
};

const EMPTY_INGEST = {
  ingestUrl: 'https://ingest.example.com',
  syslog: null,
  tokens: [],
  ways: [],
  streams: [],
};

export async function mockApi(
  page: Page,
  { me, overrides = {} }: { me: unknown | null; overrides?: Record<string, unknown | Handler> },
) {
  await page.route(/\/api\/(auth|workspaces)\//, async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const match = Object.entries(overrides).find(([suffix]) => pathname.endsWith(suffix));
    if (match) {
      const [, value] = match;
      return typeof value === 'function' ? (value as Handler)(route) : json(route, value);
    }
    if (pathname.endsWith('/auth/me'))
      return me
        ? json(route, me)
        : json(
            route,
            { code: 'unauthorized', message: 'Sign in first', correlationId: 'test-corr-0001' },
            401,
          );
    if (pathname.endsWith('/auth/providers')) return json(route, SIGNED_IN.authProviders);
    if (pathname.endsWith('/ingest')) return json(route, EMPTY_INGEST);
    if (pathname.includes('/workspaces/')) return json(route, []);
    return json(route, { code: 'not_mocked', message: pathname }, 501);
  });
}
