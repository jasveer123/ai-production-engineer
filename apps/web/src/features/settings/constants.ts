export const ROLES = ["owner", "admin", "engineer", "viewer"] as const

export const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including billing limits and approval rules",
  admin: "Manage team, integrations and settings",
  engineer: "Investigate incidents and approve fixes",
  viewer: "Read only",
}

export const PR_ROLES = ["owner", "admin", "engineer"] as const
