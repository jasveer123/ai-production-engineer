import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ActorContext } from './request-context';
import { unauthorized } from './errors';

export const Actor = createParamDecorator((_: unknown, ctx: ExecutionContext): ActorContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.auth || !req.membership) throw unauthorized();
  return {
    userId: req.auth.userId,
    workspaceId: req.membership.workspaceId,
    role: req.membership.role,
    correlationId: req.correlationId,
  };
});
