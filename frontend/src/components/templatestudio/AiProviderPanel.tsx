import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import SegmentedControl from '../shared/SegmentedControl'

// Iris BYOK LLM key management. Extracted from TemplateSettingsPage.tsx
// (V2 rebrand slice 6, Figma node 86:2) — provider switcher rebuilt as a
// real SegmentedControl (was a hand-rolled role="tablist"), matching
// DESIGN.md §6's own named example for this exact pattern.

interface CredentialStatus {
  configured: boolean
  provider: string
  model: string
}

type ProviderTab = 'CLAUDE' | 'NVIDIA_LLAMA' | 'OPENAI'

const PROVIDER_OPTIONS: Array<{ value: ProviderTab; label: string }> = [
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'CLAUDE', label: 'Claude' },
  { value: 'NVIDIA_LLAMA', label: 'NVIDIA' },
]

export default function AiProviderPanel() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<ProviderTab>('CLAUDE')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [replacing, setReplacing] = useState(false)

  const credentialQuery = useQuery<CredentialStatus>({
    queryKey: ['iris-credential'],
    queryFn: () => api.get('/iris/credential').then((r) => r.data.data),
  })

  const optionsQuery = useQuery({
    queryKey: ['iris-credential-options'],
    queryFn: () => api.get('/iris/credential/options').then((r) => r.data.data),
  })
  const providers: Record<string, string[]> = optionsQuery.data?.providers ?? {}

  useEffect(() => {
    const models = providers[tab] ?? []
    if (models.length > 0 && !models.includes(model)) setModel(models[0])
  }, [tab, providers, model])

  const mutation = useMutation({
    mutationFn: () => api.put('/iris/credential', { provider: tab, model, apiKey }),
    onSuccess: () => {
      setApiKey('')
      setError(null)
      setSaved(true)
      setReplacing(false)
      queryClient.invalidateQueries({ queryKey: ['iris-credential'] })
    },
    onError: (err) => { setError(extractErrorMessage(err)); setSaved(false) },
  })

  const canSave = !!model && !!apiKey.trim() && !mutation.isPending
  const providerLabel = tab === 'CLAUDE' ? 'Claude' : tab === 'OPENAI' ? 'OpenAI' : 'NVIDIA'
  // Only THIS tab's key is masked — configured/provider is account-wide
  // (one active provider at a time), so switching tabs means setting up a
  // different provider, not replacing the currently configured one.
  const isConfiguredForTab = !!credentialQuery.data?.configured && credentialQuery.data.provider === tab
  const showMasked = isConfiguredForTab && !replacing

  return (
    <section className="w-full space-y-4 rounded-2xl border bg-card p-5 shadow-surface-resting">
      <div>
        <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">LLM API KEY · IRIS</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring your own API key. Template drafts are sent to that provider under their terms.
        </p>
      </div>

      {credentialQuery.data?.configured && (
        <p className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground">
          Using <span className="font-medium">{credentialQuery.data.provider}</span> / {credentialQuery.data.model}
        </p>
      )}

      <SegmentedControl
        label="AI provider"
        options={PROVIDER_OPTIONS}
        value={tab}
        onChange={(next) => { setTab(next); setSaved(false); setError(null); setReplacing(false) }}
      />

      {(providers[tab]?.length ?? 0) > 1 && (
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full max-w-[320px] rounded-lg border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
        >
          {(providers[tab] ?? []).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">{providerLabel} API key</label>
        {showMasked ? (
          <div className="flex max-w-[320px] items-center gap-2">
            <span
              className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground"
              title="The key is stored encrypted and never shown again"
            >
              ••••••••••••••••
            </span>
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="shrink-0 rounded-lg border px-3 py-2 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              Replace
            </button>
          </div>
        ) : (
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
            placeholder="Paste API key"
            className="w-full max-w-[320px] rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
          />
        )}
      </div>

      {error && <ErrorBanner error={error} />}
      {saved && !error && (
        <p className="text-sm text-accent-teal-solid">
          {providerLabel} key saved — Iris will use it from now on.
        </p>
      )}

      {!showMasked && (
        <button
          type="button"
          disabled={!canSave}
          onClick={() => { setError(null); mutation.mutate() }}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white shadow-surface-resting transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save key
        </button>
      )}
    </section>
  )
}
