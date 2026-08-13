import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bot,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import api from '../lib/api'
import ErrorBanner from '../components/shared/ErrorBanner'
import CopyButton from '../components/shared/CopyButton'

/**
 * Screen: AgentsPage (Figma 8.1 "Agents: List" — node 191:2 / 191:44)
 *
 * 1. USER GOAL: See every agent at a glance and know which ones are actually
 *    answering customers right now — then turn one off, finish setting one up,
 *    or open one.
 * 2. EMOTIONAL STATE: Accountable. These agents talk to real customers; the
 *    operator needs to trust the row before they trust the agent.
 * 3. POSSIBLE ACTIONS: Primary — create an agent. Per row — enable/disable,
 *    continue setup (draft), open the agent, add a short About label.
 * 4. HOW WE HELP: The Enabled toggle states its real consequence in a tooltip
 *    before it is used; a half-built agent says "Continue setup" instead of
 *    offering a toggle that would fail; Health is a plain word, not a code.
 */

function isPlaceholderName(displayName: string): boolean {
  return displayName.startsWith('Imported agent (')
}

interface AgentRow {
  id: string
  displayName: string
  customerFacingName: string | null
  channel: 'whatsapp' | 'messenger' | 'instagram'
  phoneNumberId: string | null
  // Real dialable number, from PhoneNumberSnapshot (login-sync cache) — may
  // be null if this number was connected before that sync existed, or the
  // sync hasn't run yet; fall back to phoneNumberId (Meta's internal id)
  // rather than showing nothing, so the row never looks unconnected when it
  // isn't.
  displayPhoneNumber: string | null
  // Real business description from the deployed Business Persona for this
  // agent's phone number — replaces the old manually-typed aboutLabel as
  // this column's data source (founder, 2026-08-13: "about is fetched from
  // Business persona"). Null if no persona has ever been deployed.
  personaDescription: string | null
  wabaId: string | null
  status: 'draft' | 'active' | 'paused'
  systemPrompt: string | null
  // Figma 8.1 "About" column — short human label, distinct from systemPrompt.
  aboutLabel: string | null
  tone: string | null
  language: string | null
  behaviorRules: string | null
  handoffEnabled: boolean
  handoffMessage: string | null
  updatedAt: string
  sharedAccountCount: number | null
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Figma 199:16 header info icon → 193:116 tooltip copy, verbatim.
const ENABLED_TOOLTIP =
  'Disabling stops the agent on every existing conversation. Re-enabling only resumes new conversations — not the ones that went quiet.'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
]

type StatusFilter = 'all' | 'active' | 'paused' | 'draft'

