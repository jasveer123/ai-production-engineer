import "server-only"
import { cookies } from "next/headers"
import { HEADER } from "../../config"
import type { RequestInterceptor } from "../../core/types"

export const forwardCookies: RequestInterceptor = async (config) => {
  const store = await cookies()
  const cookieHeader = store.toString()

  return cookieHeader
    ? { ...config, headers: { ...config.headers, [HEADER.COOKIE]: cookieHeader } }
    : config
}
