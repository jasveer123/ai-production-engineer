import type { Role } from '@ape/api-contracts';

const RANK: Record<Role, number> = { viewer: 0, engineer: 1, admin: 2, owner: 3 };

export function hasRole(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export function assignableRoles(actor: Role): Role[] {
  if (actor === 'owner') return ['owner', 'admin', 'engineer', 'viewer'];
  if (actor === 'admin') return ['admin', 'engineer', 'viewer'];
  return [];
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  viewer: 'Viewer',
};

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (/^\/(login|register|forgot-password|reset-password)\b/.test(next)) return '/';
  return next;
}
