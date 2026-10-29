import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

export const TEST_SESSION = {
  workspace: { id: 'ws-1', name: 'Shop', plan: 'free', status: 'active', role: 'owner' as const },
  can: () => true,
};

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

export function mockApi(routes: [RegExp, (init?: RequestInit) => Response | object][]) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    for (const [pattern, respond] of routes) {
      if (!pattern.test(String(url))) continue;
      const out = respond(init);
      return out instanceof Response
        ? out
        : new Response(JSON.stringify(out), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    }
    return new Response(JSON.stringify({ code: 'not_found', message: 'No mock' }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
