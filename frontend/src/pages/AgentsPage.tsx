import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bot, Plus, Play, ArrowRight, Circle } from 'lucide-react'
import api from '../lib/api'

interface AgentRow {
  id: string
  displayName: string
  phoneNumberId: string | null
  status: 'draft' | 'active' | 'paused'
  systemPrompt: string | null
  updatedAt: string
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'text-brand-green',
    bg: 'bg-brand-green/10',
    dot: true,
  },
  paused: {
    label: 'Paused',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    dot: true,
  },
  draft: {
    label: 'Draft',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    dot: false,
  },
}

export default function AgentsPage() {
  const navigate = useNavigate()

  const { data: agents = [], isLoading } = useQuery<AgentRow[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your AI agents across WhatsApp and other channels.
          </p>
        </div>
        <button
          onClick={() => navigate('/agents/new')}
          className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2.5
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
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
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
                  onEdit={() => navigate(`/agents/${agent.id}`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AgentRow({ agent, onEdit }: { agent: AgentRow; onEdit: () => void }) {
  const cfg = STATUS_CONFIG[agent.status]

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      {/* Agent Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate max-w-[180px]">
              {agent.displayName}
            </p>
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

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
        >
          {cfg.dot && <Circle className="h-1.5 w-1.5 fill-current" />}
          {cfg.label}
        </span>
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <Bot className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No agents yet</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Create your first agent to get started on WhatsApp.
      </p>
      <button
        onClick={onCreateClick}
        className="mt-6 flex items-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5
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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            {['Agent Name', 'Phone Number', 'Status', 'Last Updated', 'Actions'].map((h) => (
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
