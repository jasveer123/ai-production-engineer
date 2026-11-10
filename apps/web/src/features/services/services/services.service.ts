import { z } from "zod"
import { INGEST_ENDPOINTS, SERVICES_ENDPOINTS, http } from "@/lib/api"
import {
  businessImpactSchema,
  registeredServiceSchema,
  serviceSummarySchema,
  type BusinessImpact,
  type RegisteredService,
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
