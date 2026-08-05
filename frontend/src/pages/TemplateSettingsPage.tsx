import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Save, History, RefreshCw, ChevronDown, Plus, Phone } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import WabaPicker from '../components/templatestudio/WabaPicker'
import { extractErrorMessage } from '../lib/errors'

// Settings section of Template Studio (2026-08-04 nav split) — WABA + Karix
// credential configuration, always reachable (unlike the old inline blocking
// screen this replaced) so an operator can rotate a key or re-point a WABA
// without losing sight of Templates/Iris.
export default function TemplateSettingsPage() {
  const { wabas, isLoading: wabasLoading, selectedWabaId, setSelectedWabaId } = useSelectedWaba()

  if (wabasLoading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the Karix credentials Template Studio uses to create and send templates for this WABA.
        </p>
      </div>

      <WabaPicker wabas={wabas} selectedWabaId={selectedWabaId} onChange={setSelectedWabaId} />

      {selectedWabaId && (
        <>
          <ConnectedPhonesPanel wabaId={selectedWabaId} />
          <AuditLogPanel wabaId={selectedWabaId} />
        </>
      )}
    </div>
  )
}

interface AuditLogEntry {
  id: string
  method: string
  path: string
  status_code: number | null
  duration_ms: number
  request_body: string | null
  response_body: string | null
  error: string | null
  called_at: string
}

