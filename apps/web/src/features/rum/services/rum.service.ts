import { z } from "zod"
import { RUM_ENDPOINTS, http } from "@/lib/api"
import {
  appSchema,
  eventSummarySchema,
  funnelResultSchema,
  funnelSchema,
  overviewSchema,
  replaySchema,
  sessionDetailSchema,
  sessionSchema,
  userSchema,
  vitalsReportSchema,
  type Funnel,
  type FunnelResult,
  type NewFunnel,
  type RumAppSettings,
  type RumVitalsReport,
  type SessionFilters,
  type RumApp,
  type RumEventSummary,
  type RumOverview,
  type RumReplay,
  type RumSession,
  type RumSessionDetail,
  type RumUser,
} from "../schemas"

interface Range {
  appId?: string
  minutes: number
}

const query = (r: Range) => ({ minutes: r.minutes, ...(r.appId ? { appId: r.appId } : {}) })

export const rumService = {
  apps: (ws: string) => http.get<RumApp[]>(RUM_ENDPOINTS.APPS(ws), { schema: z.array(appSchema) }),
  createApp: (ws: string, name: string) =>
    http.post<RumApp>(RUM_ENDPOINTS.APPS(ws), { name }, { schema: appSchema }),
  removeApp: (ws: string, id: string) => http.delete<void>(RUM_ENDPOINTS.APP(ws, id)),
  updateApp: (ws: string, id: string, body: Partial<RumAppSettings>) =>
    http.patch<RumApp>(RUM_ENDPOINTS.APP(ws, id), body, { schema: appSchema }),
  vitals: (ws: string, r: Range) =>
    http.get<RumVitalsReport>(RUM_ENDPOINTS.VITALS(ws), {
      query: query(r),
      schema: vitalsReportSchema,
    }),

  overview: (ws: string, r: Range) =>
    http.get<RumOverview>(RUM_ENDPOINTS.OVERVIEW(ws), { query: query(r), schema: overviewSchema }),

  sessions: (ws: string, r: SessionFilters) =>
    http.get<RumSession[]>(RUM_ENDPOINTS.SESSIONS(ws), {
      query: {
        ...query({ appId: r.appId || undefined, minutes: r.minutes }),
        ...(r.hasErrors ? { hasErrors: "true" } : {}),
        ...(r.q ? { q: r.q } : {}),
        ...(r.userId ? { userId: r.userId } : {}),
        ...(r.browser ? { browser: r.browser } : {}),
        ...(r.device ? { device: r.device } : {}),
        ...(r.country.length === 2 ? { country: r.country } : {}),
        ...(r.minSeconds > 0 ? { minSeconds: r.minSeconds } : {}),
      },
      schema: z.array(sessionSchema),
    }),
  session: (ws: string, id: string) =>
    http.get<RumSessionDetail>(RUM_ENDPOINTS.SESSION(ws, id), { schema: sessionDetailSchema }),
  replay: (ws: string, id: string) =>
    http.get<RumReplay>(RUM_ENDPOINTS.REPLAY(ws, id), { schema: replaySchema }),

  users: (ws: string, r: Range) =>
    http.get<RumUser[]>(RUM_ENDPOINTS.USERS(ws), { query: query(r), schema: z.array(userSchema) }),
  events: (ws: string, r: Range) =>
    http.get<RumEventSummary[]>(RUM_ENDPOINTS.EVENTS(ws), {
      query: query(r),
      schema: z.array(eventSummarySchema),
    }),

  funnels: (ws: string) =>
    http.get<Funnel[]>(RUM_ENDPOINTS.FUNNELS(ws), { schema: z.array(funnelSchema) }),
  createFunnel: (ws: string, body: NewFunnel) =>
    http.post<Funnel>(RUM_ENDPOINTS.FUNNELS(ws), body, { schema: funnelSchema }),
  removeFunnel: (ws: string, id: string) => http.delete<void>(RUM_ENDPOINTS.FUNNEL(ws, id)),
  funnelResult: (ws: string, id: string, minutes: number) =>
    http.get<FunnelResult>(RUM_ENDPOINTS.FUNNEL_RESULT(ws, id), {
      query: { minutes },
      schema: funnelResultSchema,
    }),
}
