import { useState, useRef, useEffect, useId, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot,
  ArrowLeft,
  Loader2,
  Pause,
  Trash2,
  Save,
  Phone,
  AlertTriangle,
  BookOpen,
  Zap,
  Plug,
  Settings2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Rocket,
  Play,
  Send,
  Users,
  FileText,
  ClipboardList,
  RefreshCw,
  Pencil,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useDraftPublish } from '../hooks/useDraftPublish'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import ConnectPhoneModal from '../components/waba/ConnectPhoneModal'
import RunToolModal from '../components/agent-detail/RunToolModal'
import ConsequenceLine from '../components/shared/ConsequenceLine'
import ErrorBanner from '../components/shared/ErrorBanner'
import StatusIndicator, { type StatusTone } from '../components/shared/StatusIndicator'
import DeleteAgentModal from '../components/agent-detail/DeleteAgentModal'
import DeleteFromMetaModal from '../components/agent-detail/DeleteFromMetaModal'

// Lazy-loaded — each is a real, separate chunk not bundled into this page's
// initial load; only one tab is ever mounted at a time (see the activeTab
// conditional below), so a single Suspense boundary around that region
// suffices. KnowledgeTab/ConnectorsTab/SettingsTab stay inline (defined
// further down in this file) — they're not yet extracted to their own
// modules, so they can't be lazy-imported without that extraction first.
const BusinessProfileTab = lazy(() => import('../components/agent-detail/BusinessProfileTab'))
const SkillsTab = lazy(() => import('../components/agent-detail/SkillsTab'))
const EvalTab = lazy(() => import('../components/agent-detail/EvalTab'))
import TriggerEventModal from '../components/agent-detail/TriggerEventModal'
import Modal from '../components/shared/Modal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentApi {
  id: string
  displayName: string
  status: 'draft' | 'active' | 'paused'
  phoneNumberId: string | null
  systemPrompt: string | null
  // Figma 8.1 "About" column — short human label, distinct from systemPrompt.
  aboutLabel: string | null
  tone: string | null
  language: string | null
  behaviorRules: string | null
  handoffEnabled: boolean
  handoffMessage: string | null
  handoffPublishedAt: string | null
  // Real dialable number (PhoneNumberSnapshot cache) — may be null if this
  // number predates that sync or hasn't synced yet; fall back to
  // phoneNumberId (Meta's internal id) rather than showing nothing.
  displayPhoneNumber: string | null
  updatedAt: string
  deployedAt: string | null
  sharedAccountCount: number | null
}

interface Faq {
  id: string
  question: string
  answer: string
  metaSynced: boolean
}

type DetailTab = 'knowledge' | 'skills' | 'connectors' | 'profile' | 'eval' | 'settings'

const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone; pulse?: boolean }> = {
  active: { label: 'Active', tone: 'positive', pulse: true },
  paused: { label: 'Paused', tone: 'warning' },
  draft:  { label: 'Draft',  tone: 'neutral' },
}

const TONES = ['Friendly', 'Professional', 'Casual', 'Formal']

const settingsSchema = z.object({
  displayName: z.string().min(2, 'At least 2 characters').max(80, 'Max 80 characters'),
  systemPrompt: z.string().min(20, 'At least 20 characters').max(4000, 'Max 4000 characters'),
  aboutLabel: z.string().max(255, 'Max 255 characters').optional(),
  tone: z.string().optional(),
  language: z.string().optional(),
  behaviorRules: z.string().optional(),
  handoffEnabled: z.boolean(),
  handoffMessage: z.string().max(1000, 'Max 1000 characters').optional(),
})
type SettingsValues = z.infer<typeof settingsSchema>

interface DeployPreflightResponse {
  agentIdPresent: boolean
  skillCount: number
  connectorNames: string[]
}

