import { z } from "zod"
import { ONCALL_ENDPOINTS, http } from "@/lib/api"
import {
  coverageSchema,
  memberSchema,
  type Coverage,
  scheduleSchema,
  type Member,
  type OverrideRequest,
  type Schedule,
  type ScheduleRequest,
} from "../schemas"

export const oncallService = {
  list: (workspaceId: string) =>
    http.get<Schedule[]>(ONCALL_ENDPOINTS.SCHEDULES(workspaceId), {
      schema: z.array(scheduleSchema),
    }),

  members: (workspaceId: string) =>
    http.get<Member[]>(ONCALL_ENDPOINTS.MEMBERS(workspaceId), { schema: z.array(memberSchema) }),

  create: (workspaceId: string, body: ScheduleRequest) =>
    http.post<Schedule>(ONCALL_ENDPOINTS.SCHEDULES(workspaceId), body, { schema: scheduleSchema }),

  update: (workspaceId: string, id: string, body: Partial<ScheduleRequest>) =>
    http.patch<Schedule>(ONCALL_ENDPOINTS.SCHEDULE(workspaceId, id), body, {
      schema: scheduleSchema,
    }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(ONCALL_ENDPOINTS.SCHEDULE(workspaceId, id)),

  addOverride: (workspaceId: string, id: string, body: OverrideRequest) =>
    http.post<Schedule>(ONCALL_ENDPOINTS.OVERRIDES(workspaceId, id), body, {
      schema: scheduleSchema,
    }),

  removeOverride: (workspaceId: string, id: string) =>
    http.delete<void>(ONCALL_ENDPOINTS.OVERRIDE(workspaceId, id)),

  coverage: (workspaceId: string, id: string, from: string, to: string) =>
    http.get<Coverage>(ONCALL_ENDPOINTS.COVERAGE(workspaceId, id), {
      query: { from, to },
      schema: coverageSchema,
    }),

  enableCalendar: (workspaceId: string, id: string) =>
    http.post<{ url: string }>(ONCALL_ENDPOINTS.CALENDAR_LINK(workspaceId, id), undefined, {
      schema: z.object({ url: z.string() }),
    }),

  revokeCalendar: (workspaceId: string, id: string) =>
    http.delete<void>(ONCALL_ENDPOINTS.CALENDAR_LINK(workspaceId, id)),
}
