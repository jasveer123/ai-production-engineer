import { z } from "zod"
import { ASSISTANT_ENDPOINTS, http } from "@/lib/api"
import {
  conversationDetailSchema,
  conversationSchema,
  type Conversation,
  type ConversationDetail,
} from "../schemas"

export const assistantService = {
  list: (workspaceId: string) =>
    http.get<Conversation[]>(ASSISTANT_ENDPOINTS.LIST(workspaceId), {
      schema: z.array(conversationSchema),
    }),

  get: (workspaceId: string, id: string) =>
    http.get<ConversationDetail>(ASSISTANT_ENDPOINTS.ONE(workspaceId, id), {
      schema: conversationDetailSchema,
    }),

  start: (workspaceId: string, message: string) =>
    http.post<ConversationDetail>(
      ASSISTANT_ENDPOINTS.LIST(workspaceId),
      { message },
      { schema: conversationDetailSchema }
    ),

  ask: (workspaceId: string, id: string, message: string) =>
    http.post<ConversationDetail>(
      ASSISTANT_ENDPOINTS.MESSAGES(workspaceId, id),
      { message },
      { schema: conversationDetailSchema }
    ),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(ASSISTANT_ENDPOINTS.ONE(workspaceId, id)),
}
