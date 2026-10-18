import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { trace } from '@opentelemetry/api';
import { and, eq } from 'drizzle-orm';
import type { Role } from '@ape/api-contracts';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { forbidden, notFound, unauthorized } from '../common/errors';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { workspaceMembers, workspaces } from '../db/schema';
import { MIN_ROLE_KEY } from './min-role.decorator';
import { hasRole } from './roles';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant guard + RBAC for `/workspaces/:workspaceId/...` routes.
 * The workspace comes from the URL and is checked against the caller's membership in the DB on
 * every request, so removed members lose access immediately. Non-members get 404 (no existence
 * leak); members below the route's minimum role get 403. Both outcomes are audited.
 */
@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.auth) throw unauthorized();
    const workspaceId = req.params.workspaceId as string | undefined;
    const required =
      this.reflector.getAllAndOverride<Role | undefined>(MIN_ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'viewer';
    const routePath = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const action = `${req.method} ${routePath}`;

    const [membership] =
      workspaceId && UUID.test(workspaceId)
        ? await this.db
            .select({ id: workspaceMembers.id, role: workspaceMembers.role })
            .from(workspaceMembers)
            .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
            .where(
              and(
                eq(workspaceMembers.workspaceId, workspaceId),
                eq(workspaceMembers.userId, req.auth.userId),
                eq(workspaces.status, 'active'),
              ),
            )
            .limit(1)
        : [];

    if (!membership) {
      await this.audit.record({
        actorId: req.auth.userId,
        action: 'workspace.access',
        resourceType: 'workspace',
        resourceId: workspaceId ?? null,
        outcome: 'denied',
        correlationId: req.correlationId,
        metadata: { reason: 'not_a_member', route: action },
      });
      throw notFound('Workspace');
    }

    if (!hasRole(membership.role, required)) {
      await this.audit.record({
        workspaceId,
        actorId: req.auth.userId,
        action: 'workspace.access',
        resourceType: 'route',
        resourceId: action,
        outcome: 'denied',
        correlationId: req.correlationId,
        metadata: { reason: 'insufficient_role', role: membership.role, required },
      });
      throw forbidden(`This action requires the ${required} role or higher`);
    }

    req.membership = { workspaceId: workspaceId!, memberId: membership.id, role: membership.role };
    trace.getActiveSpan()?.setAttribute('workspace_id', workspaceId!);
    return true;
  }
}
