import { proxyRequest } from "@/lib/bff"

type Context = RouteContext<"/api/[...path]">

async function handler(request: Request, context: Context) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
}
