import { z } from "zod"
import { MONITORS_ENDPOINTS, http } from "@/lib/api"
import {
  monitorDetailSchema,
  monitorSchema,
  type CreateMonitorRequest,
  type Monitor,
  type MonitorDetail,
  type UpdateMonitorRequest,
} from "../schemas"

export const monitorsService = {
  list: (workspaceId: string) =>
    http.get<Monitor[]>(MONITORS_ENDPOINTS.LIST(workspaceId), { schema: z.array(monitorSchema) }),

  get: (workspaceId: string, id: string) =>
    http.get<MonitorDetail>(MONITORS_ENDPOINTS.ONE(workspaceId, id), {
      schema: monitorDetailSchema,
    }),

  create: (workspaceId: string, body: CreateMonitorRequest) =>
    http.post<Monitor>(MONITORS_ENDPOINTS.LIST(workspaceId), body, { schema: monitorSchema }),

  update: (workspaceId: string, id: string, body: UpdateMonitorRequest) =>
    http.patch<Monitor>(MONITORS_ENDPOINTS.ONE(workspaceId, id), body, { schema: monitorSchema }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(MONITORS_ENDPOINTS.ONE(workspaceId, id)),

  check: (workspaceId: string, id: string) =>
    http.post<MonitorDetail>(MONITORS_ENDPOINTS.CHECK(workspaceId, id), undefined, {
      schema: monitorDetailSchema,
    }),
}
