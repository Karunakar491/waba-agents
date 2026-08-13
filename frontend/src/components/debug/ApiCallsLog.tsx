import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Code2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import StatusIndicator from '../shared/StatusIndicator'
import CopyButton from '../shared/CopyButton'
import { formatDateTimeIST, istInputToUtcNaiveIso } from '../../lib/dateFormat'

// Moved from Reports > API Calls into Debug > APIs (2026-08-13, "move API
// calls and webhooks to a new Debug section") — Reports stays for
// business-metric reporting (Conversations, Eval); this is a raw technical
// log for engineers/support, a different audience entirely.

interface ApiCallLogRow {
  id: string
  method: string
  path: string
  phoneNumberId: string | null
  agentId: string | null
  statusCode: number | null
  durationMs: number | null
  requestBody: string | null
  responseBody: string | null
  errorMessage: string | null
  calledAt: string
}

// Curated presets over the real path segments this platform actually calls
// (grep-verified against AgentDeployService/AgentService/WabaService) — a
// free-text box alone forces the operator to already know Meta's raw path
// shape (e.g. "agent_connectors", not "connectors"); these are the same
// words used in this app's own nav/tabs.
const PATH_PRESETS: { label: string; value: string }[] = [
  { label: 'All',        value: '' },
  { label: 'Connectors', value: 'agent_connectors' },
  { label: 'Skills',     value: 'skills' },
  { label: 'Files',      value: 'files' },
  { label: 'Websites',   value: 'websites' },
  { label: 'FAQ',        value: 'faq' },
  { label: 'Settings',   value: 'agent_config/settings' },
  { label: 'Allowlist',  value: 'allowlist' },
  { label: 'Events',     value: 'events' },
  { label: 'Eval',       value: 'agent-eval' },
  { label: 'Persona',    value: 'business_profile' },
]
const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE']
const OUTCOMES: { label: string; value: 'ALL' | 'SUCCESS' | 'ERROR' }[] = [
  { label: 'All',         value: 'ALL' },
  { label: 'Success only', value: 'SUCCESS' },
  { label: 'Errors only',  value: 'ERROR' },
]

export default function ApiCallsLog() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pathPreset, setPathPreset] = useState('')
  const [pathSearch, setPathSearch] = useState('')
  const [method, setMethod] = useState('ALL')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [outcome, setOutcome] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL')
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')

  // A preset chip and free-text search both narrow by path substring — same
  // param, two ways to fill it in. Free text wins if the operator typed
  // something after picking a chip.
  const effectivePathContains = pathSearch.trim() || pathPreset

  const { data: calls = [], isLoading } = useQuery<ApiCallLogRow[]>({
    queryKey: ['reports-api-calls', effectivePathContains, method, phoneNumberId, agentId, outcome, fromTime, toTime],
    queryFn: () =>
      api
        .get('/reports/api-calls', {
          params: {
            pathContains: effectivePathContains || undefined,
            method: method === 'ALL' ? undefined : method,
            phoneNumberId: phoneNumberId.trim() || undefined,
            agentId: agentId.trim() || undefined,
            outcome,
            // datetime-local gives a bare "YYYY-MM-DDTHH:mm" with no timezone
            // at all — interpreted as IST (the field's label) and converted
            // to the naive-UTC shape calledAt is actually stored in, not
            // sent as-is (see istInputToUtcNaiveIso for why that would be
            // off by 5:30).
            from: istInputToUtcNaiveIso(fromTime),
            to: istInputToUtcNaiveIso(toTime),
          },
        })
        .then((r) => r.data.data ?? []),
    refetchInterval: 10_000,
  })

  const hasActiveFilter = Boolean(effectivePathContains) || method !== 'ALL' || Boolean(phoneNumberId.trim() || agentId.trim()) || outcome !== 'ALL' || fromTime || toTime

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4 shadow-surface-resting space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PATH_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setPathPreset(p.value); setPathSearch('') }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                pathPreset === p.value && !pathSearch
                  ? 'bg-accent-teal-solid text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Path contains</label>
            <input
              type="text"
              value={pathSearch}
              onChange={(e) => setPathSearch(e.target.value)}
              placeholder="e.g. agent_connectors"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            >
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
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
          <div className="min-w-[130px]">
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
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as 'ALL' | 'SUCCESS' | 'ERROR')}
              className="rounded-lg border bg-background px-3 py-2 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            >
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              onClick={() => { setPathPreset(''); setPathSearch(''); setMethod('ALL'); setPhoneNumberId(''); setAgentId(''); setOutcome('ALL'); setFromTime(''); setToTime('') }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-16 text-center shadow-surface-resting">
          <Code2 className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-semibold text-foreground">
            {hasActiveFilter ? 'No API calls match these filters' : 'No API calls logged yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {hasActiveFilter
              ? 'Try widening the path, method, outcome, or date range.'
              : 'Every request this platform makes to Meta will show up here for debugging.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
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
                    <StatusIndicator label={ok ? 'OK' : 'Error'} tone={ok ? 'positive' : 'negative'} />
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide bg-muted text-muted-foreground">
                      {call.method}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{call.path}</span>
                    {call.agentId && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        agent: {call.agentId}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">{call.statusCode ?? '—'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{call.durationMs ?? '—'}ms</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTimeIST(call.calledAt)}
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
      )}
    </div>
  )
}

// Founder-caught gap (2026-08-07): request/response boxes had no copy
// button and relied on awkward horizontal drag-scroll to read long JSON --
// wrapping long lines (whitespace-pre-wrap break-all) plus a taller vertical
// scroller reads far better than forcing horizontal scroll for JSON.
function ApiCallDetail({ call }: { call: ApiCallLogRow }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request</p>
          {call.requestBody && <CopyButton value={call.requestBody} />}
        </div>
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-background border p-3 text-xs text-foreground">
          {call.requestBody ?? '(no body)'}
        </pre>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Response</p>
          {call.responseBody && <CopyButton value={call.responseBody} />}
        </div>
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-background border p-3 text-xs text-foreground">
          {call.responseBody ?? '(no body)'}
        </pre>
      </div>
    </div>
  )
}
