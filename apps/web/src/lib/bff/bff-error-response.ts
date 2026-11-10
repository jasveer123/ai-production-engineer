import type { BffError } from "./constants"

export function bffErrorResponse({ status, code, message }: BffError) {
  return Response.json({ code, message }, { status })
}
