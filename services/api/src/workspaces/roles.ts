import type { Role } from '@ape/api-contracts';

const RANK: Record<Role, number> = { viewer: 0, engineer: 1, admin: 2, owner: 3 };

/** True when `role` is at least as privileged as `required`. */
export function hasRole(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

/**
 * Whether an actor may grant `target` or change a member who currently holds `current`.
 * Only owners can create, modify or remove owners; admins manage everyone below owner.
 */
export function canManageRole(actor: Role, current: Role | null, target: Role): boolean {
  if (!hasRole(actor, 'admin')) return false;
  if (actor === 'owner') return true;
  return current !== 'owner' && target !== 'owner';
}
