import { HTTP_METHOD } from "../config"
import type { RequestFn, RequestOptions } from "../core/types"

export const createDelete =
  (request: RequestFn) =>
  <T>(url: string, options?: RequestOptions) =>
    request<T>({ ...options, url, method: HTTP_METHOD.DELETE })
