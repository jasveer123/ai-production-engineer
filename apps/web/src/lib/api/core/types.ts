import type { ZodType } from "zod"
import type { ApiError } from "./api-error"
import type { HttpMethod } from "../config"

export type QueryValue = string | number | boolean | null | undefined

export type QueryParams = Record<string, QueryValue>

export interface RequestConfig {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
  timeoutMs: number
  credentials: RequestCredentials
  cache?: RequestCache
  schema?: ZodType
  skipAuthRedirect?: boolean
  skipAuthRefresh?: boolean
}

export interface RequestOptions {
  headers?: Record<string, string>
  query?: QueryParams
  signal?: AbortSignal
  timeoutMs?: number
  cache?: RequestCache
  schema?: ZodType
  skipAuthRedirect?: boolean
  skipAuthRefresh?: boolean
}

export interface RequestInit extends RequestOptions {
  url: string
  method: HttpMethod
  body?: unknown
}

export interface ApiResponse {
  data: unknown
  status: number
  headers: Headers
  config: RequestConfig
}

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>

export type ResponseInterceptor = (response: ApiResponse) => ApiResponse | Promise<ApiResponse>

export type ErrorInterceptor = (error: ApiError) => ApiError | Promise<ApiError>

export interface Interceptors {
  request: RequestInterceptor[]
  response: ResponseInterceptor[]
  error: ErrorInterceptor[]
}

export type RequestFn = <T>(init: RequestInit) => Promise<T>

export interface HttpClient {
  request: RequestFn
  get: <T>(url: string, options?: RequestOptions) => Promise<T>
  post: <T>(url: string, body?: unknown, options?: RequestOptions) => Promise<T>
  put: <T>(url: string, body?: unknown, options?: RequestOptions) => Promise<T>
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) => Promise<T>
  delete: <T>(url: string, options?: RequestOptions) => Promise<T>
}

export interface HttpClientConfig {
  baseUrl: string
  interceptors: Interceptors
  refreshSession?: () => Promise<void>
}
