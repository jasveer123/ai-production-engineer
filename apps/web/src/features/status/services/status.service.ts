import { z } from "zod"
import { STATUS_ENDPOINTS, http } from "@/lib/api"
import {
  pageSchema,
  publicSchema,
  type PageRequest,
  type PublicStatus,
  type StatusPage,
  type UpdateRequest,
} from "../schemas"

export const statusService = {
  list: (workspaceId: string) =>
    http.get<StatusPage[]>(STATUS_ENDPOINTS.PAGES(workspaceId), { schema: z.array(pageSchema) }),

  create: (workspaceId: string, body: PageRequest) =>
    http.post<StatusPage>(STATUS_ENDPOINTS.PAGES(workspaceId), body, { schema: pageSchema }),

  update: (workspaceId: string, id: string, body: Partial<PageRequest>) =>
    http.patch<StatusPage>(STATUS_ENDPOINTS.PAGE(workspaceId, id), body, { schema: pageSchema }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(STATUS_ENDPOINTS.PAGE(workspaceId, id)),

  postUpdate: (workspaceId: string, id: string, body: UpdateRequest) =>
    http.post<StatusPage>(STATUS_ENDPOINTS.UPDATES(workspaceId, id), body, { schema: pageSchema }),

  removeUpdate: (workspaceId: string, id: string, updateId: string) =>
    http.delete<void>(STATUS_ENDPOINTS.UPDATE(workspaceId, id, updateId)),

  setDomain: (workspaceId: string, id: string, customDomain: string | null) =>
    http.patch<StatusPage>(
      STATUS_ENDPOINTS.PAGE(workspaceId, id),
      { customDomain },
      { schema: pageSchema }
    ),

  verifyDomain: (workspaceId: string, id: string) =>
    http.post<StatusPage>(STATUS_ENDPOINTS.VERIFY(workspaceId, id), {}, { schema: pageSchema }),

  subscribe: (slug: string, email: string) =>
    http.post<unknown>(STATUS_ENDPOINTS.SUBSCRIBE(slug), { email }),

  subscription: (action: "confirm" | "unsubscribe", token: string) =>
    http.get<{ page: string }>(
      action === "confirm" ? STATUS_ENDPOINTS.CONFIRM : STATUS_ENDPOINTS.UNSUBSCRIBE,
      { query: { token }, schema: z.object({ page: z.string() }) }
    ),

  publicByDomain: (host: string) =>
    http.get<PublicStatus>(STATUS_ENDPOINTS.BY_DOMAIN(host), { schema: publicSchema }),

  publicView: (slug: string) =>
    http.get<PublicStatus>(STATUS_ENDPOINTS.PUBLIC(slug), { schema: publicSchema }),
}
