import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, Circle, ClipboardList, Code2, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '../lib/utils'
import api from '../lib/api'
import { useJobPoll } from '../hooks/useJobPoll'

type ReportTab = 'conversations' | 'eval' | 'api-calls'

const TABS: { key: ReportTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'conversations', label: 'Conversations', icon: MessageSquare },
  { key: 'eval',          label: 'Eval',          icon: ClipboardList },
  { key: 'api-calls',     label: 'API Calls',     icon: Code2 },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('conversations')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account-wide conversation volume, eval quality, and Meta API activity.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'conversations' && <ConversationsReport />}
      {activeTab === 'eval' && <EvalRollup />}
      {activeTab === 'api-calls' && <ApiCallsLog />}
    </div>
  )
}

// ── Conversations ─────────────────────────────────────────────────────────────

interface ConversationsReportResponse {
  totalConversations: number
  successRate: number
  byChannel: Record<string, number>
}

function ConversationsReport() {
  const { data, isLoading } = useQuery<ConversationsReportResponse>({
    queryKey: ['reports-conversations'],
    queryFn: () => api.get('/reports/conversations').then((r) => r.data.data),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => <div key={i} className="h-28 rounded-xl border bg-muted/40 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total conversations</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{data?.totalConversations ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Success rate</p>
          <p className="mt-1 text-3xl font-bold text-brand-green">
            {data ? Math.round(data.successRate * 100) : 0}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Closed without a human handoff</p>
        </div>
      </div>

      {data && Object.keys(data.byChannel).length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-3">By channel</p>
          <ul className="space-y-2">
            {Object.entries(data.byChannel).map(([channel, count]) => (
              <li key={channel} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{channel}</span>
                <span className="font-medium text-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Eval rollup ───────────────────────────────────────────────────────────────

interface AgentEvalResult {
  agentId: string
  agentName: string
  ok: boolean
  avgConversationScore: number | null
  summary: string | null
  error: string | null
}

interface RollupPollResponse {
  status: 'RUNNING' | 'COMPLETED'
  completed: number
  total: number
  avgConversationScore: number
  results: AgentEvalResult[]
}

function EvalRollup() {
  const navigate = useNavigate()
  const [rollup, setRollup] = useState<RollupPollResponse | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const poll = useJobPoll({
    fetchStatus: async (jobId) => {
      const r = await api.get(`/reports/eval-rollup/${jobId}`)
      const data = r.data.data as RollupPollResponse
      setRollup(data)
      return data.status
    },
    pendingValues: ['RUNNING'],
    successValues: ['COMPLETED'],
    intervalMs: 2500,
    maxAttempts: 60,
  })

  async function runRollup() {
    setRunError(null)
    setRollup(null)
    try {
      const res = await api.post('/reports/eval-rollup')
      const jobId = res.data.data?.jobId as string | undefined
      if (!jobId) {
        setRunError('Meta accepted the request but returned no job id.')
        return
      }
      poll.start(jobId)
    } catch {
      setRunError('Failed to start the eval rollup. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Runs eval across every connected agent and aggregates the results.
        </p>
        <button
          onClick={runRollup}
          disabled={poll.status === 'pending'}
          className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold
            text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {poll.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}
          Run rollup
        </button>
      </div>

      {runError && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{runError}</div>
      )}

      {rollup && (
        <>
          <div className="rounded-xl border bg-brand-navy/5 border-brand-navy/20 p-5 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-brand-navy shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {rollup.status === 'COMPLETED' ? 'Rollup complete' : `Running… ${rollup.completed}/${rollup.total} agents`}
              </p>
              {rollup.status === 'COMPLETED' && (
                <p className="text-xs text-muted-foreground">
                  Average conversation score: {rollup.avgConversationScore.toFixed(1)} / 5
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            <ul className="divide-y">
              {rollup.results.map((r) => (
                <li key={r.agentId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <button
                      onClick={() => navigate(`/agents/${r.agentId}`)}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {r.agentName}
                    </button>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.ok ? (r.summary ?? 'No summary') : r.error}
                    </p>
                  </div>
                  <span className={cn('flex items-center gap-1.5 text-xs font-medium shrink-0',
                    r.ok ? 'text-brand-green' : 'text-destructive')}>
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    {r.ok ? (r.avgConversationScore != null ? `${r.avgConversationScore.toFixed(1)}/5` : 'OK') : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

// ── API Calls log ─────────────────────────────────────────────────────────────

interface ApiCallLogRow {
  id: string
  method: string
  path: string
  statusCode: number | null
  durationMs: number | null
  requestBody: string | null
  responseBody: string | null
  errorMessage: string | null
  calledAt: string
}

function ApiCallsLog() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: calls = [], isLoading } = useQuery<ApiCallLogRow[]>({
    queryKey: ['reports-api-calls'],
    queryFn: () => api.get('/reports/api-calls').then((r) => r.data.data ?? []),
    refetchInterval: 10_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-16 text-center shadow-sm">
        <Code2 className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-semibold text-foreground">No API calls logged yet</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Every request this platform makes to Meta will show up here for debugging.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <ul className="divide-y">
        {calls.map((call) => {
          const isExpanded = expandedId === call.id
          const ok = call.statusCode != null && call.statusCode < 400
          return (
            <li key={call.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : call.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 text-brand-green shrink-0" />
                ) : (
                  <Circle className="h-2 w-2 fill-current text-destructive shrink-0" />
                )}
                <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide bg-muted text-muted-foreground">
                  {call.method}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{call.path}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{call.statusCode ?? '—'}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{call.durationMs ?? '—'}ms</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(call.calledAt).toLocaleTimeString()}
                </span>
              </button>
              {isExpanded && (
                <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
                  {call.errorMessage && (
                    <p className="text-xs text-destructive">{call.errorMessage}</p>
                  )}
                  <ApiCallDetail call={call} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ApiCallDetail({ call }: { call: ApiCallLogRow }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Request</p>
        <pre className="max-h-48 overflow-auto rounded-lg bg-background border p-2 text-xs text-foreground">
          {call.requestBody ?? '(no body)'}
        </pre>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Response</p>
        <pre className="max-h-48 overflow-auto rounded-lg bg-background border p-2 text-xs text-foreground">
          {call.responseBody ?? '(no body)'}
        </pre>
      </div>
    </div>
  )
}
