import { z } from "zod"
import { LOG_ALERTS_ENDPOINTS, http } from "@/lib/api"
import { logAlertSchema, type LogAlert, type LogAlertRequest } from "../schemas"

export const logAlertsService = {
  list: (workspaceId: string) =>
    http.get<LogAlert[]>(LOG_ALERTS_ENDPOINTS.LIST(workspaceId), {
      schema: z.array(logAlertSchema),
    }),

  create: (workspaceId: string, body: LogAlertRequest) =>
    http.post<LogAlert>(LOG_ALERTS_ENDPOINTS.LIST(workspaceId), body, { schema: logAlertSchema }),

  update: (workspaceId: string, id: string, body: { paused: boolean }) =>
    http.patch<LogAlert>(LOG_ALERTS_ENDPOINTS.ONE(workspaceId, id), body, {
      schema: logAlertSchema,
    }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(LOG_ALERTS_ENDPOINTS.ONE(workspaceId, id)),

  check: (workspaceId: string, id: string) =>
    http.post<LogAlert>(
      LOG_ALERTS_ENDPOINTS.CHECK(workspaceId, id),
      {},
      { schema: logAlertSchema }
    ),
}
