import { z } from "zod"
import { STATUS_ENDPOINTS, http } from "@/lib/api"
import {
  maintenanceSchema,
  notificationSchema,
  pageSchema,
  reportSchema,
  structureSchema,
  subscriberSchema,
  type DeliveryNotice,
  type Maintenance,
  type Report,
  type StatusPage,
  type Structure,
  type Subscriber,
} from "../schemas"
import type {
  MaintenanceRequest,
  PageRequest,
  ReportRequest,
  ReportUpdateRequest,
  SettingsRequest,
} from "../requests"

const E = STATUS_ENDPOINTS

export const statusService = {
  list: (ws: string) => http.get<StatusPage[]>(E.PAGES(ws), { schema: z.array(pageSchema) }),
  get: (ws: string, id: string) => http.get<StatusPage>(E.PAGE(ws, id), { schema: pageSchema }),
  create: (ws: string, body: PageRequest) =>
    http.post<StatusPage>(E.PAGES(ws), body, { schema: pageSchema }),
  update: (ws: string, id: string, body: SettingsRequest) =>
    http.patch<StatusPage>(E.PAGE(ws, id), body, { schema: pageSchema }),
  remove: (ws: string, id: string) => http.delete<void>(E.PAGE(ws, id)),
  verifyDomain: (ws: string, id: string) =>
    http.post<StatusPage>(E.VERIFY(ws, id), {}, { schema: pageSchema }),

  structure: (ws: string, id: string) =>
    http.get<Structure>(E.STRUCTURE(ws, id), { schema: structureSchema }),
  saveStructure: (ws: string, id: string, body: unknown) =>
    http.put<Structure>(E.STRUCTURE(ws, id), body, { schema: structureSchema }),

  reports: (ws: string, id: string) =>
    http.get<Report[]>(E.REPORTS(ws, id), { schema: z.array(reportSchema) }),
  createReport: (ws: string, id: string, body: ReportRequest) =>
    http.post<unknown>(E.REPORTS(ws, id), body),
  editReport: (ws: string, id: string, reportId: string, body: { title: string }) =>
    http.patch<void>(E.REPORT(ws, id, reportId), body),
  removeReport: (ws: string, id: string, reportId: string) =>
    http.delete<void>(E.REPORT(ws, id, reportId)),
  addUpdate: (ws: string, id: string, reportId: string, body: ReportUpdateRequest) =>
    http.post<unknown>(E.REPORT_UPDATES(ws, id, reportId), body),
  removeUpdate: (ws: string, id: string, reportId: string, updateId: string) =>
    http.delete<void>(E.REPORT_UPDATE(ws, id, reportId, updateId)),

  maintenances: (ws: string, id: string) =>
    http.get<Maintenance[]>(E.MAINTENANCES(ws, id), { schema: z.array(maintenanceSchema) }),
  createMaintenance: (ws: string, id: string, body: MaintenanceRequest) =>
    http.post<unknown>(E.MAINTENANCES(ws, id), body),
  removeMaintenance: (ws: string, id: string, maintenanceId: string) =>
    http.delete<void>(E.MAINTENANCE(ws, id, maintenanceId)),

  subscribers: (ws: string, id: string) =>
    http.get<Subscriber[]>(E.SUBSCRIBERS(ws, id), { schema: z.array(subscriberSchema) }),
  addSubscriber: (ws: string, id: string, email: string) =>
    http.post<unknown>(E.SUBSCRIBERS(ws, id), { email }),
  removeSubscriber: (ws: string, id: string, subscriberId: string) =>
    http.delete<void>(E.SUBSCRIBER(ws, id, subscriberId)),
  notifications: (ws: string, id: string) =>
    http.get<DeliveryNotice[]>(E.NOTIFICATIONS(ws, id), { schema: z.array(notificationSchema) }),
}
