export const AUTH_ENDPOINTS = {
  PROVIDERS: "/auth/providers",
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  REFRESH: "/auth/refresh",
  RESEND_VERIFICATION: "/auth/resend-verification",
  ME: "/auth/me",
  FORGOT_PASSWORD: "/auth/forgot-password",
  RESET_PASSWORD: "/auth/reset-password",
  VERIFY_EMAIL: "/auth/verify-email",
  GITHUB: "/auth/github",
  SLACK: "/auth/slack",
} as const
