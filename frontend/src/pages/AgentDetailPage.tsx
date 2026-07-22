import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot,
  Circle,
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
  Send,
} from 'lucide-react'
import { cn } from '../lib/utils'
import api from '../lib/api'
import ConnectPhoneModal from '../components/waba/ConnectPhoneModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentApi {
  id: string
  displayName: string
  status: 'draft' | 'active' | 'paused'
  phoneNumberId: string | null
  systemPrompt: string | null
  tone: string | null
  language: string | null
  behaviorRules: string | null
  updatedAt: string
  deployedAt: string | null
}

interface Faq {
  id: string
  question: string
  answer: string
}

type KbTab = 'faqs' | 'websites' | 'files'
type DetailTab = 'knowledge' | 'skills' | 'connectors' | 'settings'

const STATUS_CONFIG = {
  active: { label: 'Active',  color: 'text-brand-green', bg: 'bg-brand-green/10' },
  paused: { label: 'Paused',  color: 'text-yellow-600',  bg: 'bg-yellow-50'      },
  draft:  { label: 'Draft',   color: 'text-muted-foreground', bg: 'bg-muted'      },
}

const TONES = ['Friendly', 'Professional', 'Casual', 'Formal']

const settingsSchema = z.object({
  displayName: z.string().min(2, 'At least 2 characters').max(80, 'Max 80 characters'),
  systemPrompt: z.string().min(20, 'At least 20 characters').max(4000, 'Max 4000 characters'),
  tone: z.string().optional(),
  language: z.string().optional(),
  behaviorRules: z.string().optional(),
})
type SettingsValues = z.infer<typeof settingsSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DetailTab>('knowledge')
  const [testOpen, setTestOpen] = useState(false)

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

  if (isLoading) return <AgentDetailSkeleton />
  if (isError || !agent) return <AgentNotFound onBack={() => navigate('/agents')} />

  const cfg = STATUS_CONFIG[agent.status]
  const canDeploy = !!agent.phoneNumberId
  const actionError =
    deployMutation.error || pauseMutation.error
      ? extractMessage(deployMutation.error ?? pauseMutation.error)
      : null

  const LEFT_TABS: { key: DetailTab; icon: React.FC<{ className?: string }>; label: string }[] = [
    { key: 'knowledge',  icon: BookOpen,  label: 'Knowledge Base' },
    { key: 'skills',     icon: Zap,       label: 'Skills'         },
    { key: 'connectors', icon: Plug,      label: 'Connectors'     },
    { key: 'settings',   icon: Settings2, label: 'Settings'       },
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

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{agent.displayName}</h1>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                  >
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    {cfg.label}
                  </span>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {agent.phoneNumberId ?? 'No number connected'}
                </p>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
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
                    className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold
                      text-white transition-opacity hover:opacity-90"
                  >
                    <Zap className="h-4 w-4" />
                    Test Agent
                  </button>
                </>
              )}
              {(agent.status === 'draft' || agent.status === 'paused') && (
                <button
                  onClick={() => deployMutation.mutate()}
                  disabled={deployMutation.isPending || !canDeploy}
                  title={!canDeploy ? 'Connect a phone number first' : undefined}
                  className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold
                    text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deployMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Publish &amp; Test
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <div className="mt-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {actionError}
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
            {activeTab === 'skills' && <SkillsPlaceholder />}
            {activeTab === 'connectors' && <ConnectorsPlaceholder />}
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
    </>
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
      <WebsitesSection open={websitesOpen} onToggle={() => setWebsitesOpen((v) => !v)} />
      <FilesSection open={filesOpen} onToggle={() => setFilesOpen((v) => !v)} />
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
    onError: (err) => setAddError(extractMessage(err)),
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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
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
              {addError && (
                <p className="text-xs text-destructive">{addError}</p>
              )}
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Question"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                  placeholder:text-muted-foreground focus:outline-none focus:ring-2
                  focus:ring-primary/50 focus:border-primary transition"
              />
              <textarea
                rows={3}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer"
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm
                  placeholder:text-muted-foreground focus:outline-none focus:ring-2
                  focus:ring-primary/50 focus:border-primary transition"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!question.trim() || !answer.trim() || addMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold
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
                    <p className="text-sm font-medium text-foreground">{faq.question}</p>
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

// ── Websites section (placeholder) ───────────────────────────────────────────

function WebsitesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [url, setUrl] = useState('')

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
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
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            0
          </span>
        </div>
        {open && (
          <span className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary border border-primary/30">
            <Plus className="inline h-3.5 w-3.5 mr-1" />
            Add URL
          </span>
        )}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            No websites added. Add your website URL to let the agent learn from your content.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground focus:outline-none focus:ring-2
                focus:ring-primary/50 focus:border-primary transition"
            />
            <button
              onClick={() => {
                // TODO: wire POST /agents/:id/websites
                console.log('Add website:', url)
                setUrl('')
              }}
              disabled={!url.trim()}
              className="rounded-lg bg-brand-pink px-4 py-2 text-xs font-semibold text-white
                transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Files section (placeholder) ───────────────────────────────────────────────

function FilesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
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
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            0
          </span>
        </div>
        {open && (
          <label
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary border border-primary/30
              cursor-pointer hover:bg-primary/5 transition-colors"
          >
            <Plus className="inline h-3.5 w-3.5 mr-1" />
            Upload
            <input
              type="file"
              accept=".pdf,.docx"
              className="sr-only"
              onChange={(e) => {
                // TODO: wire POST /agents/:id/files
                console.log('Upload file:', e.target.files?.[0])
              }}
            />
          </label>
        )}
      </button>

      {open && (
        <div className="border-t px-4 py-4">
          <p className="text-sm text-muted-foreground">No files uploaded.</p>
        </div>
      )}
    </div>
  )
}

