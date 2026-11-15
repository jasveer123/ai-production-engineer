export const REPORTING_QUERY_KEYS = {
  report: (workspaceId: string, report: string, filters: object) => [
    "reporting",
    workspaceId,
    report,
    filters,
  ],
} as const
