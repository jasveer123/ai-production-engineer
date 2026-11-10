import { HTTP_METHOD } from "../config"
import type { RequestFn, RequestOptions } from "../core/types"

export const createPatch =
  (request: RequestFn) =>
  <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>({ ...options, url, method: HTTP_METHOD.PATCH, body })
