import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, output } from 'zod';
import { ApiException } from './errors';

/** Validates a body or query against a shared Zod schema from @ape/api-contracts. */
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<unknown, output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        'Request validation failed',
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    return result.data as output<T>;
  }
}
