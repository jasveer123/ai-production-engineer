import { z } from "zod"
import { NOTIFICATIONS_ENDPOINTS, http } from "@/lib/api"
import {
  channelSchema,
  channelWithSecretSchema,
  deliverySchema,
  testResultSchema,
  type Channel,
  type ChannelWithSecret,
  type CreateChannelRequest,
  type Delivery,
  type TestResult,
  type UpdateChannelRequest,
} from "../schemas"

export const notificationsService = {
  channels: (workspaceId: string) =>
    http.get<Channel[]>(NOTIFICATIONS_ENDPOINTS.CHANNELS(workspaceId), {
      schema: z.array(channelSchema),
    }),

  create: (workspaceId: string, body: CreateChannelRequest) =>
    http.post<ChannelWithSecret>(NOTIFICATIONS_ENDPOINTS.CHANNELS(workspaceId), body, {
      schema: channelWithSecretSchema,
    }),

  update: (workspaceId: string, id: string, body: UpdateChannelRequest) =>
    http.patch<Channel>(NOTIFICATIONS_ENDPOINTS.CHANNEL(workspaceId, id), body, {
      schema: channelSchema,
    }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(NOTIFICATIONS_ENDPOINTS.CHANNEL(workspaceId, id)),

  test: (workspaceId: string, id: string) =>
    http.post<TestResult>(NOTIFICATIONS_ENDPOINTS.TEST(workspaceId, id), undefined, {
      schema: testResultSchema,
    }),

  deliveries: (workspaceId: string) =>
    http.get<Delivery[]>(NOTIFICATIONS_ENDPOINTS.DELIVERIES(workspaceId), {
      schema: z.array(deliverySchema),
    }),
}
