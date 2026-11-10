export const ROLE = {
  OWNER: "owner",
  ADMIN: "admin",
  ENGINEER: "engineer",
  VIEWER: "viewer",
} as const

export const MANAGER_ROLES: string[] = [ROLE.OWNER, ROLE.ADMIN]
