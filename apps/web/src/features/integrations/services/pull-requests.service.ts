import { z } from "zod"
import { WORKSPACE_ENDPOINTS, http } from "@/lib/api"
import { pullRequestSchema, type PullRequest } from "../schemas"

export const pullRequestsService = {
  list: (workspaceId: string) =>
    http.get<PullRequest[]>(WORKSPACE_ENDPOINTS.PULL_REQUESTS(workspaceId), {
      schema: z.array(pullRequestSchema),
    }),
}
