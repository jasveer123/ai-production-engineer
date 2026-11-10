import { CONTENT_TYPE, HEADER } from "../../config"
import type { RequestInterceptor } from "../../core/types"

export const jsonHeaders: RequestInterceptor = (config) => ({
  ...config,
  headers: {
    [HEADER.ACCEPT]: CONTENT_TYPE.JSON,
    ...(config.body !== undefined && { [HEADER.CONTENT_TYPE]: CONTENT_TYPE.JSON }),
    ...config.headers,
  },
})
