import { HttpException, HttpStatus } from '@nestjs/common';

/** Domain error that maps to the structured API error format `{code, message, correlationId}`. */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}

export const notFound = (what = 'Resource') =>
  new ApiException(HttpStatus.NOT_FOUND, 'not_found', `${what} not found`);

export const forbidden = (message = 'You do not have permission to do this') =>
  new ApiException(HttpStatus.FORBIDDEN, 'forbidden', message);

export const conflict = (message: string) =>
  new ApiException(HttpStatus.CONFLICT, 'conflict', message);

export const unauthorized = () =>
  new ApiException(HttpStatus.UNAUTHORIZED, 'unauthenticated', 'Sign in required');

/** Postgres unique-violation check, for turning constraint errors into 409s. */
export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } } | null)?.code;
  const causeCode = (err as { cause?: { code?: string } } | null)?.cause?.code;
  return code === '23505' || causeCode === '23505';
}
