"use client"

import * as React from "react"
import { TokenSecretContext } from "../token-secret-context"
import type { TokenSecret } from "../types"

interface TokenSecretProviderProps {
  children: React.ReactNode
}

export function TokenSecretProvider({ children }: TokenSecretProviderProps) {
  const [secret, setSecret] = React.useState<TokenSecret | null>(null)
  const value = React.useMemo(() => ({ secret, setSecret }), [secret])

  return <TokenSecretContext.Provider value={value}>{children}</TokenSecretContext.Provider>
}
