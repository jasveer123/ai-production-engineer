import { SetMetadata } from '@nestjs/common';
import type { Role } from '@ape/api-contracts';

export const MIN_ROLE_KEY = 'minRole';

/** Lowest role allowed to call this route. Routes without it default to `viewer`. */
export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);
