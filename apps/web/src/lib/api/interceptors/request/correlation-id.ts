import { HEADER } from "../../config"
import type { RequestInterceptor } from "../../core/types"

export const correlationId: RequestInterceptor = (config) => ({
  ...config,
  headers: { [HEADER.CORRELATION_ID]: crypto.randomUUID(), ...config.headers },
})
