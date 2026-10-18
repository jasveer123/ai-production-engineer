import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './helpers';

describe('GET /health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('is public and returns ok', () =>
    request(app.getHttpServer()).get('/health').expect(200, { status: 'ok', service: 'api' }));

  it('echoes a valid correlation id and rejects unauthenticated access', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('x-correlation-id', 'test-corr-0001')
      .expect(401);
    expect(res.headers['x-correlation-id']).toBe('test-corr-0001');
    expect(res.body).toEqual({
      code: 'unauthenticated',
      message: 'Sign in required',
      correlationId: 'test-corr-0001',
    });
  });
});
