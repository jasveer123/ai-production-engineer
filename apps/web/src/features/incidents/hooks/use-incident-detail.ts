import { useQuery } from "@tanstack/react-query"
import { DETAIL_POLL_MS } from "../constants"
import { INCIDENT_QUERY_KEYS } from "../query-keys"
import { incidentsService } from "../services"

export function useIncident(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.one(workspaceId ?? "", id),
    queryFn: () => incidentsService.get(workspaceId!, id),
    enabled: Boolean(workspaceId),
    refetchInterval: DETAIL_POLL_MS,
  })
}

export function useTimeline(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.timeline(workspaceId ?? "", id),
    queryFn: () => incidentsService.timeline(workspaceId!, id),
    enabled: Boolean(workspaceId),
    refetchInterval: DETAIL_POLL_MS,
  })
}

export function useInvestigation(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.investigation(workspaceId ?? "", id),
    queryFn: () => incidentsService.investigation(workspaceId!, id),
    enabled: Boolean(workspaceId),
    refetchInterval: DETAIL_POLL_MS,
  })
}

export function useFixes(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.fixes(workspaceId ?? "", id),
    queryFn: () => incidentsService.fixes(workspaceId!, id),
    enabled: Boolean(workspaceId),
    refetchInterval: DETAIL_POLL_MS,
  })
}

export function useVerification(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.verification(workspaceId ?? "", id),
    queryFn: () => incidentsService.verification(workspaceId!, id),
    enabled: Boolean(workspaceId),
    refetchInterval: DETAIL_POLL_MS,
  })
}

export function useEvidenceContent(
  workspaceId: string | undefined,
  id: string,
  evidenceId: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.evidence(workspaceId ?? "", id, evidenceId),
    queryFn: () => incidentsService.evidence(workspaceId!, id, evidenceId),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: Infinity,
  })
}
