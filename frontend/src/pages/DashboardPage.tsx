import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bot,
  FileEdit,
  PhoneOff,
  ArrowRight,
  MessageSquare,
  Phone,
  Circle,
} from 'lucide-react'
import api from '../lib/api'
import StatusIndicator, { type StatusTone } from '../components/shared/StatusIndicator'

interface AgentRow {
  id: string
  displayName: string
  phoneNumberId: string | null
  status: 'draft' | 'active' | 'paused'
  updatedAt: string
}

interface AccountPhoneNumber {
  phoneNumberId: string
  displayPhoneNumber: string
  verifiedName: string
  wabaId: string
  wabaLabel: string
  hasAgent: boolean
  agentId: string | null
  agentName: string | null
  agentStatus: 'draft' | 'active' | 'paused' | null
  qualityRating: string | null
  nameStatus: string | null
  messagingLimitTier: string | null
}

interface DashboardSummary {
  totalConversations: number
  activeConversations: number
  phoneNumbers: AccountPhoneNumber[]
  unavailableWabaLabels: string[]
  phoneNumbersSyncedAt: string
}

// TASK-055: phone numbers now come from a login-sync cache, not a live call
// on every page load — this makes that staleness visible rather than silent.
function timeAgoShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type AttentionReason = 'draft' | 'paused' | 'disconnected'

interface AttentionItem {
  agent: AgentRow
  reason: AttentionReason
}

const REASON_CONFIG: Record<AttentionReason, { label: string; icon: typeof FileEdit }> = {
  draft: { label: 'Never deployed — still in draft', icon: FileEdit },
  paused: { label: 'Paused — not replying to customers', icon: AlertTriangle },
  disconnected: { label: 'Active with no phone number connected', icon: PhoneOff },
}

// Client-side heuristic — no dedicated "attention" signal exists on the backend yet.
// Priority order: disconnected-but-active (most urgent) > paused > draft.
function triage(agents: AgentRow[]): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const agent of agents) {
    if (agent.status === 'active' && !agent.phoneNumberId) {
      items.push({ agent, reason: 'disconnected' })
    } else if (agent.status === 'paused') {
      items.push({ agent, reason: 'paused' })
    } else if (agent.status === 'draft') {
      items.push({ agent, reason: 'draft' })
    }
  }
  const order: Record<AttentionReason, number> = { disconnected: 0, paused: 1, draft: 2 }
  return items.sort((a, b) => order[a.reason] - order[b.reason])
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data: agents, isLoading, isError } = useQuery<AgentRow[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
  })

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data.data),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What needs your attention across all agents.
        </p>
      </div>

      {/* Attention narrative renders first, deliberately with no card chrome —
          per DESIGN.md's Bento/hierarchy note, this is a headline the eye
          should land on before the reference tables below, not one more card
          that reads as "table, then another table" (2026-08-05 reorder). */}
      {isLoading ? (
        <AttentionSkeleton />
      ) : isError ? (
        <ErrorState />
      ) : (
        <AttentionList agents={agents ?? []} onOpenAgent={(id) => navigate(`/agents/${id}`)} />
      )}

      {summaryLoading ? (
        <MetricsSkeleton />
      ) : summaryError ? (
        <MetricsErrorState />
      ) : (
        <MetricsRow summary={summary!} />
      )}

      {summaryLoading ? (
        <SkeletonList />
      ) : summaryError ? null : (
        <PhoneNumbersTable
          phones={summary!.phoneNumbers}
          unavailableWabaLabels={summary!.unavailableWabaLabels}
          syncedAt={summary!.phoneNumbersSyncedAt}
          onOpenAgent={(id) => navigate(`/agents/${id}`)}
        />
      )}
    </div>
  )
}

function MetricsRow({ summary }: { summary: DashboardSummary }) {
  const numbersWithAgent = summary.phoneNumbers.filter((p) => p.hasAgent).length
  const cards = [
    { label: 'Total conversations', value: summary.totalConversations, icon: MessageSquare },
    { label: 'Active conversations', value: summary.activeConversations, icon: Circle },
    { label: 'Phone numbers', value: summary.phoneNumbers.length, icon: Phone },
    { label: 'Agents deployed', value: numbersWithAgent, icon: Bot },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-xl border bg-card p-4 shadow-surface-resting">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            <p className="text-xs font-medium">{label}</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        </div>
      ))}
    </div>
  )
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-surface-resting animate-pulse">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="mt-3 h-7 w-12 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function MetricsErrorState() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      Couldn't load conversation metrics. Try refreshing the page.
    </div>
  )
}

const PHONE_STATUS_CONFIG: Record<string, { label: string; tone: StatusTone; pulse?: boolean }> = {
  active: { label: 'Active', tone: 'positive', pulse: true },
  paused: { label: 'Paused', tone: 'warning' },
  draft: { label: 'Draft', tone: 'neutral' },
}

