import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-correlation-id';
const VALID = /^[A-Za-z0-9-]{8,64}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header(HEADER);
    req.correlationId = incoming && VALID.test(incoming) ? incoming : randomUUID();
    res.setHeader(HEADER, req.correlationId);
    trace.getActiveSpan()?.setAttribute('correlation_id', req.correlationId);
    next();
  }
}
