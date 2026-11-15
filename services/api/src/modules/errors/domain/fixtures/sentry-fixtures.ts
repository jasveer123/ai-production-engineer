export const browserEvent = {
  event_id: '3f1c2d0e9b8a4c7d8e6f5a4b3c2d1e0f',
  timestamp: 1794614400.123,
  platform: 'javascript',
  level: 'error',
  release: 'shop@1.4.2',
  environment: 'production',
  sdk: { name: 'sentry.javascript.browser', version: '8.40.0' },
  request: {
    url: 'https://shop.test/cart?token=abc',
    headers: { 'User-Agent': 'Mozilla/5.0', Cookie: 'sid=secret' },
  },
  user: { id: 'u_42', email: 'ann@shop.test', ip_address: '{{auto}}' },
  tags: { pramaan_session: 'a1b2c3d4e5f6a7b8c9d0e1f2', 'browser.name': 'Chrome', auth_token: 'x' },
  contexts: {
    browser: { name: 'Chrome', version: '131.0.0' },
    trace: { trace_id: '0af7651916cd43dd8448eb211c80319c', span_id: 'b7ad6b7169203331' },
  },
  breadcrumbs: {
    values: [
      { timestamp: 1794614399.5, category: 'ui.click', message: 'button#pay' },
      {
        timestamp: 1794614399.9,
        category: 'fetch',
        type: 'http',
        data: { url: '/api/cart', status_code: 500 },
      },
    ],
  },
  exception: {
    values: [
      {
        type: 'Error',
        value: 'Request failed with status 500',
        stacktrace: {
          frames: [
            {
              filename: 'https://shop.test/assets/vendor.js',
              function: 'fetchJson',
              lineno: 1,
              colno: 900,
              in_app: false,
            },
          ],
        },
      },
      {
        type: 'TypeError',
        value: "Cannot read properties of undefined (reading 'total')",
        mechanism: { type: 'onerror', handled: false },
        stacktrace: {
          frames: [
            {
              filename: 'https://shop.test/assets/vendor.js',
              function: 'dispatch',
              lineno: 1,
              colno: 2000,
              in_app: false,
            },
            {
              filename: 'https://shop.test/assets/app.3f9a1c2b.js',
              function: 'renderCart',
              lineno: 1,
              colno: 512,
              in_app: true,
            },
            {
              filename: 'https://shop.test/assets/app.3f9a1c2b.js',
              function: 'computeTotal',
              lineno: 1,
              colno: 77,
              in_app: true,
            },
          ],
        },
      },
    ],
  },
};

export const pythonEvent = {
  event_id: '9a8b7c6d5e4f40312a1b0c9d8e7f6a5b',
  timestamp: '2026-11-14T10:00:00.000000Z',
  platform: 'python',
  level: 'error',
  server_name: 'web-1',
  release: 'api@2.0.0',
  environment: 'staging',
  transaction: '/orders/{id}',
  sdk: { name: 'sentry.python.django', version: '2.18.0' },
  tags: [
    ['url', '/orders/7'],
    ['handled', 'no'],
  ],
  exception: {
    values: [
      {
        type: 'ZeroDivisionError',
        value: 'division by zero',
        module: null,
        stacktrace: {
          frames: [
            {
              filename: 'django/core/handlers/base.py',
              abs_path: '/venv/lib/django/core/handlers/base.py',
              function: '_get_response',
              module: 'django.core.handlers.base',
              lineno: 197,
              in_app: false,
            },
            {
              filename: 'orders/views.py',
              abs_path: '/app/orders/views.py',
              function: 'order_total',
              module: 'orders.views',
              lineno: 42,
              pre_context: ['def order_total(order):', '    items = order.items'],
              context_line: '    return sum(items) / len(items)',
              post_context: ['', 'def other():'],
              in_app: true,
              vars: { password: 'hunter2' },
            },
          ],
        },
      },
    ],
  },
};

export function envelope(
  items: { header: Record<string, unknown>; body: string | Buffer }[],
  head: Record<string, unknown> = {},
): Buffer {
  const parts: Buffer[] = [Buffer.from(JSON.stringify(head) + '\n')];
  for (const item of items) {
    parts.push(Buffer.from(JSON.stringify(item.header) + '\n'));
    parts.push(Buffer.isBuffer(item.body) ? item.body : Buffer.from(item.body));
    parts.push(Buffer.from('\n'));
  }
  return Buffer.concat(parts);
}
