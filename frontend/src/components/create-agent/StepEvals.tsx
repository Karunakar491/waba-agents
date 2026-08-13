import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2, Play } from 'lucide-react'
import api from '../../lib/api'
import { useJobPoll } from '../../hooks/useJobPoll'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import { BottomBar, SectionCard, StepHeader } from './WizardChrome'

interface EvalCase {
  id: string
  scenario: string
  categories?: string[]
}

interface EvalResult {
  avg_conversation_score?: number
  avg_turn_score?: number
  scenarios_passed?: number
  scenarios_total?: number
  summary?: string
  top_failure_category?: string
  case_results?: { eval_case_id: string; passed: boolean }[]
}

/**
 * Screen: Create Agent — Step 6, Evals (Figma node 218:253)
 *
 * 1. USER GOAL: Find out whether the agent actually behaves, before it's
 *    allowed near a real customer.
 * 2. EMOTIONAL STATE: Wants reassurance, but a fake pass would be worse
 *    than no score — so only figures Meta actually returned are shown.
 * 3. POSSIBLE ACTIONS: Run every scenario, read the summary, go back and
 *    fix the weak spot, or continue anyway (nothing is live yet).
 * 4. HOW WE HELP: The weakest category is named alongside the thing to
 *    check, not left as a number to interpret.
 */
export default function StepEvals({
  agentId,
  onBack,
  onNext,
}: {
  agentId: string | null
  onBack: () => void
  onNext: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EvalResult | null>(null)

  const { data: cases = [], isLoading } = useQuery<EvalCase[]>({
    queryKey: ['eval-cases', agentId],
    queryFn: () =>
      api.get(`/reports/agents/${agentId}/eval/cases`).then((r) => r.data.data?.eval_cases ?? []),
    enabled: !!agentId,
  })

  const poll = useJobPoll({
    fetchStatus: async (jobId) => {
      const r = await api.get(`/reports/agents/${agentId}/eval/run`, { params: { jobId } })
      const data = r.data.data
      if (data?.status === 'COMPLETED' && data?.result) setResult(data.result as EvalResult)
      return (data?.status as string) ?? 'unknown'
    },
    pendingValues: ['QUEUED', 'RUNNING'],
    successValues: ['COMPLETED'],
  })

  const running = poll.status === 'pending'

  async function runAll() {
    if (cases.length === 0) return
    setError(null)
    setResult(null)
    try {
      const evalCaseIds = cases.map((c) => c.id).join(',')
      const res = await api.post(`/reports/agents/${agentId}/eval/run`, {}, { params: { evalCaseIds } })
      const jobId = res.data.data?.job_id as string | undefined
      if (!jobId) {
        setError('Meta accepted the run but returned no job id to track its status.')
        return
      }
      poll.start(jobId)
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  const passedById = new Map(
    (result?.case_results ?? []).map((c) => [c.eval_case_id, c.passed] as const),
  )

  const stats: { value: string; label: string }[] = []
  if (typeof result?.avg_conversation_score === 'number')
    stats.push({ value: `${result.avg_conversation_score.toFixed(1)} / 5`, label: 'Avg. conversation score' })
  if (typeof result?.avg_turn_score === 'number')
    stats.push({ value: `${result.avg_turn_score.toFixed(1)} / 5`, label: 'Avg. turn score' })
  if (typeof result?.scenarios_passed === 'number')
    stats.push({
      value: `${result.scenarios_passed} / ${result.scenarios_total ?? cases.length}`,
      label: 'Scenarios passed',
    })

  return (
    <>
      <StepHeader
        title="How well does it actually perform?"
        subtitle="Run a real test suite — not just a quick message, a proper score across scripted scenarios."
      />

      {error && (
        <div className="mb-6">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="space-y-6">
        <SectionCard
          title="Test scenarios"
          actions={
            <button
              type="button"
              onClick={() => void runAll()}
              disabled={cases.length === 0 || running}
              className="flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium text-accent-teal-solid transition-colors hover:bg-accent-teal/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
            >
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {running ? 'Running…' : `Run all ${cases.length}`}
            </button>
          }
        >
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <p className="border-l-2 border-accent-teal-solid pl-4 text-sm text-muted-foreground">
              No scenarios are configured for this number on Meta's side yet. You can continue —
              this step is here to catch problems, not to block you.
            </p>
          ) : (
            <ul className="divide-y">
              {cases.map((c) => {
                const passed = passedById.get(c.id)
                return (
                  <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={
                          passed === undefined
                            ? 'mt-2 h-2 w-2 shrink-0 rounded-full bg-muted-foreground'
                            : passed
                              ? 'mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-teal-solid'
                              : 'mt-2 h-2 w-2 shrink-0 rounded-full bg-warning'
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{c.scenario}</p>
                        {c.categories && c.categories.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.categories.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    {passed !== undefined && (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {passed ? 'Passed' : 'Needs work'}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        {result && (
          <SectionCard title="Results">
            {stats.length > 0 && (
              <div className="flex flex-wrap gap-8">
                {stats.map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            {result.summary && <p className="text-sm text-foreground">{result.summary}</p>}
            {result.top_failure_category && (
              <p className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
                <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-warning" />
                Top failure category: {result.top_failure_category} — worth checking before you
                deploy.
              </p>
            )}
          </SectionCard>
        )}
      </div>

      <BottomBar onBack={onBack} onNext={onNext} />
    </>
  )
}
