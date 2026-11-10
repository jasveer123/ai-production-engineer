const DEFAULT_UPSTREAM_API_URL = "http://localhost:4000"

export const UPSTREAM_API_URL = (process.env.API_URL ?? DEFAULT_UPSTREAM_API_URL).replace(/\/$/, "")
