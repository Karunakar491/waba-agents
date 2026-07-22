import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot, Circle, ArrowLeft, Loader2, Play, Pause, Trash2, Save,
  Phone, AlertTriangle,
} from 'lucide-react'
import api from '../lib/api'
import ConnectPhoneModal from '../components/waba/ConnectPhoneModal'

interface Agent {
  /** Route param string — TSIDs exceed Number.MAX_SAFE_INTEGER, never a JS number */
  id: string
  name: string
  status: 'draft' | 'active' | 'paused'
  phoneNumber: string | null
  systemPrompt: string
  lastActiveAt: string | null
  conversationCount: number
}

/** Raw backend Agent entity shape (ApiResponse envelope: { success, data }) */
interface AgentApi {
  displayName: string
  status: Agent['status']
  phoneNumberId: string | null
  systemPrompt: string | null
  deployedAt: string | null
}

const STATUS_CONFIG = {
  active: { label: 'Active',  color: 'text-brand-green', bg: 'bg-brand-green/10' },
  paused: { label: 'Paused',  color: 'text-yellow-600',  bg: 'bg-yellow-50'      },
  draft:  { label: 'Draft',   color: 'text-muted-foreground', bg: 'bg-muted'     },
}

type Tab = 'overview' | 'settings' | 'danger'

const settingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  systemPrompt: z.string().min(20, 'Please provide at least 20 characters').max(4000),
})
type SettingsValues = z.infer<typeof settingsSchema>

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: agent, isLoading, isError } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () =>
      api.get(`/agents/${id}`).then((r): Agent => {
        const d = r.data.data as AgentApi
        return {
          id: id as string,
          name: d.displayName,
          status: d.status,
          phoneNumber: d.phoneNumberId ?? null,
          systemPrompt: d.systemPrompt ?? '',
          lastActiveAt: d.deployedAt ?? null,
          conversationCount: 0,
        }
      }),
    enabled: !!id,
  })

  if (isLoading) return <AgentDetailSkeleton />
  if (isError || !agent) return <AgentNotFound onBack={() => navigate('/dashboard')} />

  const cfg = STATUS_CONFIG[agent.status]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{agent.name}</h1>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                <Circle className="h-1.5 w-1.5 fill-current" />
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3.5 w-3.5" />
              {agent.phoneNumber ?? 'No number connected'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'settings', label: 'Settings' },
          { key: 'danger',   label: 'Danger Zone', danger: true },
        ] as { key: Tab; label: string; danger?: boolean }[]).map(({ key, label, danger }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? danger
                  ? 'border-destructive text-destructive'
                  : 'border-primary text-primary'
                : danger
                  ? 'border-transparent text-muted-foreground hover:text-destructive'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab agent={agent} />}
      {activeTab === 'settings' && <SettingsTab agent={agent} />}
      {activeTab === 'danger'   && <DangerTab   agent={agent} onDeleted={() => navigate('/dashboard')} />}
    </div>
  )
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ agent }: { agent: Agent }) {
  const queryClient = useQueryClient()
  const [showConnectModal, setShowConnectModal] = useState(false)

  const deployMutation = useMutation({
    mutationFn: () => api.post(`/agents/${agent.id}/deploy`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }),
  })
  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/agents/${agent.id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }),
  })

  const actionError =
    deployMutation.error || pauseMutation.error
      ? extractMessage(deployMutation.error ?? pauseMutation.error)
      : null

  return (
    <div className="space-y-5">
      {actionError && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Description */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Agent description
        </p>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {agent.systemPrompt || <span className="text-muted-foreground italic">No description set.</span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total conversations</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {agent.conversationCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Last active</p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {agent.lastActiveAt
              ? new Date(agent.lastActiveAt).toLocaleDateString('en', { dateStyle: 'medium' })
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {(agent.status === 'draft' || agent.status === 'paused') && (
          <button
            onClick={() => deployMutation.mutate()}
            disabled={deployMutation.isPending || !agent.phoneNumber}
            title={!agent.phoneNumber ? 'Connect a phone number first' : undefined}
            className="flex items-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5
              text-sm font-semibold text-white transition-opacity hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deployMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {agent.status === 'paused' ? 'Resume' : 'Deploy'}
          </button>
        )}
        {agent.status === 'active' && (
          <button
            onClick={() => pauseMutation.mutate()}
            disabled={pauseMutation.isPending}
            className="flex items-center gap-2 rounded-lg border px-5 py-2.5
              text-sm font-semibold text-foreground transition-colors hover:bg-muted
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pauseMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Pause
          </button>
        )}
        {!agent.phoneNumber && (
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 rounded-lg border px-5 py-2.5
              text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Phone className="h-4 w-4" />
            Connect phone number
          </button>
        )}
        {agent.status === 'draft' && !agent.phoneNumber && (
          <p className="text-xs text-muted-foreground">
            Connect a WhatsApp number to enable deployment.
          </p>
        )}
      </div>

      {showConnectModal && (
        <ConnectPhoneModal agentId={agent.id} onClose={() => setShowConnectModal(false)} />
      )}
    </div>
  )
}

// ── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ agent }: { agent: Agent }) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<SettingsValues>({
      resolver: zodResolver(settingsSchema),
      defaultValues: { name: agent.name, systemPrompt: agent.systemPrompt },
    })

  const promptLength = (watch('systemPrompt') ?? '').length

  const mutation = useMutation({
    mutationFn: (values: SettingsValues) =>
      api.put(`/agents/${agent.id}`, values).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err) => setServerError(extractMessage(err)),
  })

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <form onSubmit={handleSubmit((v) => { setServerError(null); mutation.mutate(v) })} noValidate className="space-y-5">
        {serverError && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="s-name" className="block text-sm font-medium text-foreground">
            Agent name
          </label>
          <input
            id="s-name"
            type="text"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
              placeholder:text-muted-foreground focus:outline-none focus:ring-2
              focus:ring-primary/50 focus:border-primary transition"
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="s-prompt" className="block text-sm font-medium text-foreground">
            What should your agent do?
          </label>
          <textarea
            id="s-prompt"
            rows={8}
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
              placeholder:text-muted-foreground focus:outline-none focus:ring-2
              focus:ring-primary/50 focus:border-primary transition resize-none"
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
          {saved && <span className="text-sm text-brand-green font-medium">Saved!</span>}
        </div>
      </form>
    </div>
  )
}

// ── Danger Zone tab ───────────────────────────────────────────────────────────

function DangerTab({ agent, onDeleted }: { agent: Agent; onDeleted: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/agents/${agent.id}`),
    onSuccess: onDeleted,
    onError: (err) => setDeleteError(extractMessage(err)),
  })

  const nameMatches = confirmName.trim() === agent.name.trim()

  return (
    <div className="space-y-4">
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
              onClick={() => { setShowModal(true); setConfirmName(''); setDeleteError(null) }}
              className="mt-4 flex items-center gap-2 rounded-lg border border-destructive px-4 py-2
                text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Delete agent
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-base font-semibold text-foreground">Delete "{agent.name}"?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This action is permanent and cannot be undone. Type{' '}
              <strong className="text-foreground font-semibold">{agent.name}</strong> to confirm.
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
              placeholder={agent.name}
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
                onClick={() => setShowModal(false)}
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
    </div>
  )
}

// ── Skeleton / error states ───────────────────────────────────────────────────

function AgentDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
      <div className="h-6 w-32 rounded bg-muted" />
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-3.5 w-32 rounded bg-muted" />
        </div>
      </div>
      <div className="h-10 rounded bg-muted" />
      <div className="h-40 rounded-xl bg-muted" />
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
        Back to Dashboard
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}
