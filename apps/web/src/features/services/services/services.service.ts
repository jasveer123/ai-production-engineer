import { z } from "zod"
import { EXPLORE_ENDPOINTS, INGEST_ENDPOINTS, SERVICES_ENDPOINTS, http } from "@/lib/api"
import {
  businessImpactSchema,
  registeredServiceSchema,
  serviceMapSchema,
  serviceSummarySchema,
  type BusinessImpact,
  type RegisteredService,
  type ServiceMap,
  type ServiceSummary,
  type SetValueRequest,
} from "../schemas"

export const servicesService = {
  summary: (workspaceId: string, hours: number) =>
    http.get<ServiceSummary>(INGEST_ENDPOINTS.SERVICE_SUMMARY(workspaceId), {
      query: { hours },
      schema: serviceSummarySchema,
    }),

  registered: (workspaceId: string) =>
    http.get<RegisteredService[]>(SERVICES_ENDPOINTS.LIST(workspaceId), {
      schema: z.array(registeredServiceSchema),
    }),

  map: (workspaceId: string, range: string) =>
    http.get<ServiceMap>(EXPLORE_ENDPOINTS.SERVICE_MAP(workspaceId), {
      query: { range },
      schema: serviceMapSchema,
    }),

  impact: (workspaceId: string, days: number) =>
    http.get<BusinessImpact>(SERVICES_ENDPOINTS.IMPACT(workspaceId), {
      query: { days },
      schema: businessImpactSchema,
    }),

  setValue: async (workspaceId: string, request: SetValueRequest) => {
    const serviceId =
      request.serviceId ??
      (
        await http.post<RegisteredService>(
          SERVICES_ENDPOINTS.LIST(workspaceId),
          { name: request.name, environment: request.environment },
          { schema: registeredServiceSchema }
        )
      ).id
    return http.put<unknown>(SERVICES_ENDPOINTS.VALUE(workspaceId, serviceId), {
      valuePerRequest: request.valuePerRequest,
      currency: request.currency,
    })
  },
}
