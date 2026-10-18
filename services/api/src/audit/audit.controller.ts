import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { auditQuerySchema, type AuditEvent } from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { AuditService } from './audit.service';

@Controller('workspaces/:workspaceId/audit-events')
@UseGuards(WorkspaceAccessGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @MinRole('admin')
  list(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(auditQuerySchema))
    query: ReturnType<typeof auditQuerySchema.parse>,
  ): Promise<AuditEvent[]> {
    return this.audit.list(actor.workspaceId, query);
  }
}
