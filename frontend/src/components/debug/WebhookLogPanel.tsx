import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import StatusIndicator from '../shared/StatusIndicator'
import ErrorBanner from '../shared/ErrorBanner'
import CopyButton from '../shared/CopyButton'
import { formatDateTimeIST, istInputToUtcNaiveIso } from '../../lib/dateFormat'

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
}

const WEBHOOK_STATUS_TONE: Record<WebhookRawEntry['status'], 'positive' | 'negative' | 'neutral'> = {
  PROCESSED: 'positive',
  FAILED: 'negative',
  PENDING: 'neutral',
  PROCESSING: 'neutral',
}

const WEBHOOK_STATUS_FILTERS = ['ALL', 'PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'] as const

export default function WebhookLogPanel() {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [status, setStatus] = useState<typeof WEBHOOK_STATUS_FILTERS[number]>('ALL')
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')

  const { data: webhooks = [], isLoading, isError, error, refetch } = useQuery<WebhookRawEntry[]>({
    queryKey: ['webhooks-raw', phoneNumberId, agentId, status, fromTime, toTime],
    queryFn: () =>
      api
        .get('/webhooks/raw', {
          params: {
            phoneNumberId: phoneNumberId.trim() || undefined,
            agentId: agentId.trim() || undefined,
            status: status === 'ALL' ? undefined : status,
            from: istInputToUtcNaiveIso(fromTime),
            to: istInputToUtcNaiveIso(toTime),
          },
        })
        .then((r) => r.data.data),
    refetchInterval: 15_000,
  })

  const hasActiveFilter = Boolean(phoneNumberId.trim() || agentId.trim()) || status !== 'ALL' || fromTime || toTime

  return (
    <div className="flex-1 overflow-y-auto bg-muted/20 p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Every webhook received for this WABA — including ones Meta sent for an unrecognized number, or
        that failed signature verification. Raw payload, signature, and processing status.
      </p>

      <div className="mb-3 rounded-xl border bg-card p-3 shadow-surface-resting">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone number ID</label>
            <input
              type="text"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 1046051241927239"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Agent ID</label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="e.g. 875651765431701504"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof WEBHOOK_STATUS_FILTERS[number])}
              className="rounded-lg border bg-background px-3 py-2 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
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
              className="rounded-lg border bg-background px-3 py-2 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">To (IST)</label>
            <input
              type="datetime-local"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>
          {hasActiveFilter && (
            <button
              onClick={() => { setPhoneNumberId(''); setAgentId(''); setStatus('ALL'); setFromTime(''); setToTime('') }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : isError ? (
        <ErrorBanner error={error} onRetry={() => refetch()} />
      ) : webhooks.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {hasActiveFilter ? 'No webhooks match these filters.' : 'No webhooks logged yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {webhooks.map((w) => (
            <div key={w.id} className="rounded-lg border bg-card p-3 shadow-surface-resting">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusIndicator label={w.status} tone={WEBHOOK_STATUS_TONE[w.status]} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTimeIST(w.receivedAt)}
                  </span>
                  {w.phoneNumberId && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                      phone: {w.phoneNumberId}
                    </span>
                  )}
                  {w.agentId ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                      agent: {w.agentId}
                    </span>
                  ) : (
                    <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
                      Unattributed
                    </span>
                  )}
                </div>
                <CopyButton value={w.payload} label="Copy payload" />
              </div>
              {w.errorMessage && (
                <p className="mt-1.5 text-xs text-destructive">{w.errorMessage}</p>
              )}
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs text-foreground">
                {w.payload}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
