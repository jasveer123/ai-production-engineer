import { AUTH_PAGE_PATHS, ROUTES } from "@/lib/constants/routes"
import type { ApiError } from "../../core/api-error"
import type { ErrorInterceptor } from "../../core/types"

const isBrowser = () => typeof window !== "undefined"

const isOnAuthPage = () => AUTH_PAGE_PATHS.some((path) => window.location.pathname.startsWith(path))

export const redirectOnUnauthorized: ErrorInterceptor = (error: ApiError) => {
  if (isBrowser() && error.isUnauthorized && !error.skipAuthRedirect && !isOnAuthPage()) {
    window.location.assign(ROUTES.login)
  }

  return error
}
