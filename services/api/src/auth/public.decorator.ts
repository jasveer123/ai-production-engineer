import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips the global session guard. Use only for login, OAuth callback and health routes. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
