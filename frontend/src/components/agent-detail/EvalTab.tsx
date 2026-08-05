import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Circle, ClipboardList, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { useJobPoll } from '../../hooks/useJobPoll'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'

interface EvalCase {
  id: string
  scenario: string
  categories?: string[]
}

const STATUS_DOT: Record<string, string> = {
  idle: 'text-muted-foreground',
  pending: 'text-yellow-500',
  accepted: 'text-brand-green',
  failed: 'text-destructive',
  unknown: 'text-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  idle: '',
  pending: 'Running…',
  accepted: 'Complete',
  failed: 'Failed',
  unknown: 'Status unknown — check back later',
}

const PAGE_SIZE = 10

export default function EvalTab({ agentId }: { agentId: string }) {
  const [page, setPage] = useState(0)
  const [runError, setRunError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ avgConversationScore?: number; summary?: string } | null>(null)

  const { data: cases = [], isLoading } = useQuery<EvalCase[]>({
    queryKey: ['eval-cases', agentId],
    queryFn: () =>
      api.get(`/reports/agents/${agentId}/eval/cases`).then((r) => r.data.data?.eval_cases ?? []),
  })

  const poll = useJobPoll({
    fetchStatus: async (jobId) => {
      const r = await api.get(`/reports/agents/${agentId}/eval/run`, { params: { jobId } })
      const data = r.data.data
      if (data?.status === 'COMPLETED' && data?.result) {
        setSummary({
          avgConversationScore: data.result.avg_conversation_score,
          summary: data.result.summary,
        })
      }
      return (data?.status as string) ?? 'unknown'
    },
    pendingValues: ['QUEUED', 'RUNNING'],
    successValues: ['COMPLETED'],
  })

  const pageCases = cases.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(cases.length / PAGE_SIZE))

  async function runEval() {
    if (cases.length === 0) return
    setRunError(null)
    setSummary(null)
    try {
      const evalCaseIds = cases.map((c) => c.id).join(',')
      const res = await api.post(`/reports/agents/${agentId}/eval/run`, {}, { params: { evalCaseIds } })
      const newJobId = res.data.data?.job_id as string | undefined
      if (!newJobId) {
        setRunError('Meta accepted the run but returned no job id to track its status.')
        return
      }
      poll.start(newJobId)
    } catch (err) {
      setRunError(extractErrorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Evaluation cases</h3>
        <div className="flex items-center gap-3">
          {poll.status !== 'idle' && (
            <span className={cn('flex items-center gap-1.5 text-sm font-medium', STATUS_DOT[poll.status])}>
              <Circle className="h-2 w-2 fill-current" />
              {STATUS_LABEL[poll.status]}
            </span>
          )}
          <button
            onClick={runEval}
            disabled={cases.length === 0 || poll.status === 'pending'}
            className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold
              text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {poll.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}
            Run eval
          </button>
        </div>
      </div>

      {runError && (
        <div className="mt-3">
          <ErrorBanner error={runError} />
        </div>
      )}

      {summary && (
        <div className="rounded-xl border bg-brand-navy/5 border-brand-navy/20 p-5">
          <p className="text-sm text-foreground">{summary.summary}</p>
          {typeof summary.avgConversationScore === 'number' && (
            <p className="mt-1 text-xs text-muted-foreground">
              Average conversation score: {summary.avgConversationScore.toFixed(1)} / 5
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
          </div>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No eval cases configured</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Eval scenarios are configured on Meta's side for this number.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {pageCases.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <p className="text-sm text-foreground">{c.scenario}</p>
                  {c.categories && c.categories.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.categories.join(', ')}</p>
                  )}
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2.5">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