function describePreflightWarning(p: DeployPreflightResponse): string {
  const parts: string[] = []
  if (p.skillCount > 0) parts.push(`${p.skillCount} skill${p.skillCount === 1 ? '' : 's'} configured`)
  if (p.connectorNames.length > 0) parts.push(`connected to: ${p.connectorNames.join(', ')}`)
  if (parts.length === 0) parts.push('an active Meta agent configured')
  return `This number already has ${parts.join('; ')}. Connecting here may affect what's already live. Continue?`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const isDetailTab = (v: string | null): v is DetailTab =>
    v === 'knowledge' || v === 'skills' || v === 'connectors' || v === 'profile' || v === 'eval' || v === 'settings'
  const [activeTab, setActiveTab] = useState<DetailTab>(isDetailTab(requestedTab) ? requestedTab : 'knowledge')

  // Sidebar nav (Knowledge Base/Skills/Connectors) deep-links back into the last
  // agent viewed for that tab — a per-tab key, not one global "last agent", so
  // switching between two clients' Skills/Connectors mid-session never bleeds
  // into each other. Session-scoped (not localStorage): resets on next login so
  // an operator never lands in yesterday's client's data by muscle memory.
  useEffect(() => {
    if (id) sessionStorage.setItem(`last-agent:${activeTab}`, id)
  }, [id, activeTab])
  const [testOpen, setTestOpen] = useState(false)
  const [threadControlOpen, setThreadControlOpen] = useState(false)
  const [preflightChecking, setPreflightChecking] = useState(false)
  const [preflightWarning, setPreflightWarning] = useState<DeployPreflightResponse | null>(null)
  const [preflightError, setPreflightError] = useState<string | null>(null)

  const { data: agent, isLoading, isError } = useQuery<AgentApi>({
    queryKey: ['agent', id],
    queryFn: () => api.get(`/agents/${id}`).then((r) => r.data.data as AgentApi),
    enabled: !!id,
  })

  const queryClient = useQueryClient()

  const deployMutation = useMutation({
    mutationFn: () => api.post(`/agents/${id}/deploy`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/agents/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })

  const refreshNameMutation = useMutation({
    mutationFn: () => api.post(`/agents/${id}/refresh-name`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })

  // TASK-067 (founder-reported gap): every tab below (Knowledge/Skills/
  // Connectors/Profile/Eval) only fires its Meta GET call when a human
  // actually clicks that tab — meaning an agent viewed without clicking
  // "Eval", say, never even generates an api_call_log row for it. Prefetch
  // every domain's exact query the moment the agent is known, using the
  // SAME queryKey/queryFn each tab already owns, so the real Meta call
  // fires on page view regardless of which tab is active, and the tab
  // itself renders instantly from cache (default staleTime: 30s, set
  // globally in App.tsx, already prevents duplicate calls on rapid
  // re-navigation — no extra staleTime override needed here).
  useEffect(() => {
    if (!agent?.id || !agent.phoneNumberId) return
    const agentId = agent.id
    const phoneNumberId = agent.phoneNumberId
    queryClient.prefetchQuery({ queryKey: ['faqs', agentId], queryFn: () => api.get(`/agents/${agentId}/faq`).then((r) => r.data.data) })
    queryClient.prefetchQuery({ queryKey: ['websites', agentId], queryFn: () => api.get(`/agents/${agentId}/websites`).then((r) => r.data.data) })
    queryClient.prefetchQuery({ queryKey: ['files', agentId], queryFn: () => api.get(`/agents/${agentId}/files`).then((r) => r.data.data) })
    queryClient.prefetchQuery({ queryKey: ['skills-view', agentId], queryFn: () => api.get(`/agents/${agentId}/skills-view`).then((r) => r.data.data ?? []) })
    queryClient.prefetchQuery({
      queryKey: ['connectors', agentId],
      queryFn: () => api.get(`/agents/${agentId}/connectors`).then((r) => {
        const d = r.data.data
        return Array.isArray(d) ? d : (d?.data ?? [])
      }),
    })
    queryClient.prefetchQuery({ queryKey: ['business-profile-live', phoneNumberId], queryFn: () => api.get('/business-profiles/live', { params: { phoneNumberId } }).then((r) => r.data.data) })
    queryClient.prefetchQuery({ queryKey: ['business-profile-history', phoneNumberId], queryFn: () => api.get('/business-profiles/history', { params: { phoneNumberId } }).then((r) => r.data.data ?? []) })
    queryClient.prefetchQuery({ queryKey: ['eval-cases', agentId], queryFn: () => api.get(`/reports/agents/${agentId}/eval/cases`).then((r) => r.data.data?.eval_cases ?? []) })
  }, [agent?.id, agent?.phoneNumberId, queryClient])

  if (isLoading) return <AgentDetailSkeleton />
  if (isError || !agent) return <AgentNotFound onBack={() => navigate('/agents')} />

  const cfg = STATUS_CONFIG[agent.status]
  const canDeploy = !!agent.phoneNumberId
  const actionError = preflightError
    ? preflightError
    : deployMutation.error || pauseMutation.error
      ? extractErrorMessage(deployMutation.error ?? pauseMutation.error)
      : null

  // UX nicety on top of the backend's own fail-closed guard (AgentDeployService).
  // Fails closed here too — a preflight call that errors blocks deploy rather
  // than silently proceeding as if the number were clean.
  const handleDeployClick = async () => {
    if (!agent.phoneNumberId) return
    setPreflightError(null)
    setPreflightChecking(true)
    try {
      const res = await api.get(`/waba/phones/${agent.phoneNumberId}/deploy-preflight`)
      const data = res.data.data as DeployPreflightResponse
      const hasExisting = data.agentIdPresent || data.skillCount > 0 || data.connectorNames.length > 0
      if (hasExisting) {
        setPreflightWarning(data)
      } else {
        deployMutation.mutate()
      }
    } catch (err) {
      setPreflightError(extractErrorMessage(err))
    } finally {
      setPreflightChecking(false)
    }
  }

  const LEFT_TABS: { key: DetailTab; icon: React.FC<{ className?: string }>; label: string }[] = [
    { key: 'knowledge',  icon: BookOpen,      label: 'Knowledge Base'  },
    { key: 'skills',     icon: Zap,           label: 'Skills'          },
    { key: 'connectors', icon: Plug,          label: 'Connectors'      },
    { key: 'profile',    icon: FileText,      label: 'Business Profile'},
    { key: 'eval',       icon: ClipboardList, label: 'Eval'            },
    { key: 'settings',   icon: Settings2,     label: 'Settings'        },
  ]

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate('/agents')}
            className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{agent.displayName}</h1>
                  {agent.displayName.startsWith('Imported agent (') && (
                    <button
                      onClick={() => refreshNameMutation.mutate()}
                      disabled={refreshNameMutation.isPending}
                      title="Retry resolving this agent's real name from Meta"
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      {refreshNameMutation.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <StatusIndicator label={cfg.label} tone={cfg.tone} pulse={cfg.pulse} />
                  {(agent.sharedAccountCount ?? 0) > 1 && (
                    <span title={`Shared WABA — visible and editable by ${agent.sharedAccountCount} accounts`}>
                      <StatusIndicator label="Shared WABA" tone="warning" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {agent.displayPhoneNumber ?? agent.phoneNumberId ?? 'No number connected'}
                </p>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex flex-wrap items-center gap-2">
              {agent.status === 'active' && agent.handoffEnabled && (
                <button
                  onClick={() => setThreadControlOpen(true)}
                  title="Hand this number's conversations back to the AI agent"
                  className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold
                    text-foreground transition-colors hover:bg-muted"
                >
                  <Users className="h-4 w-4" />
                  Thread Control
                </button>
              )}
              {agent.status === 'active' && (
                <>
                  <button
                    onClick={() => pauseMutation.mutate()}
                    disabled={pauseMutation.isPending}
                    className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold
                      text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pauseMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    Pause
                  </button>
                  <button
                    onClick={() => setTestOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-semibold
                      text-white transition-opacity hover:opacity-90"
                  >
                    <Zap className="h-4 w-4" />
                    Test Agent
                  </button>
                </>
              )}
              {(agent.status === 'draft' || agent.status === 'paused') && (
                <button
                  onClick={handleDeployClick}
                  disabled={deployMutation.isPending || preflightChecking || !!preflightWarning || !canDeploy}
                  title={!canDeploy ? 'Connect a phone number first' : undefined}
                  className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-semibold
                    text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deployMutation.isPending || preflightChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  {preflightChecking ? 'Checking number…' : 'Publish & Test'}
                </button>
              )}
            </div>
          </div>

          {(agent.status === 'draft' || agent.status === 'paused') && !preflightWarning && (
            <div className="mt-3">
              <ConsequenceLine>
                Publish & Test goes live immediately — the agent starts responding to real customers on this number.
              </ConsequenceLine>
            </div>
          )}

          {actionError && (
            <div className="mt-3">
              <ErrorBanner error={actionError} />
            </div>
          )}

          {preflightWarning && (
            <div className="mt-3 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning space-y-2">
              <p>{describePreflightWarning(preflightWarning)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreflightWarning(null)}
                  className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setPreflightWarning(null); deployMutation.mutate() }}
                  className="rounded-md bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Two-column layout: left tabs + right content */}
        <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
          {/* Left tab rail */}
          <nav className="space-y-0.5">
            {LEFT_TABS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                  activeTab === key
                    ? 'bg-primary/10 text-primary border-l-2 border-primary rounded-l-none'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Right content area */}
          <div className="min-w-0">
            {activeTab === 'knowledge' && <KnowledgeTab agentId={agent.id} />}
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
              {activeTab === 'skills' && <SkillsTab agentId={agent.id} />}
              {activeTab === 'profile' && <BusinessProfileTab phoneNumberId={agent.phoneNumberId} />}
              {activeTab === 'eval' && <EvalTab agentId={agent.id} />}
            </Suspense>
            {activeTab === 'connectors' && <ConnectorsTab agent={agent} />}
            {activeTab === 'settings' && (
              <SettingsTab agent={agent} onDeleted={() => navigate('/agents')} />
            )}
          </div>
        </div>
      </div>

      {/* Test drawer */}
      {testOpen && (
        <TestDrawer
          agentId={agent.id}
          agentStatus={agent.status}
          onClose={() => setTestOpen(false)}
        />
      )}

      {/* Thread control release confirmation */}
      {threadControlOpen && (
        <ThreadControlModal
          agentId={agent.id}
          phoneNumberId={agent.phoneNumberId}
          onClose={() => setThreadControlOpen(false)}
        />
      )}
    </>
  )
}

// ── Thread Control release modal ─────────────────────────────────────────────

function ThreadControlModal({
  agentId,
  phoneNumberId,
  onClose,
}: {
  agentId: string
  phoneNumberId: string | null
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const releaseMutation = useMutation({
    mutationFn: () => api.post(`/agents/${agentId}/thread-control/release`),
    onSuccess: onClose,
    onError: (err) => setError(extractErrorMessage(err)),
  })

  return (
    <Modal
      title="Release thread control?"
      onClose={onClose}
      preventClose={releaseMutation.isPending}
      maxWidthClassName="max-w-md"
    >
        <p className="text-sm text-muted-foreground">
          This hands active conversations on <strong className="font-semibold text-foreground">
          {phoneNumberId ?? 'this number'}</strong> back to the Meta AI agent. The agent resumes
          responding to new messages on this number.
        </p>

        {error && (
          <div className="mt-3">
            <ErrorBanner error={error} />
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => { setError(null); releaseMutation.mutate() }}
            disabled={releaseMutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
              text-sm font-semibold text-white transition-opacity hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {releaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Release to agent
          </button>
          <button
            onClick={onClose}
            disabled={releaseMutation.isPending}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
              text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
    </Modal>
  )
}

// ── Knowledge Base tab ────────────────────────────────────────────────────────

function KnowledgeTab({ agentId }: { agentId: string }) {
  const [faqsOpen, setFaqsOpen] = useState(true)
  const [websitesOpen, setWebsitesOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)

  return (
    <div className="space-y-3">
      <FaqsSection agentId={agentId} open={faqsOpen} onToggle={() => setFaqsOpen((v) => !v)} />
      <WebsitesSection agentId={agentId} open={websitesOpen} onToggle={() => setWebsitesOpen((v) => !v)} />
      <FilesSection agentId={agentId} open={filesOpen} onToggle={() => setFilesOpen((v) => !v)} />
    </div>
  )
}

// ── FAQs section ──────────────────────────────────────────────────────────────

function FaqsSection({ agentId, open, onToggle }: { agentId: string; open: boolean; onToggle: () => void }) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ['faqs', agentId],
    queryFn: () => api.get(`/agents/${agentId}/faq`).then((r) => r.data.data),
  })

  const addMutation = useMutation({
    mutationFn: (payload: { question: string; answer: string }) =>
      api.post(`/agents/${agentId}/faq`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs', agentId] })
      setQuestion('')
      setAnswer('')
      setShowAddForm(false)
      setAddError(null)
    },
    onError: (err) => setAddError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (faqId: string) => api.delete(`/agents/${agentId}/faq/${faqId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faqs', agentId] }),
  })

  function handleAdd() {
    if (!question.trim() || !answer.trim()) return
    addMutation.mutate({ question: question.trim(), answer: answer.trim() })
  }

  return (
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
      {/* Section header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">FAQs</span>
          {!isLoading && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {faqs.length}
            </span>
          )}
        </div>
        {open && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAddForm((v) => !v) }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium
              text-primary border border-primary/30 hover:bg-primary/5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add FAQ
          </button>
        )}
      </button>

      {open && (
        <div className="border-t">
          {/* Add form */}
          {showAddForm && (
            <div className="border-b bg-muted/20 px-4 py-4 space-y-3">
              {addError && <ErrorBanner error={addError} />}
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Question"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              />
              <textarea
                rows={3}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer"
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!question.trim() || !answer.trim() || addMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold
                    text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setAddError(null) }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground
                    hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* FAQ list */}
          {isLoading ? (
            <div className="px-4 py-4 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : faqs.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No FAQs yet. Add questions customers often ask.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {faqs.map((faq) => (
                <li key={faq.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{faq.question}</p>
                      {!faq.metaSynced && (
                        <NotSyncedBadge label="FAQ" title="This FAQ hasn't synced to Meta — retry by editing and saving again" />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(faq.id)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete FAQ: ${faq.question}`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Websites section ──────────────────────────────────────────────────────────

interface Website {
  id: string
  url: string
  crawlStatus: string | null
  pagesCrawled: number | null
  metaSynced: boolean
}

function NotSyncedBadge({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title ?? `This ${label} hasn't synced to Meta, or was changed/removed directly on Meta outside this app`}
      className="shrink-0"
    >
      <StatusIndicator label="Not synced" tone="warning" />
    </span>
  )
}

function WebsitesSection({ agentId, open, onToggle }: { agentId: string; open: boolean; onToggle: () => void }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const { data: websites = [], isLoading } = useQuery<Website[]>({
    queryKey: ['websites', agentId],
    queryFn: () => api.get(`/agents/${agentId}/websites`).then((r) => r.data.data),
  })

  const addMutation = useMutation({
    mutationFn: (payload: { url: string }) => api.post(`/agents/${agentId}/websites`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites', agentId] })
      setUrl('')
      setAddError(null)
    },
    onError: (err) => setAddError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (websiteId: string) => api.delete(`/agents/${agentId}/websites/${websiteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['websites', agentId] }),
  })

  return (
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">Websites</span>
          {!isLoading && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {websites.length}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t">
          <div className="px-4 py-4 space-y-3 border-b bg-muted/20">
            {addError && <ErrorBanner error={addError} />}
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              />
              <button
                onClick={() => { setAddError(null); addMutation.mutate({ url: url.trim() }) }}
                disabled={!url.trim() || addMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-4 py-2 text-xs font-semibold
                  text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="px-4 py-4 space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : websites.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No websites added. Add your website URL to let the agent learn from your content.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {websites.map((site) => (
                <li key={site.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{site.url}</p>
                      {!site.metaSynced && <NotSyncedBadge label="website" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {site.crawlStatus ?? 'pending'}
                      {site.pagesCrawled != null ? ` — ${site.pagesCrawled} pages crawled` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(site.id)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete website: ${site.url}`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Files section ─────────────────────────────────────────────────────────────

interface AgentKbFile {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  metaSynced: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FilesSection({ agentId, open, onToggle }: { agentId: string; open: boolean; onToggle: () => void }) {
  const queryClient = useQueryClient()
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: files = [], isLoading } = useQuery<AgentKbFile[]>({
    queryKey: ['files', agentId],
    queryFn: () => api.get(`/agents/${agentId}/files`).then((r) => r.data.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      // The shared `api` instance defaults Content-Type to application/json
      // (lib/api.ts) — that default would override FormData's automatic
      // multipart boundary detection unless explicitly unset here. A
      // hardcoded 'multipart/form-data' string (the first version of this
      // fix) has the same problem: it strips the boundary= param axios
      // would otherwise attach, and every upload 400s server-side (EL
      // REJECT, caught cold, 2026-07-30). undefined is the correct override.
      return api.post(`/agents/${agentId}/files`, formData, {
        headers: { 'Content-Type': undefined },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', agentId] })
      setUploadError(null)
    },
    onError: (err) => setUploadError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => api.delete(`/agents/${agentId}/files/${fileId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files', agentId] }),
  })

  return (
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">Files</span>
          {!isLoading && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {files.length}
            </span>
          )}
        </div>
        {open && (
          <label
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary border border-primary/30
              cursor-pointer hover:bg-primary/5 transition-colors"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="inline h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Plus className="inline h-3.5 w-3.5 mr-1" />
            )}
            Upload
            <input
              type="file"
              accept=".pdf,.docx"
              className="sr-only"
              disabled={uploadMutation.isPending}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) { setUploadError(null); uploadMutation.mutate(file) }
                e.target.value = ''
              }}
            />
          </label>
        )}
      </button>

      {open && (
        <div className="border-t">
          {uploadError && (
            <div className="px-4 py-2 border-b bg-destructive/5">
              <ErrorBanner error={uploadError} />
            </div>
          )}
          {isLoading ? (
            <div className="px-4 py-4 space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : files.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No files uploaded.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{file.filename}</p>
                      {!file.metaSynced && <NotSyncedBadge label="file" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(file.id)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete file: ${file.filename}`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Connectors tab ────────────────────────────────────────────────────────────

interface Connector {
  id: string
  name: string
  description: string
  base_url: string
  auth_type: string
  connection_status: { status: string }
}

interface ConnectorTool {
  id: string
  name: string
  description: string
  request_definition: { method: string; path: string }
}

type AuthType = 'NONE' | 'API_KEY' | 'OAUTH2_CLIENT_CREDENTIALS'

// EL-caught gap (2026-08-07 audit, FIX-009): raw Tailwind palette colors
// bypassing the token layer, with no dark-mode variants (illegible on dark
// surfaces). No existing DESIGN.md token maps 1:1 to 5 distinct HTTP
// methods, so this maps to the closest existing semantic tokens instead of
// inventing new ones tonight — GET/PATCH share a neutral "read" treatment,
// POST maps to success (brand-green), PUT to warning, DELETE unchanged.
const METHOD_BADGE: Record<string, string> = {
  GET:    'bg-muted text-muted-foreground',
  POST:   'bg-brand-green/10 text-brand-green',
  PUT:    'bg-warning/10 text-warning',
  DELETE: 'bg-destructive/10 text-destructive',
  PATCH:  'bg-muted text-muted-foreground',
}

function connectorStatusTone(status: string): StatusTone {
  if (status === 'ACTIVE')         return 'positive'
  if (status === 'PENDING_OAUTH')  return 'warning'
  if (status === 'ERROR')          return 'negative'
  return 'neutral'
}

function connectorPlugColor(status: string): string {
  if (status === 'ACTIVE')        return 'text-brand-green'
  if (status === 'PENDING_OAUTH') return 'text-yellow-500'
  if (status === 'ERROR')         return 'text-destructive'
  return 'text-muted-foreground'
}

// ── Add/Edit Connector Modal ──────────────────────────────────────────────────
// Founder-caught gap (2026-08-07): a connector had no edit path at all once
// created — only delete-and-recreate. PUT /agents/{id}/connectors/{connectorId}
// already existed backend-side; this modal now does double duty for
// create and edit. Secret fields (API key value, client secret) are left
// blank on edit and only sent if the user actually types a replacement —
// Meta doesn't return secrets on GET, so a blank field means "keep existing",
// never "clear it".

interface AddConnectorModalProps {
  agentId: string
  onClose: () => void
  onCreated: () => void
  editingConnector?: Connector | null
}

function AddConnectorModal({ agentId, onClose, onCreated, editingConnector }: AddConnectorModalProps) {
  const isEditing = !!editingConnector
  const [name, setName]           = useState(editingConnector?.name ?? '')
  const [description, setDesc]    = useState(editingConnector?.description ?? '')
  const [baseUrl, setBaseUrl]     = useState(editingConnector?.base_url ?? '')
  const [authType, setAuthType]   = useState<AuthType>((editingConnector?.auth_type as AuthType) ?? 'NONE')
  const [headerName, setHdrName]  = useState('')
  const [apiKeyValue, setApiKey]  = useState('')
  const [tokenUrl, setTokenUrl]   = useState('')
  const [clientId, setClientId]   = useState('')
  const [clientSecret, setSecret] = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !description.trim() || !baseUrl.trim()) return
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        base_url: baseUrl.trim(),
        auth_type: authType,
      }
      if (authType === 'API_KEY' && (!isEditing || (headerName.trim() && apiKeyValue))) {
        // Meta requires auth_config nested one level deeper under the
        // type-named key — confirmed live via a real Meta 400 ("auth_config.api_key
        // is required for API_KEY auth type") that the previous flat shape produced.
        payload.auth_config = {
          api_key: { headers: [{ field_name: headerName.trim(), value: apiKeyValue }] },
        }
      }
      if (authType === 'OAUTH2_CLIENT_CREDENTIALS' && (!isEditing || (tokenUrl.trim() && clientId.trim() && clientSecret))) {
        // Same type-named-wrapper pattern as API_KEY above, applied by symmetry —
        // NOT independently confirmed live (no OAuth connector tested this session).
        // See TASKS.md follow-up: verify against a real OAuth2 connector before
        // treating this path as closed.
        payload.auth_config = {
          oauth2_client_credentials: {
            token_url: tokenUrl.trim(),
            client_id: clientId.trim(),
            client_secret: clientSecret,
            scopes_to_request: [],
          },
        }
      }
      if (isEditing) {
        await api.put(`/agents/${agentId}/connectors/${editingConnector.id}`, payload)
      } else {
        await api.post(`/agents/${agentId}/connectors`, payload)
      }
      onCreated()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

  return (
    <Modal
      title={isEditing ? `Edit connector "${editingConnector.name}"` : 'Add Connector'}
      onClose={onClose}
      preventClose={saving}
      maxWidthClassName="max-w-md"
    >
        {error && (
          <div className="mb-3">
            <ErrorBanner error={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order Management API"
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Description</label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="The agent reads this to understand what the connector does"
              className={cn(inputCls, 'resize-none')}
            />
            <p className="text-xs text-muted-foreground">
              The agent reads this to understand what the connector does.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Base URL</label>
            <input
              type="text"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Auth Type</label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
              className={inputCls}
            >
              <option value="NONE">None</option>
              <option value="API_KEY">API Key</option>
              <option value="OAUTH2_CLIENT_CREDENTIALS">OAuth 2.0 — Client Credentials</option>
            </select>
          </div>

          {authType === 'API_KEY' && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Header name</label>
                <input
                  type="text"
                  required={!isEditing}
                  value={headerName}
                  onChange={(e) => setHdrName(e.target.value)}
                  placeholder="X-API-Key"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">API key value</label>
                <input
                  type="password"
                  required={!isEditing}
                  value={apiKeyValue}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={isEditing ? 'Leave blank to keep existing key' : 'sk-…'}
                  className={inputCls}
                />
              </div>
            </>
          )}

          {authType === 'OAUTH2_CLIENT_CREDENTIALS' && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Token URL</label>
                <input
                  type="text"
                  required={!isEditing}
                  value={tokenUrl}
                  onChange={(e) => setTokenUrl(e.target.value)}
                  placeholder={isEditing ? 'Leave blank to keep existing' : 'https://auth.example.com/token'}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Client ID</label>
                <input
                  type="text"
                  required={!isEditing}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={isEditing ? 'Leave blank to keep existing' : undefined}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Client Secret</label>
                <input
                  type="password"
                  required={!isEditing}
                  value={clientSecret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={isEditing ? 'Leave blank to keep existing' : undefined}
                  className={inputCls}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !name.trim() || !description.trim() || !baseUrl.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
                text-sm font-semibold text-white transition-opacity hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {/* "Publish" not "Save" (2026-08-13, item 8) — this submit is a
                  real, immediate write to Meta's agent_connectors API, not a
                  local draft. Note: connector creation currently fails
                  against real Meta regardless of payload — see
                  wiki/bugs-violations/connector-creation-never-succeeds-2026-08-13.md,
                  an escalated, unresolved Meta-side issue, not a bug in this
                  form. */}
              {isEditing ? 'Publish changes' : 'Publish connector'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
                text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
    </Modal>
  )
}

// ── Add Tool Modal ────────────────────────────────────────────────────────────

interface AddToolModalProps {
  agentId: string
  connectorId: string
  onClose: () => void
  onCreated: () => void
}

function AddToolModal({ agentId, connectorId, onClose, onCreated }: AddToolModalProps) {
  const [name, setName]       = useState('')
  const [description, setDesc] = useState('')
  const [method, setMethod]   = useState('GET')
  const [path, setPath]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !description.trim() || !path.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.post(`/agents/${agentId}/connectors/${connectorId}/tools`, {
        name: name.trim(),
        description: description.trim(),
        user_auth_required: false,
        request_definition: { method, path: path.trim() },
      })
      onCreated()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

  return (
    <Modal
      title="Add Tool"
      onClose={onClose}
      preventClose={saving}
      maxWidthClassName="max-w-md"
    >
        {error && (
          <div className="mb-3">
            <ErrorBanner error={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. check_order_status"
              className={inputCls}
            />
            <p className="text-xs text-muted-foreground">Stable key, e.g. check_order_status</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Description</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="The agent reads this to decide when to call this tool. Be specific."
              className={cn(inputCls, 'resize-none')}
            />
            <p className="text-xs text-muted-foreground">
              The agent reads this to decide when to call this tool. Be specific.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">HTTP Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={inputCls}
            >
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Path</label>
            <input
              type="text"
              required
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/orders/{order_id}"
              className={inputCls}
            />
            <p className="text-xs text-muted-foreground">
              Use {'{placeholder}'} for path params, e.g. /orders/{'{order_id}'}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !name.trim() || !description.trim() || !path.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
                text-sm font-semibold text-white transition-opacity hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
                text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
    </Modal>
  )
}

// ── Tools list sub-component ─────────────────────────────────────────────────

function ToolsList({
  agentId,
  connectorId,
  refetchSignal,
}: {
  agentId: string
  connectorId: string
  refetchSignal: number
}) {
  const queryClient = useQueryClient()
  const [showAddTool, setShowAddTool] = useState(false)
  const [runningTool, setRunningTool] = useState<ConnectorTool | null>(null)
  const [deletingTool, setDeletingTool] = useState<ConnectorTool | null>(null)

  const { data: toolsRaw, isLoading } = useQuery<ConnectorTool[]>({
    queryKey: ['tools', agentId, connectorId, refetchSignal],
    queryFn: () =>
      api
        .get(`/agents/${agentId}/connectors/${connectorId}/tools`)
        .then((r) => {
          const d = r.data.data
          return Array.isArray(d) ? d : (d?.data ?? [])
        }),
  })

  const tools = toolsRaw ?? []

  const deleteToolMutation = useMutation({
    mutationFn: (toolId: string) =>
      api.delete(`/agents/${agentId}/connectors/${connectorId}/tools/${toolId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools', agentId, connectorId] })
      setDeletingTool(null)
    },
  })

  return (
    <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tools
        </span>
        <button
          onClick={() => setShowAddTool(true)}
          className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium
            text-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Tool
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No tools yet. Add tools to let the agent call this connector.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tools.map((tool) => {
            const methodCls = METHOD_BADGE[tool.request_definition.method] ?? 'bg-muted text-muted-foreground'
            return (
              <li
                key={tool.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      methodCls,
                    )}
                  >
                    {tool.request_definition.method}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{tool.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {tool.request_definition.path}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRunningTool(tool)}
                  aria-label={`Run tool ${tool.name}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-accent-teal-solid"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeletingTool(tool)}
                  aria-label={`Delete tool ${tool.name}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {showAddTool && (
        <AddToolModal
          agentId={agentId}
          connectorId={connectorId}
          onClose={() => setShowAddTool(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['tools', agentId, connectorId] })
            setShowAddTool(false)
          }}
        />
      )}

      {runningTool && (
        <RunToolModal
          agentId={agentId}
          connectorId={connectorId}
          toolId={runningTool.id}
          toolName={runningTool.name}
          onClose={() => setRunningTool(null)}
        />
      )}

      {deletingTool && (
        <Modal
          title={`Delete tool "${deletingTool.name}"?`}
          onClose={() => setDeletingTool(null)}
          preventClose={deleteToolMutation.isPending}
        >
          <p className="text-sm text-muted-foreground">
            The agent will no longer be able to call this tool. This can&apos;t be undone.
          </p>

          {deleteToolMutation.isError && (
            <div className="mt-3">
              <ErrorBanner error={deleteToolMutation.error} />
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => deleteToolMutation.mutate(deletingTool.id)}
              disabled={deleteToolMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5
                text-sm font-semibold text-white transition-opacity hover:opacity-90
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteToolMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete tool
            </button>
            <button
              onClick={() => setDeletingTool(null)}
              disabled={deleteToolMutation.isPending}
              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
                text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── ConnectorsTab ─────────────────────────────────────────────────────────────

function ConnectorsTab({ agent }: { agent: AgentApi }) {
  const queryClient = useQueryClient()
  const [expandedConnectorId, setExpandedConnectorId] = useState<string | null>(null)
  const [showAddConnector, setShowAddConnector] = useState(false)
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null)
  const [deletingConnector, setDeletingConnector] = useState<Connector | null>(null)
  // keyed by connectorId — tracks refetch signal per connector's tools
  const [toolRefetch] = useState<Record<string, number>>({})

  const { data: connectorsRaw, isLoading } = useQuery<Connector[]>({
    queryKey: ['connectors', agent.id],
    queryFn: () =>
      api.get(`/agents/${agent.id}/connectors`).then((r) => {
        const d = r.data.data
        return Array.isArray(d) ? d : (d?.data ?? [])
      }),
    enabled: !!agent.phoneNumberId,
  })

  const connectors = connectorsRaw ?? []

  const deleteConnectorMutation = useMutation({
    mutationFn: (connectorId: string) => api.delete(`/agents/${agent.id}/connectors/${connectorId}`),
    onSuccess: (_data, connectorId) => {
      queryClient.invalidateQueries({ queryKey: ['connectors', agent.id] })
      if (expandedConnectorId === connectorId) setExpandedConnectorId(null)
      setDeletingConnector(null)
    },
  })

  if (!agent.phoneNumberId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-16 text-center shadow-surface-resting">
        <Plug className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-semibold text-foreground">No phone number connected</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Connect a phone number in Settings to use connectors.
        </p>
      </div>
    )
  }

  function toggleExpand(connectorId: string) {
    setExpandedConnectorId((prev) => (prev === connectorId ? null : connectorId))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Connectors</h3>
        <button
          onClick={() => setShowAddConnector(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold
            text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Connector
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : connectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-14 text-center shadow-surface-resting">
          <Plug className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">No connectors yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Add a connector to let the agent call your APIs and take action for customers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {connectors.map((connector) => {
            const status = connector.connection_status?.status ?? ''
            const isExpanded = expandedConnectorId === connector.id
            return (
              <div
                key={connector.id}
                className="rounded-xl border bg-card shadow-surface-resting overflow-hidden"
              >
                {/* Connector row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Plug className={cn('h-4 w-4 shrink-0', connectorPlugColor(status))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{connector.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{connector.base_url}</p>
                  </div>
                  <span className="shrink-0">
                    <StatusIndicator label={status || 'Unknown'} tone={connectorStatusTone(status)} />
                  </span>
                  <button
                    onClick={() => toggleExpand(connector.id)}
                    aria-label={isExpanded ? 'Collapse tools' : 'Expand tools'}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingConnector(connector)}
                    aria-label={`Edit connector ${connector.name}`}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingConnector(connector)}
                    aria-label={`Delete connector ${connector.name}`}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Tools list */}
                {isExpanded && (
                  <ToolsList
                    agentId={agent.id}
                    connectorId={connector.id}
                    refetchSignal={toolRefetch[connector.id] ?? 0}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAddConnector && (
        <AddConnectorModal
          agentId={agent.id}
          onClose={() => setShowAddConnector(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['connectors', agent.id] })
            setShowAddConnector(false)
          }}
        />
      )}

      {editingConnector && (
        <AddConnectorModal
          agentId={agent.id}
          editingConnector={editingConnector}
          onClose={() => setEditingConnector(null)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['connectors', agent.id] })
            setEditingConnector(null)
          }}
        />
      )}

      {deletingConnector && (
        <Modal
          title={`Delete connector "${deletingConnector.name}"?`}
          onClose={() => setDeletingConnector(null)}
          preventClose={deleteConnectorMutation.isPending}
        >
          <p className="text-sm text-muted-foreground">
            This removes the connector and all of its tools. The agent will no longer be able to
            call them. This can&apos;t be undone.
          </p>

          {deleteConnectorMutation.isError && (
            <div className="mt-3">
              <ErrorBanner error={deleteConnectorMutation.error} />
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => deleteConnectorMutation.mutate(deletingConnector.id)}
              disabled={deleteConnectorMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5
                text-sm font-semibold text-white transition-opacity hover:opacity-90
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteConnectorMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete connector
            </button>
            <button
              onClick={() => setDeletingConnector(null)}
              disabled={deleteConnectorMutation.isPending}
              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
                text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ agent, onDeleted }: { agent: AgentApi; onDeleted: () => void }) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteFromMetaModal, setShowDeleteFromMetaModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      displayName: agent.displayName,
      systemPrompt: agent.systemPrompt ?? '',
      aboutLabel: agent.aboutLabel ?? '',
      tone: agent.tone ?? '',
      language: agent.language ?? '',
      behaviorRules: agent.behaviorRules ?? '',
      handoffEnabled: agent.handoffEnabled,
      handoffMessage: agent.handoffMessage ?? '',
    },
  })

  const promptLength = (watch('systemPrompt') ?? '').length
  const toneValue = watch('tone') ?? ''
  const handoffEnabledValue = watch('handoffEnabled')

  const saveMutation = useMutation({
    mutationFn: (values: SettingsValues) =>
      api.put(`/agents/${agent.id}`, {
        displayName: values.displayName,
        systemPrompt: values.systemPrompt,
        aboutLabel: values.aboutLabel || null,
        tone: values.tone || null,
        language: values.language || null,
        behaviorRules: values.behaviorRules || null,
        handoffEnabled: values.handoffEnabled,
        handoffMessage: values.handoffEnabled ? (values.handoffMessage || null) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err) => setServerError(extractErrorMessage(err)),
  })

  // Handoff is the only Settings-tab field Meta's API actually accepts
  // (agent_config/settings handoff.{enabled,message}) — tone/language/
  // behaviorRules/systemPrompt/aboutLabel/displayName have no matching Meta
  // endpoint at all, they're local-only product fields, so "publish" only
  // applies to handoff here. A save reaching our DB does NOT mean Meta has
  // it — handoffPublishedAt (V49) is the only source of truth for that.
  const handoffIsDraft = !agent.handoffPublishedAt || new Date(agent.updatedAt) > new Date(agent.handoffPublishedAt)
  const publishHandoffMutation = useMutation({
    mutationFn: () => api.post(`/agents/${agent.id}/settings/publish-handoff`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
    },
    onError: (err) => setServerError(extractErrorMessage(err)),
  })

  return (
    <div className="space-y-6">
      {/* Settings form */}
      <div className="rounded-xl border bg-card p-6 shadow-surface-resting">
        <form
          onSubmit={handleSubmit((v) => { setServerError(null); saveMutation.mutate(v) })}
          noValidate
          className="space-y-5"
        >
          {serverError && <ErrorBanner error={serverError} />}

          {/* displayName */}
          <div className="space-y-1.5">
            <label htmlFor="s-displayName" className="block text-sm font-medium text-foreground">
              Agent name
            </label>
            <input
              id="s-displayName"
              type="text"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          {/* systemPrompt */}
          <div className="space-y-1.5">
            <label htmlFor="s-systemPrompt" className="block text-sm font-medium text-foreground">
              What does your agent do?
            </label>
            <textarea
              id="s-systemPrompt"
              rows={6}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              {...register('systemPrompt')}
            />
            <div className="flex items-start justify-between">
              <div>
                {errors.systemPrompt && (
                  <p className="text-xs text-destructive">{errors.systemPrompt.message}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground shrink-0 ml-4">{promptLength}/4000</p>
            </div>
          </div>

          {/* aboutLabel — Figma 8.1 "About" column on the Agents list */}
          <div className="space-y-1.5">
            <label htmlFor="s-aboutLabel" className="block text-sm font-medium text-foreground">
              Short label
            </label>
            <p className="text-xs text-muted-foreground">
              A brief note shown in the Agents list (e.g. "Handles bulk grocery orders"). Optional.
            </p>
            <input
              id="s-aboutLabel"
              type="text"
              maxLength={255}
              placeholder="e.g. Handles bulk grocery orders"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              {...register('aboutLabel')}
            />
            {errors.aboutLabel && (
              <p className="text-xs text-destructive">{errors.aboutLabel.message}</p>
            )}
          </div>

          {/* tone */}
          <div className="space-y-1.5">
            <label htmlFor="s-tone" className="block text-sm font-medium text-foreground">
              Tone
            </label>
            <select
              id="s-tone"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              value={toneValue}
              onChange={(e) => setValue('tone', e.target.value, { shouldDirty: true })}
            >
              <option value="">Select tone (optional)</option>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* language */}
          <div className="space-y-1.5">
            <label htmlFor="s-language" className="block text-sm font-medium text-foreground">
              Language
            </label>
            <input
              id="s-language"
              type="text"
              placeholder="e.g. English"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              {...register('language')}
            />
          </div>

          {/* behaviorRules */}
          <div className="space-y-1.5">
            <label htmlFor="s-behaviorRules" className="block text-sm font-medium text-foreground">
              Behavior rules
            </label>
            <p className="text-xs text-muted-foreground">One rule per line.</p>
            <textarea
              id="s-behaviorRules"
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              {...register('behaviorRules')}
            />
          </div>

          {/* Human handoff */}
          <div className="space-y-2.5 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <label htmlFor="s-handoffEnabled" className="block text-sm font-medium text-foreground">
                    Human handoff
                  </label>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      handoffIsDraft
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-brand-green/10 text-brand-green',
                    )}
                  >
                    {handoffIsDraft ? 'Draft — not on Meta' : 'Published to Meta'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Let the agent hand a conversation to a human when it can't help. Saving above stores your
                  choice locally; nothing reaches Meta until you publish it below.
                </p>
              </div>
              <button
                type="button"
                id="s-handoffEnabled"
                role="switch"
                aria-checked={handoffEnabledValue}
                onClick={() => setValue('handoffEnabled', !handoffEnabledValue, { shouldDirty: true })}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                  handoffEnabledValue ? 'bg-accent-teal-solid' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    handoffEnabledValue ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>

            {handoffEnabledValue && (
              <div className="space-y-1.5 pt-1">
                <label htmlFor="s-handoffMessage" className="block text-xs font-medium text-foreground">
                  Message shown to the customer on handoff
                </label>
                <textarea
                  id="s-handoffMessage"
                  rows={2}
                  placeholder="A team member will join the conversation shortly."
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm
                    placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
                  {...register('handoffMessage')}
                />
                {errors.handoffMessage && (
                  <p className="text-xs text-destructive">{errors.handoffMessage.message}</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={!agent.phoneNumberId || isDirty || !handoffIsDraft || publishHandoffMutation.isPending}
                onClick={() => publishHandoffMutation.mutate()}
                title={!agent.phoneNumberId ? 'Connect a phone number first' : isDirty ? 'Save your changes above first' : undefined}
                className="flex items-center gap-2 rounded-lg border border-accent-teal-solid px-4 py-2
                  text-sm font-medium text-accent-teal-solid transition-opacity hover:opacity-90
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishHandoffMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Publish handoff to Meta
              </button>
              {publishHandoffMutation.isSuccess && (
                <span className="text-sm font-medium text-brand-green">Live on Meta!</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-5 py-2.5
                text-sm font-semibold text-white transition-opacity hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Publish
            </button>
            {/* Per-tab draft indicator, not a global one (2026-08-13 founder
                decision — see wiki/decisions/). isDirty here is react-hook-form's
                own dirty tracking against defaultValues, which already IS the
                draft-vs-live comparison for this tab: nothing is written to
                /agents/{id} until Publish is clicked. */}
            {isDirty && !saved && <StatusIndicator label="Draft — not yet published" tone="warning" />}
            {saved && <span className="text-sm font-medium text-brand-green">Published!</span>}
          </div>
        </form>
      </div>

      {/* Phone number */}
      <div className="rounded-xl border bg-card p-5 shadow-surface-resting space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Phone number</h3>
        {agent.phoneNumberId ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">
              Connected: <span className="font-medium">{agent.displayPhoneNumber ?? agent.phoneNumberId}</span>
            </p>
            <button
              onClick={() => {
                // TODO: wire disconnect phone
              }}
              className="text-xs text-destructive hover:underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">No phone number connected.</p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium
                text-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4" />
              Connect phone number
            </button>
          </div>
        )}
      </div>

      {/* Audience / Allowlist */}
      <AudienceSection agentId={agent.id} phoneNumberId={agent.phoneNumberId} />

      {/* Actions */}
      <div className="rounded-xl border bg-card p-5 shadow-surface-resting">
        <h3 className="text-sm font-semibold text-foreground">Actions</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Trigger a business-side event (e.g. a payment or shipment update) at this agent.
        </p>
        <button
          onClick={() => setShowEventModal(true)}
          disabled={!agent.phoneNumberId}
          title={!agent.phoneNumberId ? 'Connect a phone number first' : undefined}
          className="mt-3 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold
            text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          Trigger event
        </button>
      </div>

      {/* Danger zone */}
      {(agent.sharedAccountCount ?? 0) > 1 && (
        <ConsequenceLine tone="warning">
          This WABA is shared — actions below affect every account connected to it, not just yours.
        </ConsequenceLine>
      )}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-destructive">Delete this agent</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Clears this agent's persona, connectors and skills on Meta, removes its configuration
              from the phone number, then deletes it and all its data here. This cannot be undone.
              Active conversations will be dropped.
            </p>
            {agent.phoneNumberId && agent.status !== 'paused' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Pause this agent first — deleting changes its configuration on Meta, which must not
                happen while it's still answering customers.
              </p>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={!!agent.phoneNumberId && agent.status !== 'paused'}
              className="mt-4 flex items-center gap-2 rounded-lg border border-destructive px-4 py-2
                text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete agent
            </button>
          </div>
        </div>
      </div>

      {/* Danger zone — Meta removal (distinct action, distinct consequence from the DB delete above) */}
      <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-destructive">Remove agent from Meta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Removes the agent configuration from Meta for this phone number, freeing it up for
              another agent. This cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteFromMetaModal(true)}
              disabled={agent.status !== 'paused' || !agent.phoneNumberId}
              className="mt-4 flex items-center gap-2 rounded-lg border border-destructive px-4 py-2
                text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Remove from Meta
            </button>
            {agent.status !== 'paused' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Pause this agent before removing it from Meta.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Delete = Meta teardown + local cleanup, with a per-step report when
          Meta doesn't come away clean. See DeleteAgentModal. */}
      {showDeleteModal && (
        <DeleteAgentModal
          agentId={agent.id}
          agentName={agent.displayName}
          phoneNumberId={agent.phoneNumberId}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={onDeleted}
        />
      )}

      {showConnectModal && (
        <ConnectPhoneModal agentId={agent.id} onClose={() => setShowConnectModal(false)} />
      )}

      {showDeleteFromMetaModal && agent.phoneNumberId && (
        <DeleteFromMetaModal
          agentId={agent.id}
          agentName={agent.displayName}
          phoneNumberId={agent.phoneNumberId}
          onClose={() => setShowDeleteFromMetaModal(false)}
          onDeleted={() => {
            setShowDeleteFromMetaModal(false)
            queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
            queryClient.invalidateQueries({ queryKey: ['agents'] })
          }}
        />
      )}

      {showEventModal && (
        <TriggerEventModal agentId={agent.id} onClose={() => setShowEventModal(false)} />
      )}
    </div>
  )
}

// ── Audience / Allowlist ────────────────────────────────────────────────────────
// Meta's live settings.ai_audience + agent_config/allowlist — independent of
// the local Agent form above since this reflects Meta's own live state, same
// pattern as BusinessProfileTab's separate draft/live model. One list serves
// both "test against known numbers" and "phased rollout" use cases — PM call
// (2026-08-04): same mechanism, not two features.

interface AllowlistEntry {
  id: string
  consumer_phone_number: string
}

function AudienceSection({ agentId, phoneNumberId }: { agentId: string; phoneNumberId: string | null }) {
  const queryClient = useQueryClient()
  const [newNumber, setNewNumber] = useState('')
  const [error, setError] = useState<string | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['agent-settings', agentId],
    queryFn: () => api.get(`/agents/${agentId}/settings`).then((r) => r.data.data as any[]),
    enabled: !!phoneNumberId,
  })
  const whatsappEntry = settingsQuery.data?.find((e) => e.channel === 'whatsapp')
  const liveAudience: 'EVERYONE' | 'ALLOWLISTED_ONLY' = whatsappEntry?.ai_audience ?? 'EVERYONE'

  const allowlistQuery = useQuery({
    queryKey: ['agent-allowlist', agentId],
    queryFn: () => api.get(`/agents/${agentId}/allowlist`).then((r) => r.data.data as AllowlistEntry[]),
    enabled: !!phoneNumberId,
  })
  const allowlist = allowlistQuery.data ?? []

  // Draft/publish (2026-08-13): toggling this switch used to fire the PUT
  // immediately. Founder wants edits held as a local draft with their own
  // per-tab Publish action — this is the first real usage of the shared
  // useDraftPublish hook (see frontend/src/hooks/useDraftPublish.ts).
  const audienceDraft = useDraftPublish<'EVERYONE' | 'ALLOWLISTED_ONLY'>({
    liveValue: liveAudience,
    publish: (ai_audience) => api.put(`/agents/${agentId}/settings/audience`, { ai_audience }),
    onPublished: () => queryClient.invalidateQueries({ queryKey: ['agent-settings', agentId] }),
  })
  const currentAudience = audienceDraft.draft

  const addMutation = useMutation({
    mutationFn: (consumer_phone_number: string) =>
      api.post(`/agents/${agentId}/allowlist`, { consumer_phone_number }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-allowlist', agentId] })
      setNewNumber('')
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const removeMutation = useMutation({
    mutationFn: (entryId: string) => api.delete(`/agents/${agentId}/allowlist/${entryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-allowlist', agentId] }),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  if (!phoneNumberId) return null

  const handleToggleAudience = () => {
    setError(null)
    if (currentAudience === 'EVERYONE') {
      // Guard (PM condition, 2026-08-04): never let ALLOWLISTED_ONLY go live
      // with zero numbers — that silently blocks every consumer with no
      // visible explanation. Still enforced at draft time, before Publish.
      if (allowlist.length === 0) {
        setError('Add at least one number to the allowlist before restricting the audience.')
        return
      }
      audienceDraft.setDraft('ALLOWLISTED_ONLY')
    } else {
      audienceDraft.setDraft('EVERYONE')
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-surface-resting space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Audience</h3>
            {audienceDraft.isDirty && <StatusIndicator label="Draft — not yet published" tone="warning" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Restrict responses to specific numbers — for testing before launch or a client-controlled phased rollout.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={currentAudience === 'ALLOWLISTED_ONLY'}
          disabled={settingsQuery.isLoading}
          onClick={handleToggleAudience}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
            currentAudience === 'ALLOWLISTED_ONLY' ? 'bg-accent-teal-solid' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              currentAudience === 'ALLOWLISTED_ONLY' ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>

      {currentAudience === 'ALLOWLISTED_ONLY' && (
        <p className="text-xs font-medium text-accent-teal-solid">
          Only the numbers below receive AI responses. Everyone else is silently ignored.
        </p>
      )}

      {audienceDraft.isDirty && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={audienceDraft.publish}
            disabled={audienceDraft.isPublishing}
            className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold
              text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {audienceDraft.isPublishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Publish
          </button>
          <button
            type="button"
            onClick={audienceDraft.resetDraft}
            disabled={audienceDraft.isPublishing}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Discard draft
          </button>
        </div>
      )}

      {audienceDraft.publishError != null && <ErrorBanner error={audienceDraft.publishError} />}
      {error && <ErrorBanner error={error} />}

      <div className="space-y-2">
        {allowlistQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading allowlist…</p>
        ) : allowlist.length === 0 ? (
          <p className="text-xs text-muted-foreground">No numbers added yet.</p>
        ) : (
          <ul className="space-y-1">
            {allowlist.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                <span className="text-foreground">{entry.consumer_phone_number}</span>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(entry.id)}
                  disabled={removeMutation.isPending}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            placeholder="+15551234567 (E.164 format)"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
          <button
            type="button"
            disabled={!newNumber.trim() || addMutation.isPending}
            onClick={() => { setError(null); addMutation.mutate(newNumber.trim()) }}
            className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium
              text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Test drawer ───────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

const TEST_DRAWER_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function TestDrawer({
  agentId,
  agentStatus,
  onClose,
}: {
  agentId: string
  agentStatus: AgentApi['status']
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [convId, setConvId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerElementRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, testLoading])

  // Dialog behavior per DESIGN.md §5: Escape-to-close, focus trap, initial
  // focus, restore focus to the trigger on close. Mirrors Modal.tsx's
  // pattern — mount/unmount only; onClose read via ref so it doesn't
  // re-run trigger-capture/initial-focus/restore on every re-render.
  useEffect(() => {
    triggerElementRef.current = document.activeElement
    const panel = panelRef.current
    const focusable = panel?.querySelectorAll<HTMLElement>(TEST_DRAWER_FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(TEST_DRAWER_FOCUSABLE_SELECTOR)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (triggerElementRef.current instanceof HTMLElement) {
        triggerElementRef.current.focus()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || testLoading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setTestLoading(true)
    try {
      const r = await api.post(`/agents/${agentId}/test`, {
        userMsg: text,
        conversationId: convId,
      })
      const d = r.data.data
      setConvId(d.conversationId ?? null)
      const fallback = d.handoffReason
        ? `(handed off to human: ${d.handoffReason})`
        : d.noResponseReason
          ? `(no response: ${d.noResponseReason})`
          : '(no response)'
      setMessages((m) => [...m, { role: 'agent', text: d.agentResponse || fallback }])
    } catch (err) {
      const message = extractErrorMessage(err)
      console.error('Agent test message failed', err)
      setMessages((m) => [...m, { role: 'agent', text: `Test failed: ${message}` }])
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed right-0 top-0 h-full w-full sm:w-96 bg-card shadow-2xl z-50 flex flex-col border-l"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <p id={titleId} className="text-sm font-semibold text-foreground">Test Agent</p>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close test panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {agentStatus !== 'active' ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Rocket className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">Deploy your agent first</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Publish your agent to start testing it here.
          </p>
        </div>
      ) : (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Send a message to start testing your agent.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-accent-teal-solid text-white rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm',
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {testLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Type a message…"
                disabled={testLoading}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition
                  disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || testLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-teal-solid text-white
                  transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Skeleton / error states ────────────────────────────────────────────────────

function AgentDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
      <div className="h-5 w-28 rounded bg-muted" />
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-3.5 w-32 rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-[200px_1fr] gap-6">
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    </div>
  )
}

function AgentNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Bot className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-base font-semibold text-foreground">Agent not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">This agent may have been deleted.</p>
      <button
        onClick={onBack}
        className="mt-6 rounded-lg bg-accent-teal-solid px-5 py-2.5 text-sm font-semibold text-white
          transition-opacity hover:opacity-90"
      >
        Back to Agents
      </button>
    </div>
  )
}
