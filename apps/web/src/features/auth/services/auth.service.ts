import { AUTH_ENDPOINTS, http } from "@/lib/api"
import {
  providersSchema,
  sessionSchema,
  type ForgotPasswordValues,
  type Providers,
  type Session,
  type LoginRequest,
  type RegisterRequest,
  type ResendVerificationRequest,
  type ResetPasswordRequest,
  type VerifyEmailRequest,
} from "../schemas"

const PUBLIC_REQUEST = { skipAuthRedirect: true, skipAuthRefresh: true } as const

export const authService = {
  providers: () =>
    http.get<Providers>(AUTH_ENDPOINTS.PROVIDERS, { ...PUBLIC_REQUEST, schema: providersSchema }),

  login: (body: LoginRequest) =>
    http.post<Session>(AUTH_ENDPOINTS.LOGIN, body, { ...PUBLIC_REQUEST, schema: sessionSchema }),

  register: (body: RegisterRequest) =>
    http.post<Session | null>(AUTH_ENDPOINTS.REGISTER, body, {
      ...PUBLIC_REQUEST,
      schema: sessionSchema.nullable(),
    }),

  logout: () => http.post<void>(AUTH_ENDPOINTS.LOGOUT, undefined, { skipAuthRedirect: true }),

  me: () => http.get<Session>(AUTH_ENDPOINTS.ME, { schema: sessionSchema }),

  forgotPassword: (body: ForgotPasswordValues) =>
    http.post<void>(AUTH_ENDPOINTS.FORGOT_PASSWORD, body, PUBLIC_REQUEST),

  resetPassword: (body: ResetPasswordRequest) =>
    http.post<Session>(AUTH_ENDPOINTS.RESET_PASSWORD, body, {
      ...PUBLIC_REQUEST,
      schema: sessionSchema,
    }),

  verifyEmail: (body: VerifyEmailRequest) =>
    http.post<Session>(AUTH_ENDPOINTS.VERIFY_EMAIL, body, {
      ...PUBLIC_REQUEST,
      schema: sessionSchema,
    }),

  resendVerification: (body: ResendVerificationRequest) =>
    http.post<void>(AUTH_ENDPOINTS.RESEND_VERIFICATION, body, PUBLIC_REQUEST),
}
