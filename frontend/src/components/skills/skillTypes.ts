export interface Deployment {
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
}

export interface SkillRow {
  id: string
  title: string
  description: string
  updatedAt: string
  /** When it was first created — drives the "created" filter. */
  createdAt: string | null
  deployed: boolean
  source: 'AGENT' | 'LIBRARY'
  /**
   * The owning agent's phone number and Meta agent id, shown as their own
   * columns. Both null for a LIBRARY skill, which has no single owning agent —
   * its agents are in deployments. metaAgentId is also null until that agent
   * has deployed at least once.
   */
  phoneNumberId: string | null
  metaAgentId: string | null
  deployments: Deployment[]
}
