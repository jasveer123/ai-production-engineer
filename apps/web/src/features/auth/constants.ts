import { AUTH_ENDPOINTS } from "@/lib/api"
import { OAUTH_PROVIDER, type OAuthProvider } from "@/lib/constants/auth"

export const OAUTH_ENDPOINT: Record<OAuthProvider, string> = {
  [OAUTH_PROVIDER.GITHUB]: AUTH_ENDPOINTS.GITHUB,
  [OAUTH_PROVIDER.SLACK]: AUTH_ENDPOINTS.SLACK,
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [OAUTH_PROVIDER.GITHUB, OAUTH_PROVIDER.SLACK]

export const AUTH_TOAST = {
  SIGNED_IN: "Signed in",
  SIGNED_OUT: "Signed out",
  ACCOUNT_CREATED: "Account created",
  RESET_LINK_SENT: "Reset link sent",
  PASSWORD_UPDATED: "Password updated",
  EMAIL_CONFIRMED: "Email confirmed",
  VERIFICATION_SENT: "Verification link sent",
  SIGNED_UP: "Check your email",
} as const
