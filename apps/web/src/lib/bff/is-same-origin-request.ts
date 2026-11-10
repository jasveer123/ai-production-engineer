import { HTTP_METHOD } from "@/lib/api/config"

const SAFE_METHODS: string[] = [HTTP_METHOD.GET, "HEAD", "OPTIONS"]

export function isSameOriginRequest(request: Request): boolean {
  if (SAFE_METHODS.includes(request.method)) return true

  const origin = request.headers.get("origin")
  if (!origin) return true

  return new URL(origin).host === request.headers.get("host")
}
