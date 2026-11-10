import { WORKSPACE_ENDPOINTS, http } from "@/lib/api"
import { incidentSchema, type Incident } from "../schemas"
import { z } from "zod"

const OPEN_STATUS = "open"
const INCIDENT_LIMIT = 50

export const incidentsService = {
  listOpen: (workspaceId: string) =>
    http.get<Incident[]>(WORKSPACE_ENDPOINTS.INCIDENTS(workspaceId), {
      query: { status: OPEN_STATUS, limit: INCIDENT_LIMIT },
      schema: z.array(incidentSchema),
    }),
}
