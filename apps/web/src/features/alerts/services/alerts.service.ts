import { z } from "zod"
import { ALERTS_ENDPOINTS, http } from "@/lib/api"
import {
  alertRouteSchema,
  alertSourceSchema,
  alertSourceWithTokenSchema,
  alertReceiptSchema,
  alertViewSchema,
  heartbeatDetailSchema,
  routePreviewSchema,
  type AlertReceipt,
  type AlertRoute,
  type AlertSource,
  type AlertSourceWithToken,
  type AlertView,
  type CreateSourceRequest,
  type HeartbeatDetail,
  type RoutePreview,
  type RouteRequest,
  type UpdateSourceRequest,
} from "../schemas"

export const alertsService = {
  alerts: (workspaceId: string, status: string, sourceId?: string) =>
    http.get<AlertView[]>(ALERTS_ENDPOINTS.ALERTS(workspaceId), {
      query: {
        limit: 100,
        ...(status !== "all" ? { status } : {}),
        ...(sourceId ? { sourceId } : {}),
      },
      schema: z.array(alertViewSchema),
    }),

  updateSource: (workspaceId: string, id: string, body: UpdateSourceRequest) =>
    http.patch<AlertSource>(ALERTS_ENDPOINTS.SOURCE(workspaceId, id), body, {
      schema: alertSourceSchema,
    }),

  heartbeat: (workspaceId: string, id: string) =>
    http.get<HeartbeatDetail>(ALERTS_ENDPOINTS.HEARTBEAT(workspaceId, id), {
      schema: heartbeatDetailSchema,
    }),

  receipts: (workspaceId: string, id: string) =>
    http.get<AlertReceipt[]>(ALERTS_ENDPOINTS.RECEIPTS(workspaceId, id), {
      schema: z.array(alertReceiptSchema),
    }),

  replay: (workspaceId: string, id: string, receiptId: string) =>
    http.post<AlertReceipt>(ALERTS_ENDPOINTS.REPLAY(workspaceId, id, receiptId), undefined, {
      schema: alertReceiptSchema,
    }),

  previewRoute: (workspaceId: string, sourceId: string, payload: unknown) =>
    http.post<RoutePreview>(
      ALERTS_ENDPOINTS.ROUTE_PREVIEW(workspaceId),
      { sourceId, payload },
      { schema: routePreviewSchema }
    ),

  sources: (workspaceId: string) =>
    http.get<AlertSource[]>(ALERTS_ENDPOINTS.SOURCES(workspaceId), {
      schema: z.array(alertSourceSchema),
    }),

  createSource: (workspaceId: string, body: CreateSourceRequest) =>
    http.post<AlertSourceWithToken>(ALERTS_ENDPOINTS.SOURCES(workspaceId), body, {
      schema: alertSourceWithTokenSchema,
    }),

  rotateSource: (workspaceId: string, id: string) =>
    http.post<AlertSourceWithToken>(ALERTS_ENDPOINTS.ROTATE_SOURCE(workspaceId, id), undefined, {
      schema: alertSourceWithTokenSchema,
    }),

  deleteSource: (workspaceId: string, id: string) =>
    http.delete<void>(ALERTS_ENDPOINTS.SOURCE(workspaceId, id)),

  routes: (workspaceId: string) =>
    http.get<AlertRoute[]>(ALERTS_ENDPOINTS.ROUTES(workspaceId), {
      schema: z.array(alertRouteSchema),
    }),

  createRoute: (workspaceId: string, body: RouteRequest) =>
    http.post<AlertRoute>(ALERTS_ENDPOINTS.ROUTES(workspaceId), body, { schema: alertRouteSchema }),

  updateRoute: (workspaceId: string, id: string, body: Partial<RouteRequest>) =>
    http.patch<AlertRoute>(ALERTS_ENDPOINTS.ROUTE(workspaceId, id), body, {
      schema: alertRouteSchema,
    }),

  deleteRoute: (workspaceId: string, id: string) =>
    http.delete<void>(ALERTS_ENDPOINTS.ROUTE(workspaceId, id)),

  reorderRoutes: (workspaceId: string, ids: string[]) =>
    http.put<unknown>(ALERTS_ENDPOINTS.ROUTE_ORDER(workspaceId), { ids }),
}
