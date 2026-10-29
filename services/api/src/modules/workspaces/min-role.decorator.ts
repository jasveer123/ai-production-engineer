import { SetMetadata } from '@nestjs/common';
import type { Role } from '@ape/api-contracts';

export const MIN_ROLE_KEY = 'minRole';

export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);