// TASK-061 — Meta's quality_rating is the leading indicator before WhatsApp
// restricts/bans a number. GREEN/YELLOW/RED assumed from common WhatsApp
// Cloud API usage, NOT confirmed against any doc in docs/meta-api/ (EL
// review, 2026-07-30 — flagged as unconfirmed, not sourced). Any other value
// (blank, UNKNOWN, or something we haven't seen) renders as a neutral badge
// rather than hiding the signal.
const QUALITY_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  GREEN: { label: 'Quality: High', tone: 'positive' },
  YELLOW: { label: 'Quality: Medium', tone: 'warning' },
  RED: { label: 'Quality: Low', tone: 'negative' },
}

function QualityBadge({ qualityRating }: { qualityRating: string | null }) {
  if (!qualityRating) return null
  const cfg = QUALITY_CONFIG[qualityRating] ?? { label: `Quality: ${qualityRating}`, tone: 'neutral' as const }
  return (
    <span title="Meta's quality rating for this number — a drop here can precede messaging restrictions" className="shrink-0">
      <StatusIndicator label={cfg.label} tone={cfg.tone} />
    </span>
  )
}

function PhoneNumbersTable({
  phones,
  unavailableWabaLabels,
  syncedAt,
  onOpenAgent,
}: {
  phones: AccountPhoneNumber[]
  unavailableWabaLabels: string[]
  syncedAt: string
  onOpenAgent: (id: string) => void
}) {
  if (phones.length === 0 && unavailableWabaLabels.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Phone numbers ({phones.length})
        </p>
        <p className="text-xs text-muted-foreground" title={syncedAt}>
          Synced {timeAgoShort(syncedAt)}
        </p>
      </div>
      {unavailableWabaLabels.length > 0 && (
        <div className="flex items-center gap-2 border-b bg-yellow-50 px-4 py-2.5 text-xs text-yellow-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Couldn't load {unavailableWabaLabels.join(', ')} — showing every other number.
          </span>
        </div>
      )}
      {phones.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No phone numbers found on the WABAs you have access to.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Phone number</th>
                <th className="px-4 py-3">WABA</th>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Agent status</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Agent id</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {phones.map((phone) => {
                const statusCfg = phone.agentStatus ? PHONE_STATUS_CONFIG[phone.agentStatus] : null
                return (
                  <tr key={phone.phoneNumberId} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Phone className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">
                          {phone.displayPhoneNumber || phone.phoneNumberId}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{phone.wabaLabel}</td>
                    <td className="px-4 py-3 text-muted-foreground">{phone.verifiedName || '—'}</td>
                    <td className="px-4 py-3">
                      {phone.hasAgent && statusCfg ? (
                        <button
                          onClick={() => phone.agentId && onOpenAgent(phone.agentId)}
                          className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          <StatusIndicator label={phone.agentName ?? statusCfg.label} tone={statusCfg.tone} pulse={statusCfg.pulse} />
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          <PhoneOff className="h-3 w-3" />
                          No agent deployed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <QualityBadge qualityRating={phone.qualityRating} />
                    </td>
                    <td className="px-4 py-3">
                      {phone.hasAgent && phone.agentId ? (
                        <span
                          title={phone.agentId}
                          className="block max-w-[140px] truncate font-mono text-xs text-muted-foreground"
                        >
                          {phone.agentId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const ATTENTION_INLINE_CAP = 3

function AttentionList({
  agents,
  onOpenAgent,
}: {
  agents: AgentRow[]
  onOpenAgent: (id: string) => void
}) {
  const items = triage(agents)

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No agents yet</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          Create your first agent to get started on WhatsApp.
        </p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-foreground">
        <StatusIndicator label="All agents are live and connected. Nothing needs attention." tone="positive" />
      </p>
    )
  }

  const visible = items.slice(0, ATTENTION_INLINE_CAP)
  const remaining = items.length - visible.length

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">
        {items.length} {items.length === 1 ? 'agent needs' : 'agents need'} attention
      </p>
      <div className="space-y-1">
        {visible.map(({ agent, reason }) => {
          const cfg = REASON_CONFIG[reason]
          const Icon = cfg.icon
          return (
            <button
              key={agent.id}
              onClick={() => onOpenAgent(agent.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/30"
            >
              <Icon className="h-4 w-4 shrink-0 text-yellow-600" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{agent.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{cfg.label}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )
        })}
      </div>
      {remaining > 0 && (
        <p className="pl-2 text-xs text-muted-foreground">+{remaining} more</p>
      )}
    </div>
  )
}

function AttentionSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-40 rounded bg-muted animate-pulse" />
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
          <div className="h-4 w-4 shrink-0 rounded bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-40 rounded bg-muted" />
            <div className="h-3 w-56 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground">Couldn't load agents</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Something went wrong fetching your agents. Try refreshing the page.
      </p>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      </div>
      <ul className="divide-y">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
