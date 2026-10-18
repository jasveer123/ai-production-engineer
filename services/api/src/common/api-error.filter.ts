import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@ape/api-contracts';
import { ApiException } from './errors';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  429: 'rate_limited',
};

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const correlationId = req.correlationId ?? 'unknown';

    let status = 500;
    let body: ApiError = { code: 'internal_error', message: 'Something went wrong', correlationId };

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      body = { code: exception.code, message: exception.message, correlationId };
      if (exception.details !== undefined) body.details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = {
        code: CODE_BY_STATUS[status] ?? 'error',
        message: exception.message,
        correlationId,
      };
    } else {
      this.logger.error({ correlationId, err: exception }, 'Unhandled error');
    }

    res.status(status).json(body);
  }
}
