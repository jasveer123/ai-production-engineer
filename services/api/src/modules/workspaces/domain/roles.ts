import type { Role } from '@ape/api-contracts';

const RANK: Record<Role, number> = { viewer: 0, engineer: 1, admin: 2, owner: 3 };

export function hasRole(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export function canManageRole(actor: Role, current: Role | null, target: Role): boolean {
  if (!hasRole(actor, 'admin')) return false;
  if (actor === 'owner') return true;
  return current !== 'owner' && target !== 'owner';
}
