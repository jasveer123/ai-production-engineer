import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../core/common/errors';

export const badCredentials = () =>
  new ApiException(HttpStatus.UNAUTHORIZED, 'invalid_credentials', 'Wrong email or password');

export const badLink = () =>
  new ApiException(
    HttpStatus.BAD_REQUEST,
    'invalid_link',
    'This link is invalid or has expired. Ask for a new one.',
  );
