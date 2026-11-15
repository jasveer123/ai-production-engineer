import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { freshness, lag, overallStatus } from './overall';
import { ReadinessService } from './readiness.service';

describe('HealthController', () => {
  it('keeps /health backwards compatible and reports liveness', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: ReadinessService, useValue: {} }],
    }).compile();
    const controller = moduleRef.get(HealthController);
    expect(controller.check()).toEqual({ status: 'ok', service: 'api' });
    expect(controller.live().status).toBe('ok');
  });
});

describe('readiness rules', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const ok = (name: string) => ({ name, status: 'ok' as const, latencyMs: 1, detail: null });

  it('is down only when a critical dependency is down', () => {
    expect(overallStatus([ok('database'), ok('redis')])).toBe('ok');
    expect(overallStatus([ok('database'), { ...ok('redis'), status: 'down' }])).toBe('degraded');
    expect(overallStatus([{ ...ok('database'), status: 'down' }])).toBe('down');
  });

  it('marks a worker that stopped beating as down', () => {
    expect(freshness('w', null, now, 60_000).status).toBe('down');
    expect(freshness('w', new Date(now.getTime() - 30_000), now, 60_000).status).toBe('ok');
    expect(freshness('w', new Date(now.getTime() - 90_000), now, 60_000).status).toBe('down');
  });

  it('flags queue lag beyond the limit', () => {
    expect(lag('outbox', null, now, 1000).status).toBe('ok');
    expect(lag('outbox', new Date(now.getTime() - 5000), now, 1000).status).toBe('degraded');
  });
});