const COLUMN_HEADERS = [
  'Agent',
  'About',
  'Phone / WABA',
  'Conversations',
  'Agent ID',
  'Enabled',
  'Last updated',
]

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

  // Figma node 191:58 "SearchRow" — a search box plus ONE "Filters" button
  // opening a single grouped panel (DESIGN.md §6), never loose dropdowns.
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = statusFilter === 'all' ? 0 : 1

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agents.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (q && !a.displayName.toLowerCase().includes(q)) return false
      return true
    })
  }, [agents, search, statusFilter])

  // Figma 200:27 / 200:59 "Enabled" toggle. Enabled maps to the agent actually
  // answering on Meta, so it drives the real deploy/pause endpoints — the same
  // ones the detail page uses. There is no separate "enabled" flag to fake.
  const enabledMutation = useMutation({
    mutationFn: ({ agent, next }: { agent: AgentRow; next: boolean }) =>
      api.post(`/agents/${agent.id}/${next ? 'deploy' : 'pause'}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  // "Add a label" for a Meta-imported agent (2026-08-13, replaces the old
  // automatic refresh-name retry, which often never resolved a real name).
  // PUT /agents/:id takes the full AgentRequest shape, so the whole agent
  // must round-trip here (a partial payload would null out other fields).
  const renameMutation = useMutation({
    mutationFn: ({ agent, displayName }: { agent: AgentRow; displayName: string }) =>
      api.put(`/agents/${agent.id}`, {
        displayName,
        customerFacingName: agent.customerFacingName,
        channel: agent.channel,
        systemPrompt: agent.systemPrompt,
        aboutLabel: agent.aboutLabel,
        tone: agent.tone,
        language: agent.language,
        behaviorRules: agent.behaviorRules,
        handoffEnabled: agent.handoffEnabled,
        handoffMessage: agent.handoffMessage,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  // Best-effort — a missing count must never block the agents list from rendering.
  const { data: conversationCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['conversation-counts'],
    queryFn: () => api.get('/conversations/counts').then((r) => r.data.data),
    retry: false,
  })

  function openAgent(agent: AgentRow) {
    navigate(pickFor ? `/agents/${agent.id}?tab=${pickFor}` : `/agents/${agent.id}`)
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb — Figma 191:45 "UtilLeft" */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span>Meta Agents</span>
        <span className="text-muted-foreground" aria-hidden>
          ›
        </span>
        <span>Agents</span>
      </nav>

      {/* Header — Figma 191:50 "HeaderRow" */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {pickForLabel ? `Choose an agent to view its ${pickForLabel}` : 'Agents'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pickForLabel
              ? `${pickForLabel} are set up per agent — pick one to continue.`
              : 'Manage your AI agents across WhatsApp and other channels.'}
          </p>
        </div>
        <button
          onClick={() => navigate('/agents/new')}
          className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-3 text-sm
            font-medium text-white shadow-surface-resting transition-opacity hover:opacity-90
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid
            focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </button>
      </div>

      {/* Search + Filters — Figma 191:58 */}
      {!isLoading && agents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="relative w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="w-full rounded-lg border bg-card py-2 pl-8 pr-3 text-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid
                  focus-visible:ring-offset-2"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm
                font-medium text-foreground transition-colors hover:bg-muted
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid
                focus-visible:ring-offset-2"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-accent-teal-solid px-2 text-xs font-medium text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {filtersOpen && (
            <div className="rounded-xl border bg-card p-4 shadow-surface-resting">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((option) => {
                  const selected = statusFilter === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2 ${
                          selected
                            ? 'border-accent-teal-solid bg-accent-teal/10 font-medium text-accent-teal-solid'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {enabledMutation.isError && <ErrorBanner error={enabledMutation.error} />}
      {renameMutation.isError && <ErrorBanner error={renameMutation.error} />}

      {/* Content */}
      {isLoading ? (
        <AgentTableSkeleton />
      ) : agents.length === 0 ? (
        <EmptyState onCreateClick={() => navigate('/agents/new')} />
      ) : filteredAgents.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/30 py-12 text-center text-sm text-muted-foreground">
          No agents match your search or filter.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-surface-resting">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {COLUMN_HEADERS.map((header) => (
                  <th
                    key={header}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {header === 'Enabled' ? (
                      <span className="flex items-center gap-1">
                        Enabled
                        <Info className="h-3 w-3" aria-hidden />
                        <span className="sr-only">{ENABLED_TOOLTIP}</span>
                      </span>
                    ) : (
                      header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAgents.map((agent) => (
                <AgentTableRow
                  key={agent.id}
                  agent={agent}
                  conversationCount={conversationCounts[agent.id]}
                  onOpen={() => openAgent(agent)}
                  onAddNameLabel={() => {
                    const value = window.prompt(
                      "Name this agent (shown everywhere in place of Meta's import placeholder):",
                      ''
                    )
                    if (value === null) return
                    const trimmed = value.trim()
                    if (!trimmed) return
                    renameMutation.mutate({ agent, displayName: trimmed.slice(0, 80) })
                  }}
                  renamingAgent={
                    renameMutation.isPending && renameMutation.variables?.agent.id === agent.id
                  }
                  onToggleEnabled={(next) => enabledMutation.mutate({ agent, next })}
                  togglingEnabled={
                    enabledMutation.isPending && enabledMutation.variables?.agent.id === agent.id
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * Figma 200:28 "Track" — 36×20 track, 16×16 knob. Teal when on, muted when off.
 * Not a shared primitive yet: this is its first and only call site, and
 * DESIGN.md's rule is no abstraction until three concrete cases exist.
 */
function EnabledToggle({
  enabled,
  disabled,
  label,
  onChange,
}: {
  enabled: boolean
  disabled: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      title={ENABLED_TOOLTIP}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!enabled)
      }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid
        focus-visible:ring-offset-2 disabled:opacity-50 ${
          enabled ? 'bg-accent-teal-solid' : 'bg-muted-foreground'
        }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all ${
          enabled ? 'left-4' : 'left-0.5'
        }`}
        aria-hidden
      />
    </button>
  )
}

