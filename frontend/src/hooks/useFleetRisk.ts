import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export interface FleetRiskRow {
  clientId: string
  name: string
  riskScore: number
  staleConversationAgeMins: number
  webhookFailureRatePct: number
  handoffBacklogCount: number
  agentErrorRatePct: number
  approximate: boolean
}

/** Client Command Bar (roadmap item 45) — staff-grant scoped, same access model as every other client read. */
export function useFleetRisk() {
  return useQuery<FleetRiskRow[]>({
    queryKey: ['fleet-risk'],
    queryFn: () => api.get('/clients/fleet-risk').then((r) => r.data.data),
    // Risk signals shift with live traffic — refresh on an interval rather
    // than requiring a manual reload to notice a newly at-risk client.
    refetchInterval: 60_000,
  })
}
