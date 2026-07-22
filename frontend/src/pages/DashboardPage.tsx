import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bot, MessageSquare, TrendingUp, Plus, ChevronRight, Circle } from 'lucide-react'
import api from '../lib/api'

interface Agent {
  id: number
  name: string
  status: 'active' | 'paused' | 'draft'
  phoneNumber: string | null
  lastActiveAt: string | null
  conversationCount: number
}

interface AnalyticsSummary {
  totalConversations: number
  activeAgents: number
  messagesToday: number
}

const STATUS_CONFIG = {
  active: { label: 'Active',  color: 'text-brand-green', bg: 'bg-brand-green/10' },
  paused: { label: 'Paused',  color: 'text-yellow-600',  bg: 'bg-yellow-50'      },
  draft:  { label: 'Draft',   color: 'text-muted-foreground', bg: 'bg-muted'     },
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  })

  const { data: summary } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: () => api.get('/analytics/summary').then((r) => r.data),
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your Meta AI agents
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Bot className="h-5 w-5 text-primary" />}
          label="Active Agents"
          value={summary?.activeAgents ?? '—'}
          bg="bg-primary/5"
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5 text-brand-pink" />}
          label="Total Conversations"
          value={summary?.totalConversations?.toLocaleString() ?? '—'}
          bg="bg-accent/5"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-brand-green" />}
          label="Messages Today"
          value={summary?.messagesToday?.toLocaleString() ?? '—'}
          bg="bg-brand-green/5"
        />
      </div>

      {/* Agent list */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Your Agents</h2>

        {agentsLoading ? (
          <AgentSkeleton />
        ) : agents.length === 0 ? (
          <EmptyState onCreateClick={() => navigate('/agents/new')} />
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => navigate(`/agents/${agent.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, bg,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  bg: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const cfg = STATUS_CONFIG[agent.status]
  const lastActive = agent.lastActiveAt
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        Math.round((new Date(agent.lastActiveAt).getTime() - Date.now()) / 60000),
        'minute'
      )
    : 'Never active'

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border bg-card p-4
        text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Bot className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground truncate">{agent.name}</p>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
            <Circle className="h-1.5 w-1.5 fill-current" />
            {cfg.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {agent.phoneNumber ?? 'No number connected'} · {agent.conversationCount} conversations
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">{lastActive}</p>
        <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  )
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <Bot className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No agents yet</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Create your first AI agent and start handling customer conversations on WhatsApp automatically.
      </p>
      <button
        onClick={onCreateClick}
        className="mt-6 flex items-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5
          text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Create your first agent
      </button>
    </div>
  )
}

function AgentSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-xl border bg-muted/40 animate-pulse" />
      ))}
    </div>
  )
}