function AgentTableRow({
  agent,
  conversationCount,
  onOpen,
  onAddNameLabel,
  renamingAgent,
  onToggleEnabled,
  togglingEnabled,
}: {
  agent: AgentRow
  conversationCount: number | undefined
  onOpen: () => void
  onAddNameLabel: () => void
  renamingAgent: boolean
  onToggleEnabled: (next: boolean) => void
  togglingEnabled: boolean
}) {
  // Figma 200:89: a not-yet-deployable agent gets "Continue setup", not a
  // toggle that the deploy endpoint would reject.
  const setupIncomplete = agent.status === 'draft' || !agent.phoneNumberId
  const isImported = isPlaceholderName(agent.displayName)

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer transition-colors hover:bg-muted/40"
    >
      {/* Agent — Figma 200:3. Founder-caught gap (2026-08-13): a Meta-imported
          agent's placeholder name ("Imported agent (...)") relied on an
          automatic Meta-name-resolution retry that often never resolves
          anything real. Replaced with a direct "Add a label" affordance that
          lets the operator just type the real name into our own DB — the
          same interaction pattern the old About column used. */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-teal">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex min-w-0 flex-col">
            {isImported ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddNameLabel()
                }}
                disabled={renamingAgent}
                className="flex items-center gap-1 text-sm font-medium text-accent-teal-solid hover:underline
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid
                  focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {renamingAgent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" aria-hidden />}
                Add a label
              </button>
            ) : (
              <p className="truncate font-medium text-foreground">{agent.displayName}</p>
            )}
            {(agent.sharedAccountCount ?? 0) > 1 && (
              <span
                title={`Shared WABA — visible and editable by ${agent.sharedAccountCount} accounts`}
                className="flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning w-fit"
              >
                <Users className="h-3 w-3" />
                Shared WABA
              </span>
            )}
          </div>
        </div>
      </td>

      {/* About — Figma 202:2. Founder-caught gap (2026-08-13): this used to be
          a manually-typed free-text field unrelated to the agent's actual
          configured persona. Now sourced from the real deployed Business
          Persona's description for this agent's number — a dash when no
          persona has ever been deployed, not an "Add a label" prompt (that
          would just recreate the old disconnected-manual-text problem). */}
      <td className="max-w-[200px] px-5 py-3">
        {agent.personaDescription ? (
          <p className="truncate text-muted-foreground" title={agent.personaDescription}>
            {agent.personaDescription}
          </p>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Phone / WABA — Figma 200:19 */}
      <td className="px-5 py-3">
        <p className="text-foreground">{agent.displayPhoneNumber ?? agent.phoneNumberId ?? '—'}</p>
        {agent.wabaId && <p className="font-mono text-xs text-muted-foreground">{agent.wabaId}</p>}
      </td>

      {/* Conversations */}
      <td className="px-5 py-3 tabular-nums text-foreground">{conversationCount ?? '—'}</td>

      {/* Agent ID — replaces the Health column (2026-08-13): "healthy/needs
          attention" duplicated the Enabled toggle + status badge with no new
          information, while the id operators actually need for the API
          Calls/Webhooks filters (agent id) was nowhere on this screen. */}
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-muted-foreground">{agent.id}</span>
          <CopyButton value={agent.id} label="Copy agent ID" />
        </div>
      </td>

      {/* Enabled — Figma 200:27 / 200:59 / 200:89 */}
      <td className="px-5 py-3">
        {setupIncomplete ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="text-xs font-medium text-accent-teal-solid hover:underline
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid
              focus-visible:ring-offset-2"
          >
            Continue setup
          </button>
        ) : (
          <EnabledToggle
            enabled={agent.status === 'active'}
            disabled={togglingEnabled}
            label={`${agent.status === 'active' ? 'Disable' : 'Enable'} ${agent.displayName}`}
            onChange={onToggleEnabled}
          />
        )}
      </td>

      {/* Last updated */}
      <td className="px-5 py-3 text-xs tabular-nums text-muted-foreground">
        {timeAgo(agent.updatedAt)}
      </td>
    </tr>
  )
}

// Figma node 194:68 "8.2 -- Agents: Empty State (zero agents)" -- EmptyStateCard
// (194:274): teal accent bar, real copy, and a "What you'll see" locked
// preview panel — not a generic dashed-border placeholder.
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border bg-card shadow-surface-resting">
      <div className="w-1 shrink-0 bg-accent-teal-solid" aria-hidden />
      <div className="flex flex-1 flex-col gap-10 p-8 md:flex-row md:items-center">
        <div className="flex flex-1 flex-col items-start gap-3">
          <h3 className="text-xl font-semibold text-foreground">No agents yet</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            An agent answers your customers on WhatsApp automatically — using your business
            knowledge, the skills you give it, and any tools you connect. Create one to see it
            here.
          </p>
          <button
            onClick={onCreateClick}
            className="mt-1 flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-3
              text-sm font-medium text-white shadow-surface-lifted transition-opacity hover:opacity-90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid
              focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Create your first agent
          </button>
        </div>

        {/* LockedPreview — a muted sample of what the populated table looks like */}
        <div className="w-full shrink-0 rounded-xl border bg-background p-4 md:w-80">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-3 w-3 text-muted-foreground" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What you’ll see
            </p>
          </div>
          <div className="flex w-full items-center gap-3 rounded-lg border bg-card p-3">
            <div className="h-7 w-7 shrink-0 rounded-lg bg-muted" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="h-2 w-28 rounded-sm bg-border" />
              <div className="h-2 w-20 rounded-sm bg-border" />
            </div>
            <div className="h-4 w-8 shrink-0 rounded-full bg-border" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Enable/disable, health, and conversation volume — all at a glance once you have
            agents running.
          </p>
        </div>
      </div>
    </div>
  )
}

function AgentTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-surface-resting">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {COLUMN_HEADERS.map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {[1, 2, 3].map((i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-muted" />
                  <div className="h-3 w-36 rounded bg-muted" />
                </div>
              </td>
              <td className="px-5 py-3">
                <div className="h-3 w-28 rounded bg-muted" />
              </td>
              <td className="px-5 py-3">
                <div className="space-y-1">
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="h-2 w-20 rounded bg-muted" />
                </div>
              </td>
              <td className="px-5 py-3">
                <div className="h-3 w-8 rounded bg-muted" />
              </td>
              <td className="px-5 py-3">
                <div className="h-3 w-20 rounded bg-muted" />
              </td>
              <td className="px-5 py-3">
                <div className="h-5 w-9 rounded-full bg-muted" />
              </td>
              <td className="px-5 py-3">
                <div className="h-3 w-12 rounded bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
