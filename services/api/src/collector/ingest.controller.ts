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
  type CreateIngestTokenInput,
  type IngestOverview,
  type IngestTokenWithSecret,
  type LogSearchResult,
} from '@ape/api-contracts';
import type { z } from 'zod';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { IngestTokensService } from './ingest-tokens.service';
import { IngestService } from './ingest.service';

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class IngestController {
  constructor(
    private readonly ingest: IngestService,
    private readonly tokens: IngestTokensService,
  ) {}

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
    return this.tokens.create(actor, body.name);
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
