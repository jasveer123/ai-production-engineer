export const ROUTES = {
  home: "/",
  login: "/login",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  checkEmail: "/check-email",
  dashboard: "/dashboard",
  liveTail: "/live-tail",
  integrations: "/integrations",
  integrationDetail: (id: string) => `/integrations/${id}`,
  collectorDocs: (anchor?: string) => `/docs/collector${anchor ? `#${anchor}` : ""}`,
  integrationDocs: (id: string) => `/docs/integrations/${id}`,
  designSystem: "/design-system",
} as const

export const AUTH_PAGE_PATHS: string[] = [
  ROUTES.login,
  ROUTES.signUp,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.verifyEmail,
  ROUTES.checkEmail,
]
