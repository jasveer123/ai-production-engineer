"use client"

import * as React from "react"
import type { TokenSecret } from "./types"

export interface TokenSecretValue {
  secret: TokenSecret | null
  setSecret: (secret: TokenSecret | null) => void
}

export const TokenSecretContext = React.createContext<TokenSecretValue | null>(null)