// ── Skills placeholder ────────────────────────────────────────────────────────

function SkillsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-16 text-center shadow-sm">
      <Zap className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="font-semibold text-foreground">Skills coming soon</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">
        Define specific behaviors — like how to handle refunds or book appointments.
      </p>
    </div>
  )
}

// ── Connectors placeholder ────────────────────────────────────────────────────

function ConnectorsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-16 text-center shadow-sm">
      <Plug className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="font-semibold text-foreground">Connectors coming soon</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">
        Connect your CRM, booking system, or order platform so your agent can take action.
      </p>
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
  const [confirmName, setConfirmName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
      tone: agent.tone ?? '',
      language: agent.language ?? '',
      behaviorRules: agent.behaviorRules ?? '',
    },
  })

  const promptLength = (watch('systemPrompt') ?? '').length
  const toneValue = watch('tone') ?? ''

  const saveMutation = useMutation({
    mutationFn: (values: SettingsValues) =>
      api.put(`/agents/${agent.id}`, {
        displayName: values.displayName,
        systemPrompt: values.systemPrompt,
        tone: values.tone || null,
        language: values.language || null,
        behaviorRules: values.behaviorRules || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err) => setServerError(extractMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/agents/${agent.id}`),
    onSuccess: onDeleted,
    onError: (err) => setDeleteError(extractMessage(err)),
  })

  const nameMatches = confirmName.trim() === agent.displayName.trim()

  return (
    <div className="space-y-6">
      {/* Settings form */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <form
          onSubmit={handleSubmit((v) => { setServerError(null); saveMutation.mutate(v) })}
          noValidate
          className="space-y-5"
        >
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {/* displayName */}
          <div className="space-y-1.5">
            <label htmlFor="s-displayName" className="block text-sm font-medium text-foreground">
              Agent name
            </label>
            <input
              id="s-displayName"
              type="text"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                placeholder:text-muted-foreground focus:outline-none focus:ring-2
                focus:ring-primary/50 focus:border-primary transition"
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
                placeholder:text-muted-foreground focus:outline-none focus:ring-2
                focus:ring-primary/50 focus:border-primary transition"
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

          {/* tone */}
          <div className="space-y-1.5">
            <label htmlFor="s-tone" className="block text-sm font-medium text-foreground">
              Tone
            </label>
            <select
              id="s-tone"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
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
                placeholder:text-muted-foreground focus:outline-none focus:ring-2
                focus:ring-primary/50 focus:border-primary transition"
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
                placeholder:text-muted-foreground focus:outline-none focus:ring-2
                focus:ring-primary/50 focus:border-primary transition"
              {...register('behaviorRules')}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex items-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5
                text-sm font-semibold text-white transition-opacity hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
            {saved && <span className="text-sm font-medium text-brand-green">Saved!</span>}
          </div>
        </form>
      </div>

      {/* Phone number */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Phone number</h3>
        {agent.phoneNumberId ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">
              Connected: <span className="font-medium">{agent.phoneNumberId}</span>
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

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-destructive">Delete this agent</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently deletes this agent and all its data. This cannot be undone. Active
              conversations will be dropped.
            </p>
            <button
              onClick={() => { setShowDeleteModal(true); setConfirmName(''); setDeleteError(null) }}
              className="mt-4 flex items-center gap-2 rounded-lg border border-destructive px-4 py-2
                text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Delete agent
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-base font-semibold text-foreground">
              Delete &quot;{agent.displayName}&quot;?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This action is permanent and cannot be undone. Type{' '}
              <strong className="font-semibold text-foreground">{agent.displayName}</strong> to
              confirm.
            </p>

            {deleteError && (
              <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </div>
            )}

            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={agent.displayName}
              autoFocus
              className="mt-4 w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-destructive/40 focus:border-destructive transition"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={!nameMatches || deleteMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5
                  text-sm font-semibold text-white transition-opacity hover:opacity-90
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete permanently
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
                  text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showConnectModal && (
        <ConnectPhoneModal agentId={agent.id} onClose={() => setShowConnectModal(false)} />
      )}
    </div>
  )
}

// ── Test drawer ───────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, testLoading])

  async function handleSend() {
    const text = input.trim()
    if (!text || testLoading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setTestLoading(true)
    try {
      const r = await api.post(`/agents/${agentId}/test`, {
        user_msg: text,
        conversation_id: convId,
      })
      const d = r.data.data
      setConvId(d.conversation_id ?? null)
      setMessages((m) => [...m, { role: 'agent', text: d.reply ?? d.message ?? '' }])
    } catch {
      setMessages((m) => [...m, { role: 'agent', text: 'Test failed. Please try again.' }])
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-card shadow-2xl z-50 flex flex-col border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <p className="text-sm font-semibold text-foreground">Test Agent</p>
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
                      ? 'bg-brand-navy text-white rounded-tr-sm'
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
                  placeholder:text-muted-foreground focus:outline-none focus:ring-2
                  focus:ring-primary/50 focus:border-primary transition
                  disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || testLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-pink text-white
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
        className="mt-6 rounded-lg bg-brand-pink px-5 py-2.5 text-sm font-semibold text-white
          transition-opacity hover:opacity-90"
      >
        Back to Agents
      </button>
    </div>
  )
}
