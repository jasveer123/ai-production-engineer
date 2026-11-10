import * as React from "react"
import { SNIPPET_DEFAULTS } from "../constants"

const subscribe = () => () => undefined

export function useSiteOrigin(): string {
  return React.useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => SNIPPET_DEFAULTS.WEB_URL_PLACEHOLDER
  )
}
