import { z } from "zod"
import { STATUS_ENDPOINTS, http } from "@/lib/api"
import { historySchema, publicSchema, type PublicHistory, type PublicStatus } from "../schemas"

export interface PageLookup {
  slug?: string
  host?: string
}

const ACCESS_PREFIX = "pramaan-status-access:"

export const lookupKey = (lookup: PageLookup) =>
  lookup.host ? `host:${lookup.host}` : `slug:${lookup.slug ?? ""}`

export function readAccess(key: string): string | undefined {
  try {
    return sessionStorage.getItem(ACCESS_PREFIX + key) ?? undefined
  } catch {
    return undefined
  }
}

export function storeAccess(key: string, token: string) {
  try {
    sessionStorage.setItem(ACCESS_PREFIX + key, token)
  } catch {
    return
  }
}

const headersFor = (key: string): Record<string, string> => {
  const token = readAccess(key)
  return token ? { "x-status-access": token } : {}
}

const options = { skipAuthRedirect: true, skipAuthRefresh: true }

export const publicStatusService = {
  view: (lookup: PageLookup) =>
    http.get<PublicStatus>(
      lookup.host
        ? STATUS_ENDPOINTS.BY_DOMAIN(lookup.host)
        : STATUS_ENDPOINTS.PUBLIC(lookup.slug ?? ""),
      { schema: publicSchema, headers: headersFor(lookupKey(lookup)), ...options }
    ),

  history: (slug: string, month: string) =>
    http.get<PublicHistory>(STATUS_ENDPOINTS.HISTORY(slug), {
      query: { month },
      schema: historySchema,
      headers: headersFor(lookupKey({ slug })),
      ...options,
    }),

  access: (slug: string, password: string) =>
    http.post<{ token: string }>(
      STATUS_ENDPOINTS.ACCESS(slug),
      { password },
      { schema: z.object({ token: z.string() }), ...options }
    ),

  subscribe: (slug: string, email: string) =>
    http.post<unknown>(STATUS_ENDPOINTS.SUBSCRIBE(slug), { email }, options),

  subscription: (action: "confirm" | "unsubscribe", token: string) =>
    http.get<{ page: string }>(
      action === "confirm" ? STATUS_ENDPOINTS.CONFIRM : STATUS_ENDPOINTS.UNSUBSCRIBE,
      { query: { token }, schema: z.object({ page: z.string() }), ...options }
    ),
}
