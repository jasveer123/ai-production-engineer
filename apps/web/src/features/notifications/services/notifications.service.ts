import { z } from "zod"
import { NOTIFICATIONS_ENDPOINTS, http } from "@/lib/api"
import {
  channelSchema,
  channelWithSecretSchema,
  contactMethodSchema,
  deliverySchema,
  providersSchema,
  testResultSchema,
  type Channel,
  type ChannelWithSecret,
  type ContactMethod,
  type ContactMethodRequest,
  type CreateChannelRequest,
  type Delivery,
  type DeliveryFilter,
  type Providers,
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

  deliveries: (workspaceId: string, filter: DeliveryFilter) =>
    http.get<Delivery[]>(NOTIFICATIONS_ENDPOINTS.DELIVERIES(workspaceId), {
      query: { state: filter.state, channel: filter.channel },
      schema: z.array(deliverySchema),
    }),

  forIncident: (workspaceId: string, incidentId: string) =>
    http.get<Delivery[]>(NOTIFICATIONS_ENDPOINTS.INCIDENT(workspaceId, incidentId), {
      schema: z.array(deliverySchema),
    }),

  providers: (workspaceId: string) =>
    http.get<Providers>(NOTIFICATIONS_ENDPOINTS.PROVIDERS(workspaceId), {
      schema: providersSchema,
    }),

  contacts: (workspaceId: string) =>
    http.get<ContactMethod[]>(NOTIFICATIONS_ENDPOINTS.CONTACTS(workspaceId), {
      schema: z.array(contactMethodSchema),
    }),

  addContact: (workspaceId: string, body: ContactMethodRequest) =>
    http.post<ContactMethod>(NOTIFICATIONS_ENDPOINTS.CONTACTS(workspaceId), body, {
      schema: contactMethodSchema,
    }),

  removeContact: (workspaceId: string, id: string) =>
    http.delete<void>(NOTIFICATIONS_ENDPOINTS.CONTACT(workspaceId, id)),

  testContact: (workspaceId: string, id: string) =>
    http.post<TestResult>(NOTIFICATIONS_ENDPOINTS.CONTACT_TEST(workspaceId, id), undefined, {
      schema: testResultSchema,
    }),
}
