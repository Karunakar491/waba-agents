import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bot,
  ArrowRight,
  MessageSquare,
  Phone,
  Circle,
} from 'lucide-react'
import api from '../lib/api'
import StatusIndicator, { type StatusTone } from '../components/shared/StatusIndicator'
import { useClientScope } from '../hooks/useClientScope'

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

// Figma node 140:33 "AttentionCard" -- every row uses the same warning-
// triangle icon and a short one-word status, not a per-reason icon/label;
// the fuller reason text still lives in each icon's title tooltip so the
// detail isn't lost, just not the headline anymore.
const REASON_CONFIG: Record<AttentionReason, { label: string; title: string }> = {
  draft: { label: 'Draft', title: 'Never deployed — still in draft' },
  paused: { label: 'Paused', title: 'Paused — not replying to customers' },
  disconnected: { label: 'No phone number', title: 'Active with no phone number connected' },
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

interface ClientRow {
  id: string
  name: string
  wabaId: string | null
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { clientId } = useClientScope()

  const { data: agents, isLoading, isError } = useQuery<AgentRow[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
  })

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data.data),
  })

  // Client Command Bar scope (roadmap item 45) — resolves the selected
  // client's wabaId, then filters to agents whose phone numbers sit on that
  // WABA. Filters client-side from data already fetched (no new query),
  // consistent with the fleet-risk endpoint's own staff-grant scoping.
  const { data: clients } = useQuery<ClientRow[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then((r) => r.data.data),
    enabled: !!clientId,
  })
  const scopedWabaId = clientId ? clients?.find((c) => c.id === clientId)?.wabaId ?? null : null
  const scopedAgentIds = clientId && summary
    ? new Set(summary.phoneNumbers.filter((p) => p.wabaId === scopedWabaId && p.agentId).map((p) => p.agentId as string))
    : null
  const scopedAgents = scopedAgentIds ? (agents ?? []).filter((a) => scopedAgentIds.has(a.id)) : agents
  const scopedPhones = scopedWabaId && summary ? summary.phoneNumbers.filter((p) => p.wabaId === scopedWabaId) : summary?.phoneNumbers

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {clientId
            ? `What needs your attention for ${clients?.find((c) => c.id === clientId)?.name ?? 'this client'}.`
            : 'What needs your attention across all agents.'}
        </p>
      </div>

      {/* Figma node 125:3 "7.1 -- Business Agents: Dashboard": metrics row
          first, then Needs Attention and the phone table side-by-side in
          two columns -- supersedes the 2026-08-05 chromeless-attention-list
          reorder now that a real two-column layout gives it its own visual
          weight without needing the "no card" treatment to stand out. */}
      {summaryLoading ? (
        <MetricsSkeleton />
      ) : summaryError || !summary ? (
        <MetricsErrorState />
      ) : (
        <MetricsRow summary={{ ...summary, phoneNumbers: scopedPhones ?? summary.phoneNumbers }} />
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-xl border bg-card p-4 shadow-surface-resting">
          {isLoading ? (
            <AttentionSkeleton />
          ) : isError ? (
            <ErrorState />
          ) : (
            <AttentionList agents={scopedAgents ?? []} onOpenAgent={(id) => navigate(`/agents/${id}`)} />
          )}
        </div>

        {summaryLoading ? (
          <SkeletonList />
        ) : summaryError || !summary ? null : (
          <PhoneNumbersTable
            phones={scopedPhones ?? summary.phoneNumbers}
            unavailableWabaLabels={summary.unavailableWabaLabels}
            syncedAt={summary.phoneNumbersSyncedAt}
            onOpenAgent={(id) => navigate(`/agents/${id}`)}
          />
        )}
      </div>
    </div>
  )
}

