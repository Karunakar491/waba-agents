import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, UserCheck, X } from 'lucide-react'
import api from '../../lib/api'
import { cn } from '../../lib/utils'
import StatusIndicator from '../shared/StatusIndicator'
import ErrorBanner from '../shared/ErrorBanner'
import WebhookDetailModal from './WebhookDetailModal'
import { formatTimeIST, istInputToUtcNaiveIso } from '../../lib/dateFormat'
import { summarizeWebhookPayload, type WebhookSummary } from '../../lib/webhookSummary'

interface AgentOption {
  id: string
  name: string
  phoneNumberId: string | null
  displayPhoneNumber: string | null
}

const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm ' +
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

// Shared between Inbox (in-context triage of one conversation's thread) and
// Debug > Webhooks (2026-08-13, item: "let webhooks be at both places") —
// one component, not copy-pasted code, so a future fix only has one place to
// land.

export interface WebhookRawEntry {
  id: string
  agentId: string | null
  phoneNumberId: string | null
  payload: string
  signature: string
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED'
  errorMessage: string | null
  receivedAt: string
  processedAt: string | null
  /**
   * Derived server-side from the payload's standby wrapper, not stored.
   * NEEDS_HUMAN is the moment Meta's AI stopped handling the conversation and
   * handed it to us — the signal the separate live-chat tool has to act on, so
   * it is called out rather than left to be spotted in a wall of rows
   * (founder ask, 2026-09-03). Optional so an older backend still renders.
   */
  handoffSignal?: 'BIZAI_ACTIVE' | 'NEEDS_HUMAN' | 'STATUS_UPDATE' | 'UNRECOGNIZED'
}

const WEBHOOK_STATUS_TONE: Record<WebhookRawEntry['status'], 'positive' | 'negative' | 'neutral'> = {
  PROCESSED: 'positive',
  FAILED: 'negative',
  PENDING: 'neutral',
  PROCESSING: 'neutral',
}

const WEBHOOK_STATUS_FILTERS = ['ALL', 'PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'] as const

const KIND_LABEL: Record<WebhookSummary['kind'], string> = {
  message: 'Message',
  status: 'Status',
  echo: 'Reply',
  unrecognized: 'Unrecognized',
}

const KIND_TONE: Record<WebhookSummary['kind'], 'positive' | 'negative' | 'neutral'> = {
  message: 'positive',
  status: 'neutral',
  echo: 'positive',
  unrecognized: 'negative',
}

function TableSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-4 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="w-[70px]">Received</span>
        <span className="w-[90px]">Type</span>
        <span className="w-[110px]">Customer</span>
        <span className="w-[150px]">Business # / Agent</span>
        <span className="flex-1">Summary</span>
        <span className="w-[90px]">Processing</span>
        <span className="w-[50px] text-right">View</span>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b py-3">
          <div className="h-3.5 w-[60px] animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-[70px] animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-[100px] animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-[130px] animate-pulse rounded bg-muted" />
          <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-[70px] animate-pulse rounded bg-muted" />
          <div className="ml-auto h-3.5 w-[40px] animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export default function WebhookLogPanel({
  focusWebhookId, onFocusHandled,
}: {
  // Deep link from the Inbox thread's "jump to webhook" icon — the target row
  // may fall outside whatever filters are currently applied here, so it's
  // fetched independently by id rather than relying on the filtered list.
  focusWebhookId?: string | null
  onFocusHandled?: () => void
} = {}) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [status, setStatus] = useState<typeof WEBHOOK_STATUS_FILTERS[number]>('ALL')
  const [handoffOnly, setHandoffOnly] = useState(false)
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookRawEntry | null>(null)

  const { data: focusedWebhooks } = useQuery<WebhookRawEntry[]>({
    queryKey: ['webhooks-raw-by-id', focusWebhookId],
    queryFn: () => api.get('/webhooks/raw', { params: { id: focusWebhookId } }).then((r) => r.data.data),
    enabled: !!focusWebhookId,
  })

  useEffect(() => {
    if (!focusWebhookId || !focusedWebhooks) return
    if (focusedWebhooks.length > 0) {
      setSelectedWebhook(focusedWebhooks[0])
    }
    onFocusHandled?.()
  }, [focusWebhookId, focusedWebhooks, onFocusHandled])

  const { data: agentOptions = [] } = useQuery<AgentOption[]>({
    queryKey: ['agents-for-webhook-filter'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
    staleTime: 60_000,
  })

  const { data: webhooks = [], isLoading, isError, error, refetch } = useQuery<WebhookRawEntry[]>({
    queryKey: ['webhooks-raw', phoneNumberId, agentId, status, handoffOnly, fromTime, toTime],
    queryFn: () =>
      api
        .get('/webhooks/raw', {
          params: {
            phoneNumberId: phoneNumberId.trim() || undefined,
            agentId: agentId.trim() || undefined,
            status: status === 'ALL' ? undefined : status,
            handoffSignal: handoffOnly ? 'NEEDS_HUMAN' : undefined,
            from: istInputToUtcNaiveIso(fromTime),
            to: istInputToUtcNaiveIso(toTime),
          },
        })
        .then((r) => r.data.data),
    refetchInterval: 15_000,
  })

  const advancedFilterCount = [agentId.trim() !== '', status !== 'ALL', Boolean(fromTime), Boolean(toTime)]
    .filter(Boolean).length
  // handoffOnly lives outside advancedFilterCount because it has its own
  // visible button, but it still counts as "filtered" so Clear all clears it.
  const hasActiveFilter = Boolean(phoneNumberId.trim()) || advancedFilterCount > 0 || handoffOnly

  const clearAll = () => {
    setPhoneNumberId(''); setAgentId(''); setStatus('ALL'); setFromTime(''); setToTime('')
    setHandoffOnly(false)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-muted/20 p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Every webhook received for this WABA — including ones Meta sent for an unrecognized number, or
        that failed signature verification. Raw payload, signature, and processing status.
      </p>

      <div className="mb-3 rounded-xl border bg-card p-3 shadow-surface-resting">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Search by phone number ID…"
              className={`${inputClass} pl-9`}
            />
          </div>
          {/* Top-level, not hidden behind Filters: "which chats went to a
              human" is the question this log gets asked most, now that a
              separate tool handles live chat. */}
          <button
            onClick={() => setHandoffOnly((v) => !v)}
            aria-pressed={handoffOnly}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
              handoffOnly
                ? 'border-warning bg-warning/10 text-warning'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            <UserCheck className="h-4 w-4" />
            Handoffs only
          </button>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition
              ${filtersOpen || advancedFilterCount > 0
                ? 'border-primary bg-primary/5 text-primary'
                : 'bg-background text-muted-foreground hover:text-foreground'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {advancedFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-xs leading-none text-primary-foreground">
                {advancedFilterCount}
              </span>
            )}
          </button>
          {hasActiveFilter && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className={inputClass}
              >
                <option value="">All agents</option>
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.displayPhoneNumber ?? a.phoneNumberId ?? '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof WEBHOOK_STATUS_FILTERS[number])}
                className={inputClass}
              >
                {WEBHOOK_STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">From (IST)</label>
              <input
                type="datetime-local"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To (IST)</label>
              <input
                type="datetime-local"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-3 shadow-surface-resting">
          <TableSkeleton />
        </div>
      ) : isError ? (
        <ErrorBanner error={error} onRetry={() => refetch()} />
      ) : webhooks.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {hasActiveFilter ? 'No webhooks match these filters.' : 'No webhooks logged yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-surface-resting">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Received</th>
                <th className="p-3">Type</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Business # / Agent</th>
                <th className="p-3">Summary</th>
                <th className="p-3">Processing</th>
                <th className="p-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {webhooks.map((w) => {
                const summary = summarizeWebhookPayload(w.payload)
                const isHandoff = w.handoffSignal === 'NEEDS_HUMAN'
                return (
                  <tr
                    key={w.id}
                    className={cn(
                      'hover:bg-muted/60',
                      // A handoff is the one row in this log somebody has to act
                      // on, so it gets a standing tint and an edge marker rather
                      // than only a badge that scrolls past unnoticed.
                      isHandoff && 'bg-warning/10 hover:bg-warning/20'
                    )}
                  >
                    <td
                      className={cn(
                        'whitespace-nowrap p-3 text-muted-foreground',
                        isHandoff && 'border-l-2 border-warning font-medium text-foreground'
                      )}
                    >
                      {formatTimeIST(w.receivedAt)}
                    </td>
                    <td className="whitespace-nowrap p-3">
                      <StatusIndicator label={KIND_LABEL[summary.kind]} tone={KIND_TONE[summary.kind]} />
                      {isHandoff && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-warning">
                          <UserCheck className="h-3 w-3 shrink-0" />
                          Handed to a human
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 font-mono text-muted-foreground">
                      {summary.customerNumber ?? '—'}
                    </td>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      <p className="font-mono">{summary.businessNumber ?? w.phoneNumberId ?? '—'}</p>
                      <p className="font-mono text-xs">
                        {w.agentId ?? <span className="text-warning">Unattributed</span>}
                      </p>
                    </td>
                    <td className="max-w-[240px] p-3">
                      <p className="truncate text-foreground" title={summary.contentPreview}>{summary.contentPreview}</p>
                      {summary.metaError && (
                        <p className="truncate text-xs text-destructive" title={summary.metaError.message}>
                          {summary.metaError.title}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3">
                      <StatusIndicator label={w.status} tone={WEBHOOK_STATUS_TONE[w.status]} />
                      {w.errorMessage && (
                        <p className="mt-0.5 max-w-[160px] truncate text-xs text-destructive" title={w.errorMessage}>
                          {w.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedWebhook(w)}
                        className="rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedWebhook && (
        <WebhookDetailModal webhook={selectedWebhook} onClose={() => setSelectedWebhook(null)} />
      )}
    </div>
  )
}
