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
  deployed: boolean
  source: 'AGENT' | 'LIBRARY'
  deployments: Deployment[]
}