function MetricsRow({ summary }: { summary: DashboardSummary }) {
  // "Agents deployed" counted every number with an agent attached, including
  // paused ones — it read 6 while exactly 2 agents were answering customers.
  // The number an operator opens this page for is how many are live, so that
  // is the headline, with the rest as supporting text (founder-reported
  // 2026-09-03).
  const live = summary.phoneNumbers.filter((p) => p.agentStatus === 'active').length
  const withAgent = summary.phoneNumbers.filter((p) => p.hasAgent).length
  const cards = [
    { label: 'Total conversations', value: summary.totalConversations, icon: MessageSquare, note: null },
    { label: 'Active conversations', value: summary.activeConversations, icon: Circle, note: null },
    { label: 'Phone numbers', value: summary.phoneNumbers.length, icon: Phone, note: null },
    {
      label: 'Agents live',
      value: live,
      icon: Bot,
      note: withAgent > live ? `${withAgent - live} set up but not live` : null,
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, note }) => (
        <div key={label} className="rounded-xl border bg-card p-4 shadow-surface-resting">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            <p className="text-xs font-medium">{label}</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
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
        <div className="flex items-center gap-2 border-b bg-warning/10 px-4 py-2.5 text-xs text-warning">
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
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">WABA</th>
                <th className="px-4 py-3">Agent</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{phone.verifiedName || '—'}</td>
                    {/* The WABA's name, not its id. The id was the same value
                        on every row of a single-WABA account — a column of
                        identical 15-digit numbers — while the human-readable
                        label was hidden in a tooltip (founder-reported
                        2026-09-03). */}
                    <td className="px-4 py-3 text-muted-foreground" title={phone.wabaId}>
                      {phone.wabaLabel || phone.wabaId}
                    </td>
                    {/* Agent: the state first, then the name only when it adds
                        something. Most agents here are named after their own
                        phone number, so this cell used to repeat the first
                        column verbatim — "Phone number: +91 91520 04283 ·
                        Agent status: +91 91520 04283". The Agent ID column
                        that followed is gone; this cell already links through. */}
                    <td className="px-4 py-3">
                      {phone.hasAgent && statusCfg ? (
                        <button
                          onClick={() => phone.agentId && onOpenAgent(phone.agentId)}
                          className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          <StatusIndicator label={statusCfg.label} tone={statusCfg.tone} pulse={statusCfg.pulse} />
                          {phone.agentName && phone.agentName !== phone.displayPhoneNumber && (
                            <span className="max-w-[180px] truncate text-muted-foreground">{phone.agentName}</span>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ) : (
                        <StatusIndicator label="No agent deployed" tone="neutral" />
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

const ATTENTION_INLINE_CAP = 4

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

  // Figma node 145:2 "7.2 -- Needs Attention: All States" -- zero-items
  // keeps the "Needs attention" header (no count badge, no description
  // line) rather than dropping it entirely, so the card never reads as
  // unlabeled content.
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] font-semibold text-foreground">Needs attention</p>
        <div className="flex items-center gap-2 text-[13px] text-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent-teal-solid" />
          All agents are live and connected. Nothing needs attention.
        </div>
      </div>
    )
  }

  const visible = items.slice(0, ATTENTION_INLINE_CAP)
  const remaining = items.length - visible.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-foreground">Needs attention</p>
        <span className="flex h-5 min-w-[28px] items-center justify-center rounded-full bg-warning/10 px-1.5 text-[11px] font-semibold text-warning">
          {items.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Across all agents, including drafts not yet connected to a phone number.
      </p>
      <div className="divide-y">
        {visible.map(({ agent, reason }) => {
          const cfg = REASON_CONFIG[reason]
          return (
            <button
              key={agent.id}
              onClick={() => onOpenAgent(agent.id)}
              className="flex w-full items-center gap-2.5 py-2 text-left transition-colors hover:bg-muted/30"
            >
              <span title={cfg.title}>
                <AlertTriangle className="h-[15px] w-[15px] shrink-0 text-warning" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{agent.displayName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{cfg.label}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )
        })}
      </div>
      {remaining > 0 && (
        <Link to="/agents" className="block text-xs text-accent-teal-solid hover:underline">
          +{remaining} more — view all in Agents
        </Link>
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
