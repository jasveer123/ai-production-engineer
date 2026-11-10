"use client"

import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { createQueryClient } from "@/lib/query"

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = React.useState(createQueryClient)

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
