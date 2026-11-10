import { MutationCache, QueryClient } from "@tanstack/react-query"
import { ApiError } from "@/lib/api"
import { notifyError, notifySuccess } from "@/lib/toast"
import { QUERY_RETRY_COUNT, STALE_TIME } from "./constants"

const shouldRetry = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status < 500 && error.status !== 0) &&
  failureCount < QUERY_RETRY_COUNT

export const createQueryClient = () =>
  new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.silent) notifyError(error)
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = mutation.meta?.successMessage
        if (message) notifySuccess(message)
      },
    }),
    defaultOptions: {
      queries: { staleTime: STALE_TIME.DEFAULT, retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
