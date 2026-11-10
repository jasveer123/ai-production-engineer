import { COOKIE_PATH_REWRITES } from "./constants"

const PATH_ATTRIBUTE = /;\s*path=([^;]*)/i

export function rewriteSetCookie(cookie: string): string {
  return cookie.replace(PATH_ATTRIBUTE, (match, path: string) => {
    const rewritten = COOKIE_PATH_REWRITES[path.trim()]
    return rewritten ? `; Path=${rewritten}` : match
  })
}
