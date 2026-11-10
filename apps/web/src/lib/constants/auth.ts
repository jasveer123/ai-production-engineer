export const OAUTH_PROVIDER = {
  GITHUB: "github",
  SLACK: "slack",
} as const

export type OAuthProvider = (typeof OAUTH_PROVIDER)[keyof typeof OAUTH_PROVIDER]

export const OAUTH_PROVIDER_LABEL: Record<OAuthProvider, string> = {
  github: "GitHub",
  slack: "Slack",
}
