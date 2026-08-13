import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, ClipboardList, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '../lib/utils'
import api from '../lib/api'
import { useJobPoll } from '../hooks/useJobPoll'
import ErrorBanner from '../components/shared/ErrorBanner'
import StatusIndicator from '../components/shared/StatusIndicator'

// API Calls moved to Debug > APIs (2026-08-13, "move API calls and webhooks
// to a new Debug section... remove API entirely from reports") — this page
// is business-metric reporting only now (Conversations, Eval), not raw
// technical logs.
type ReportTab = 'conversations' | 'eval'

const TABS: { key: ReportTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'conversations', label: 'Conversations', icon: MessageSquare },
  { key: 'eval',          label: 'Eval',          icon: ClipboardList },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('conversations')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account-wide conversation volume and eval quality.
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
        <div className="rounded-xl border bg-card p-5 shadow-surface-resting">
          <p className="text-sm text-muted-foreground">Total conversations</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{data?.totalConversations ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-surface-resting">
          <p className="text-sm text-muted-foreground">Success rate</p>
          <p className="mt-1 text-3xl font-bold text-brand-green">
            {data ? Math.round(data.successRate * 100) : 0}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Closed without a human handoff</p>
        </div>
      </div>

      {data && Object.keys(data.byChannel).length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-surface-resting">
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

  // Auto-load the last completed rollup on mount (2026-08-05) — the one view
  // that answers "which agents need me" previously required a manual click
  // on every single visit, showing nothing until the operator triggered a
  // fresh run.
  const latestQuery = useQuery({
    queryKey: ['eval-rollup-latest'],
    queryFn: () => api.get('/reports/eval-rollup/latest').then((r) => r.data.data as RollupPollResponse | null),
  })
  useEffect(() => {
    if (latestQuery.data && !rollup) setRollup(latestQuery.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestQuery.data])

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

  // Worst-first (2026-08-05) — the whole point of this view is spotting
  // underperformers; a flat API-order list buried the one that matters at
  // the bottom just as easily as the top. Failures surface before any score.
  const sortedResults = useMemo(() => {
    if (!rollup) return []
    return [...rollup.results].sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? 1 : -1
      return (a.avgConversationScore ?? 0) - (b.avgConversationScore ?? 0)
    })
  }, [rollup])

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
          className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-semibold
            text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {poll.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}
          Run rollup
        </button>
      </div>

      {runError && (
        <div className="mt-3">
          <ErrorBanner error={runError} />
        </div>
      )}

      {poll.status === 'unknown' && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This rollup is taking unusually long — it may have stalled. Showing the last known results below.
          </p>
        </div>
      )}

      {rollup && (
        <>
          <div className="rounded-xl border bg-muted/30 p-5 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground shrink-0" />
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

          <div className="rounded-xl border bg-card shadow-surface-resting">
            <ul className="divide-y">
              {sortedResults.map((r) => (
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
                  <span className="shrink-0">
                    <StatusIndicator
                      label={r.ok ? (r.avgConversationScore != null ? `${r.avgConversationScore.toFixed(1)}/5` : 'OK') : 'Failed'}
                      tone={r.ok ? 'positive' : 'negative'}
                    />
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

