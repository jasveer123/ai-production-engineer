import "@tanstack/react-query"

interface AppMutationMeta extends Record<string, unknown> {
  successMessage?: string
  silent?: boolean
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: AppMutationMeta
  }
}
