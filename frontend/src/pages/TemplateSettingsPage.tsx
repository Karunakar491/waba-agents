import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Save } from 'lucide-react'
import api from '../lib/api'
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
          Configure the Karix credentials Template Studio uses to create templates and (soon) launch campaigns for
          this WABA.
        </p>
      </div>

      <WabaPicker wabas={wabas} selectedWabaId={selectedWabaId} onChange={setSelectedWabaId} />

      {selectedWabaId && <WabaCredentialSettings wabaId={selectedWabaId} />}
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
