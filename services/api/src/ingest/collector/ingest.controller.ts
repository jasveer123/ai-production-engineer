import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createIngestTokenSchema,
  logQuerySchema,
  serviceSummaryQuerySchema,
  type CreateIngestTokenInput,
  type IngestBatchView,
  type IngestOverview,
  type IngestTokenWithSecret,
  type LogSearchResult,
  type ServiceSummaryResult,
} from '@ape/api-contracts';
import type { z } from 'zod';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../../modules/workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../../modules/workspaces/workspace-access.guard';
import { IngestTokensService } from './application/ingest-tokens.service';
import { IngestService } from './application/ingest.service';
import { IngestReceipts } from './application/ingest-receipts.service';

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class IngestController {
  constructor(
    private readonly ingest: IngestService,
    private readonly tokens: IngestTokensService,
    private readonly receipts: IngestReceipts,
  ) {}

  @Get('ingest/batches')
  batches(@Actor() actor: ActorContext): Promise<IngestBatchView[]> {
    return this.receipts.list(actor.workspaceId, 100);
  }

  @Get('ingest')
  overview(@Actor() actor: ActorContext): Promise<IngestOverview> {
    return this.ingest.overview(actor.workspaceId);
  }

  @Post('ingest/tokens')
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createIngestTokenSchema)) body: CreateIngestTokenInput,
  ): Promise<IngestTokenWithSecret> {
    return this.tokens.create(actor, body.name, body.platform);
  }

  @Post('ingest/tokens/:tokenId/rotate')
  @MinRole('admin')
  @HttpCode(200)
  rotate(
    @Actor() actor: ActorContext,
    @Param('tokenId', ParseUUIDPipe) id: string,
  ): Promise<IngestTokenWithSecret> {
    return this.tokens.rotate(actor, id);
  }

  @Delete('ingest/tokens/:tokenId')
  @MinRole('admin')
  @HttpCode(204)
  revoke(@Actor() actor: ActorContext, @Param('tokenId', ParseUUIDPipe) id: string): Promise<void> {
    return this.tokens.revoke(actor, id);
  }

  @Get('logs/services')
  serviceSummary(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(serviceSummaryQuerySchema))
    query: z.output<typeof serviceSummaryQuerySchema>,
  ): Promise<ServiceSummaryResult> {
    return this.ingest.serviceSummary(actor.workspaceId, query.hours);
  }

  @Get('logs')
  logs(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(logQuerySchema)) query: z.output<typeof logQuerySchema>,
  ): Promise<LogSearchResult> {
    return this.ingest.searchLogs(actor.workspaceId, query);
  }

  @Get('traces/:traceId')
  trace(@Actor() actor: ActorContext, @Param('traceId') traceId: string) {
    return this.ingest.trace(actor.workspaceId, traceId.slice(0, 64));
  }
}