function AuditLogPanel({ wabaId }: { wabaId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const logQuery = useQuery({
    queryKey: ['template-audit-log', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/audit-log`, { params: { pathPrefix: '/api/templates' } }).then((r) => r.data.data),
  })

  const entries: AuditLogEntry[] = logQuery.data?.result ?? []

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        </div>
        <button
          type="button"
          onClick={() => logQuery.refetch()}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition"
        >
          <RefreshCw className={cn('h-3 w-3', logQuery.isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Every call this platform has made to Karix for this WABA's templates — what was sent and what came back.
      </p>

      {logQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {logQuery.isError && <p className="text-xs text-destructive">{extractErrorMessage(logQuery.error)}</p>}
      {logQuery.data && entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      )}

      <div className="divide-y">
        {entries.map((entry) => (
          <div key={entry.id} className="py-2">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className="flex w-full items-center justify-between gap-2 text-left text-sm"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  entry.status_code && entry.status_code < 400 ? 'bg-brand-green/10 text-brand-green' : 'bg-destructive/10 text-destructive',
                )}>
                  {entry.status_code ?? 'ERR'}
                </span>
                <span className="font-medium text-foreground shrink-0">{entry.method}</span>
                <span className="truncate text-muted-foreground">{entry.path}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                {new Date(entry.called_at).toLocaleString()}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expandedId === entry.id && 'rotate-180')} />
              </span>
            </button>
            {expandedId === entry.id && (
              <div className="mt-2 space-y-2 text-xs">
                {entry.error && <p className="text-destructive">Error: {entry.error}</p>}
                {entry.request_body && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Request</p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-muted-foreground">{entry.request_body}</pre>
                  </div>
                )}
                {entry.response_body && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Response</p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-muted-foreground">{entry.response_body}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface MappingView {
  phoneNumberId: string
  displayPhoneNumber: string | null
  esmeAddr: string | null
  esmeLabel: string | null
}

interface EsmeOption {
  id: string
  esmeAddr: string
  label: string
}

// Connected phone numbers + their Karix esme_addr credential, corrected
// 2026-08-04 from a wrong one-credential-per-WABA model — credentials
// belong to an esme_addr (one api_key each), and phone numbers map
// many-to-one onto it. The same esme_addr can also serve phone numbers
// under a DIFFERENT WABA, so "esme options" is account-wide, not WABA-scoped.
function ConnectedPhonesPanel({ wabaId }: { wabaId: string }) {
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState(false)

  const mappingsQuery = useQuery<MappingView[]>({
    queryKey: ['phone-mappings', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/phone-mappings`).then((r) => r.data.data),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['phone-mappings', wabaId] })
    queryClient.invalidateQueries({ queryKey: ['unmapped-phones', wabaId] })
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Connected phone numbers</h3>
        </div>
        <button
          type="button"
          onClick={() => setConnecting((c) => !c)}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Connect a phone number
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Each phone number under this WABA needs a Karix esme_addr + API key to send templates. The same esme_addr
        can be reused across multiple phone numbers.
      </p>

      {mappingsQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {mappingsQuery.isError && <p className="text-xs text-destructive">{extractErrorMessage(mappingsQuery.error)}</p>}
      {mappingsQuery.data && mappingsQuery.data.length === 0 && !connecting && (
        <p className="text-xs text-muted-foreground">No phone numbers connected yet.</p>
      )}

      <div className="divide-y">
        {mappingsQuery.data?.map((m) => (
          <div key={m.phoneNumberId} className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">{m.displayPhoneNumber || m.phoneNumberId}</span>
            </div>
            <span className="text-xs text-muted-foreground">{m.esmeLabel} ({m.esmeAddr})</span>
          </div>
        ))}
      </div>

      {connecting && (
        <ConnectPhoneForm
          wabaId={wabaId}
          onDone={() => { setConnecting(false); invalidate() }}
          onCancel={() => setConnecting(false)}
        />
      )}
    </div>
  )
}

function ConnectPhoneForm({ wabaId, onDone, onCancel }: { wabaId: string; onDone: () => void; onCancel: () => void }) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [esmeCredentialId, setEsmeCredentialId] = useState('')
  const [esmeAddr, setEsmeAddr] = useState('')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const unmappedQuery = useQuery<string[]>({
    queryKey: ['unmapped-phones', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/unmapped-phones`).then((r) => r.data.data),
  })
  const esmeOptionsQuery = useQuery<EsmeOption[]>({
    queryKey: ['esme-options'],
    queryFn: () => api.get('/templates/esme-options').then((r) => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: () => mode === 'existing'
      ? api.post(`/templates/${wabaId}/phone-mappings/existing-esme`, { phoneNumberId, esmeCredentialId })
      : api.post(`/templates/${wabaId}/phone-mappings/new-esme`, { phoneNumberId, esmeAddr, label, apiKey }),
    onSuccess: onDone,
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const hasExistingOptions = (esmeOptionsQuery.data?.length ?? 0) > 0

  useEffect(() => {
    if (esmeOptionsQuery.data && !hasExistingOptions) setMode('new')
  }, [esmeOptionsQuery.data, hasExistingOptions])
  const canSubmit = !!phoneNumberId
    && (mode === 'existing' ? !!esmeCredentialId : (esmeAddr.trim() && label.trim() && apiKey.trim()))

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Phone number</label>
        <select
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select a phone number…</option>
          {unmappedQuery.data?.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        {unmappedQuery.data && unmappedQuery.data.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">Every synced phone number on this WABA is already connected.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('existing')}
          disabled={!hasExistingOptions}
          className={cn('flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed',
            mode === 'existing' ? 'border-brand-pink bg-brand-pink/10 text-brand-pink' : 'text-muted-foreground hover:bg-muted')}
        >
          Use an existing esme_addr
        </button>
        <button
          type="button"
          onClick={() => setMode('new')}
          className={cn('flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
            mode === 'new' ? 'border-brand-pink bg-brand-pink/10 text-brand-pink' : 'text-muted-foreground hover:bg-muted')}
        >
          Add a new esme_addr
        </button>
      </div>

      {mode === 'existing' ? (
        <select
          value={esmeCredentialId}
          onChange={(e) => setEsmeCredentialId(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select an esme_addr…</option>
          {esmeOptionsQuery.data?.map((o) => (
            <option key={o.id} value={o.id}>{o.label} ({o.esmeAddr})</option>
          ))}
        </select>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (Karix internal username)"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="text"
            value={esmeAddr}
            onChange={(e) => setEsmeAddr(e.target.value)}
            placeholder="esme_addr"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="api_key"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => { setError(null); mutation.mutate() }}
          className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Connect
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition">
          Cancel
        </button>
      </div>
    </div>
  )
}
