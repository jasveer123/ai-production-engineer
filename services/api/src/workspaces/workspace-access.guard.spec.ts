import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@ape/api-contracts';
import type { AuditService } from '../audit/audit.service';
import type { Database } from '../db/client';
import { WorkspaceAccessGuard } from './workspace-access.guard';

const WS = '11111111-1111-4111-8111-111111111111';

function dbReturning(rows: { id: string; role: Role }[]): Database {
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return chain as unknown as Database;
}

function context(req: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guard(rows: { id: string; role: Role }[], required?: Role) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return {
    audit,
    guard: new WorkspaceAccessGuard(reflector, audit as unknown as AuditService, dbReturning(rows)),
  };
}

const request = (workspaceId: string) => ({
  method: 'POST',
  path: `/workspaces/${workspaceId}/services`,
  params: { workspaceId },
  auth: { userId: 'u1', sessionId: 's1' },
  correlationId: 'corr-12345678',
});

const statusOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as HttpException).getStatus();
  }
};

describe('WorkspaceAccessGuard', () => {
  it('returns 404 and audits a denial for non-members', async () => {
    const { guard: g, audit } = guard([]);
    expect(await statusOf(g.canActivate(context(request(WS))))).toBe(404);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', action: 'workspace.access' }),
    );
  });

  it('returns 404 for a malformed workspace id without querying', async () => {
    const { guard: g } = guard([{ id: 'm1', role: 'owner' }]);
    expect(await statusOf(g.canActivate(context(request('not-a-uuid'))))).toBe(404);
  });

  it('returns 403 when the role is below the route minimum', async () => {
    const { guard: g, audit } = guard([{ id: 'm1', role: 'viewer' }], 'admin');
    expect(await statusOf(g.canActivate(context(request(WS))))).toBe(403);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'denied' }));
  });

  it('allows a sufficient role and attaches the membership', async () => {
    const req = request(WS);
    const { guard: g } = guard([{ id: 'm1', role: 'admin' }], 'admin');
    await expect(g.canActivate(context(req))).resolves.toBe(true);
    expect((req as { membership?: unknown }).membership).toEqual({
      workspaceId: WS,
      memberId: 'm1',
      role: 'admin',
    });
  });

  it('defaults to viewer when a route sets no minimum role', async () => {
    const { guard: g } = guard([{ id: 'm1', role: 'viewer' }]);
    await expect(g.canActivate(context(request(WS)))).resolves.toBe(true);
  });
});
