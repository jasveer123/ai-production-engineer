import type { Role } from '@ape/api-contracts';

const RANK: Record<Role, number> = { viewer: 0, engineer: 1, admin: 2, owner: 3 };

/** UI-only hint for hiding controls. The API enforces the real check. */
export const atLeast = (role: Role | undefined, required: Role) =>
  role !== undefined && RANK[role] >= RANK[required];
