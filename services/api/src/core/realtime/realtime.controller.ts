import { Controller, Inject, MessageEvent, Req, Sse, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  bufferTime,
  filter,
  from,
  interval,
  map,
  merge,
  type Observable,
  of,
  switchMap,
  takeUntil,
} from 'rxjs';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { WorkspaceAccessGuard } from '../../modules/workspaces/workspace-access.guard';
import { dedupeChanges, RealtimeService } from './realtime.service';

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class RealtimeController {
  constructor(
    private readonly realtime: RealtimeService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  @Sse('stream')
  stream(@Actor() actor: ActorContext, @Req() req: Request): Observable<MessageEvent> {
    const sessionId = req.auth!.sessionId;
    const revoked = interval(this.env.REALTIME_RECHECK_MS).pipe(
      switchMap(() => from(this.realtime.stillAllowed(actor.workspaceId, actor.userId, sessionId))),
      filter((ok) => !ok),
    );
    const changes = this.realtime.changes(actor.workspaceId).pipe(
      bufferTime(this.env.REALTIME_BATCH_MS),
      filter((batch) => batch.length > 0),
      map((batch): MessageEvent => ({ type: 'change', data: dedupeChanges(batch) })),
    );

    const ping = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })));
    return merge(of<MessageEvent>({ type: 'ready', data: {} }), changes, ping).pipe(
      takeUntil(revoked),
    );
  }
}
