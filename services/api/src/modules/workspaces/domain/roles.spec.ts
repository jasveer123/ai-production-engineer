import { canManageRole, hasRole } from './roles';

describe('hasRole', () => {
  it.each([
    ['owner', 'admin', true],
    ['admin', 'admin', true],
    ['engineer', 'admin', false],
    ['viewer', 'engineer', false],
    ['viewer', 'viewer', true],
  ] as const)('%s >= %s is %s', (role, required, expected) => {
    expect(hasRole(role, required)).toBe(expected);
  });
});

describe('canManageRole', () => {
  it('lets owners manage owners', () => {
    expect(canManageRole('owner', 'owner', 'admin')).toBe(true);
    expect(canManageRole('owner', null, 'owner')).toBe(true);
  });

  it('lets admins manage roles below owner', () => {
    expect(canManageRole('admin', 'viewer', 'engineer')).toBe(true);
    expect(canManageRole('admin', null, 'admin')).toBe(true);
  });

  it('stops admins from granting or touching the owner role', () => {
    expect(canManageRole('admin', null, 'owner')).toBe(false);
    expect(canManageRole('admin', 'owner', 'viewer')).toBe(false);
  });

  it('stops engineers and viewers from managing anyone', () => {
    expect(canManageRole('engineer', 'viewer', 'viewer')).toBe(false);
    expect(canManageRole('viewer', null, 'viewer')).toBe(false);
  });
});
