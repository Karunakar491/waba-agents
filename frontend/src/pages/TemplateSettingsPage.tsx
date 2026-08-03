import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Save, History, RefreshCw, ChevronDown } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import WabaPicker from '../components/templatestudio/WabaPicker'

interface CredentialStatus {
  configured: boolean
  esmeAddr: string | null
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } } }
  return e.response?.data?.error ?? 'Something went wrong. Please try again.'
}

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
          <WabaCredentialSettings wabaId={selectedWabaId} />
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
      {logQuery.isError && <p className="text-xs text-destructive">{extractMessage(logQuery.error)}</p>}
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

function WabaCredentialSettings({ wabaId }: { wabaId: string }) {
  const queryClient = useQueryClient()
  const credentialQuery = useQuery<CredentialStatus>({
    queryKey: ['karix-credential', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/karix-credential`).then((r) => r.data.data),
  })

  if (credentialQuery.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  return (
    <div className="space-y-4">
      {credentialQuery.data?.configured && (
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          Karix credential configured ({credentialQuery.data.esmeAddr})
        </div>
      )}
      <CredentialForm
        wabaId={wabaId}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['karix-credential', wabaId] })}
      />
    </div>
  )
}

function CredentialForm({ wabaId, onSaved }: { wabaId: string; onSaved: () => void }) {
  const [esmeAddr, setEsmeAddr] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.put(`/templates/${wabaId}/karix-credential`, { esmeAddr, apiKey }),
    onSuccess: () => { setEsmeAddr(''); setApiKey(''); onSaved() },
    onError: (err) => setError(extractMessage(err)),
  })

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Karix credentials</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Contact Karix to get the esme_addr and API key issued for this WABA. Saving replaces any existing
        credential for this WABA.
      </p>
      <div className="space-y-2">
        <input
          type="text"
          value={esmeAddr}
          onChange={(e) => setEsmeAddr(e.target.value)}
          placeholder="esme_addr"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        />
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="api_key"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="button"
        disabled={!esmeAddr.trim() || !apiKey.trim() || mutation.isPending}
        onClick={() => { setError(null); mutation.mutate() }}
        className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save credentials
      </button>
    </div>
  )
}
