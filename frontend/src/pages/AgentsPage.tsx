import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bot, Plus, Play, ArrowRight, Loader2, RefreshCw, Users } from 'lucide-react'
import api from '../lib/api'
import StatusIndicator, { type StatusTone } from '../components/shared/StatusIndicator'

function isPlaceholderName(displayName: string): boolean {
  return displayName.startsWith('Imported agent (')
}

interface AgentRow {
  id: string
  displayName: string
  phoneNumberId: string | null
  wabaId: string | null
  status: 'draft' | 'active' | 'paused'
  systemPrompt: string | null
  updatedAt: string
  sharedAccountCount: number | null
}

// Health is a derived signal, not a Meta phone-quality rating (out of scope — see report).
type Health = 'healthy' | 'attention' | 'inactive'

function agentHealth(agent: AgentRow): Health {
  if (agent.status === 'active' && agent.phoneNumberId) return 'healthy'
  if (agent.status === 'paused') return 'attention'
  return 'inactive' // draft, or active with no phone connected
}

const HEALTH_CONFIG: Record<Health, { label: string; tone: StatusTone }> = {
  healthy: { label: 'Healthy', tone: 'positive' },
  attention: { label: 'Needs attention', tone: 'warning' },
  inactive: { label: 'Inactive', tone: 'neutral' },
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone; pulse?: boolean }> = {
  active: {
    label: 'Active',
    tone: 'positive',
    pulse: true,
  },
  paused: {
    label: 'Paused',
    tone: 'warning',
  },
  draft: {
    label: 'Draft',
    tone: 'neutral',
  },
}

const PICKER_LABELS: Record<string, string> = {
  knowledge: 'Knowledge Base',
  skills: 'Skills',
  connectors: 'Connectors',
}

export default function AgentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pickFor = searchParams.get('pickFor')
  const pickForLabel = pickFor ? PICKER_LABELS[pickFor] : null

  const queryClient = useQueryClient()

  const { data: agents = [], isLoading } = useQuery<AgentRow[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
  })

  const refreshNameMutation = useMutation({
    mutationFn: (agentId: string) => api.post(`/agents/${agentId}/refresh-name`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  // Best-effort — a missing count must never block the agents list from rendering.
  const { data: conversationCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['conversation-counts'],
    queryFn: () => api.get('/conversations/counts').then((r) => r.data.data),
    retry: false,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {pickForLabel ? `Choose an agent to view its ${pickForLabel}` : 'Agents'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pickForLabel
              ? `${pickForLabel} are set up per agent — pick one to continue.`
              : 'Manage your AI agents across WhatsApp and other channels.'}
          </p>
        </div>
        <button
          onClick={() => navigate('/agents/new')}
          className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
            text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <AgentTableSkeleton />
      ) : agents.length === 0 ? (
        <EmptyState onCreateClick={() => navigate('/agents/new')} />
      ) : (
        <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Agent Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Phone Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  WABA ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Conversations
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Health
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  conversationCount={conversationCounts[agent.id]}
                  onEdit={() =>
                    navigate(pickFor ? `/agents/${agent.id}?tab=${pickFor}` : `/agents/${agent.id}`)
                  }
                  onRefreshName={() => refreshNameMutation.mutate(agent.id)}
                  refreshingName={refreshNameMutation.isPending && refreshNameMutation.variables === agent.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AgentRow({
  agent,
  conversationCount,
  onEdit,
  onRefreshName,
  refreshingName,
}: {
  agent: AgentRow
  conversationCount: number | undefined
  onEdit: () => void
  onRefreshName: () => void
  refreshingName: boolean
}) {
  const cfg = STATUS_CONFIG[agent.status]
  const health = HEALTH_CONFIG[agentHealth(agent)]

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      {/* Agent Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-foreground truncate max-w-[180px]">
                {agent.displayName}
              </p>
              {isPlaceholderName(agent.displayName) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRefreshName() }}
                  disabled={refreshingName}
                  title="Retry resolving this agent's real name from Meta"
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {refreshingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </button>
              )}
              {(agent.sharedAccountCount ?? 0) > 1 && (
                <span
                  title={`Shared WABA — visible and editable by ${agent.sharedAccountCount} accounts`}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning"
                >
                  <Users className="h-2.5 w-2.5" />
                  Shared WABA
                </span>
              )}
            </div>
            {agent.systemPrompt && (
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                {agent.systemPrompt}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Phone Number */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {agent.phoneNumberId ?? '—'}
      </td>

      {/* WABA ID */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {agent.wabaId ?? '—'}
      </td>

      {/* Conversations */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {conversationCount ?? '—'}
      </td>

      {/* Health */}
      <td className="px-4 py-3">
        <span title="Derived from status + phone connection, not Meta quality rating">
          <StatusIndicator label={health.label} tone={health.tone} />
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusIndicator label={cfg.label} tone={cfg.tone} pulse={cfg.pulse} />
      </td>

      {/* Last Updated */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {timeAgo(agent.updatedAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={agent.status !== 'active'}
            title={agent.status !== 'active' ? 'Deploy first' : 'Test agent'}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium
              text-foreground transition-colors hover:bg-muted
              disabled:pointer-events-none disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" />
            Test
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium
              text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Edit
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center">
      <h3 className="text-base font-semibold text-foreground">No agents yet</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Create your first agent to get started on WhatsApp.
      </p>
      <button
        onClick={onCreateClick}
        className="mt-6 flex items-center gap-2 rounded-lg bg-accent-teal-solid px-5 py-2.5
          text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Create Agent
      </button>
    </div>
  )
}

function AgentTableSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            {['Agent Name', 'Phone Number', 'WABA ID', 'Conversations', 'Health', 'Status', 'Last Updated', 'Actions'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {[1, 2, 3].map((i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-36 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-28 rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-24 rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-10 rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-20 rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-16 rounded-full bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-16 rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <div className="h-7 w-14 rounded-lg bg-muted" />
                  <div className="h-7 w-14 rounded-lg bg-muted" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
