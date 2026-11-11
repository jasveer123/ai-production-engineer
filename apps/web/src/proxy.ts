import { NextResponse, type NextRequest } from "next/server"

const APP_HOSTS = (process.env.APP_HOSTS ?? "localhost,127.0.0.1")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean)

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0]!.toLowerCase()
  const isApp = !host || APP_HOSTS.some((app) => host === app || host.endsWith(`.${app}`))
  if (isApp || request.nextUrl.pathname !== "/") return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/status/by-domain/${encodeURIComponent(host)}`
  return NextResponse.rewrite(url)
}

export const config = { matcher: ["/"] }
