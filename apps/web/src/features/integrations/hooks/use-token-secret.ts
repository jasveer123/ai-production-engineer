"use client"

import * as React from "react"
import { TokenSecretContext } from "../token-secret-context"

export function useTokenSecret() {
  const value = React.useContext(TokenSecretContext)
  if (!value) throw new Error("useTokenSecret must be used inside TokenSecretProvider")
  return value
}
