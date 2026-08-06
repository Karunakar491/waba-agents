import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2, Save } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import { useSelectedWaba, type WabaEntry } from '../hooks/useSelectedWaba'
import { extractErrorMessage } from '../lib/errors'
import ErrorBanner from '../components/shared/ErrorBanner'
import StatusIndicator, { type StatusTone } from '../components/shared/StatusIndicator'
import ConsequenceLine from '../components/shared/ConsequenceLine'

/**
 * Template Studio Settings — full page (2026-08-06 redesign).
 * Nav (Iris / Templates / Settings) untouched. Multi-WABA blocks + phone
 * Karix mapping table + Iris BYOK tabs (Claude / NVIDIA / OpenAI, all live).
 */

// Keep labels identical to DashboardPage QUALITY_CONFIG — same Meta signal.
const QUALITY_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  GREEN: { label: 'Quality: High', tone: 'positive' },
  YELLOW: { label: 'Quality: Medium', tone: 'warning' },
  RED: { label: 'Quality: Low', tone: 'negative' },
}

function qualityIndicator(qualityRating: string | null | undefined) {
  if (!qualityRating) {
    return { label: 'Quality: Unknown', tone: 'neutral' as const }
  }
  return QUALITY_CONFIG[qualityRating] ?? { label: `Quality: ${qualityRating}`, tone: 'neutral' as const }
}

interface PhoneRow {
  phoneNumberId: string
  displayPhoneNumber: string | null
  qualityRating: string | null
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

interface DraftCred {
  apiKey: string
  esmeAddr: string
  label: string
}

export default function TemplateSettingsPage() {
  const { wabas, isLoading: wabasLoading } = useSelectedWaba()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const didAutoExpand = useRef(false)

  useEffect(() => {
    if (showAdd || didAutoExpand.current || wabas.length === 0) return
    if (!expandedId) {
      setExpandedId(wabas[0].id)
      didAutoExpand.current = true
    }
  }, [wabas, expandedId, showAdd])

  if (wabasLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect WABAs, map Karix credentials per phone, then set Iris’s AI key.
        </p>
        <div className="mt-2">
          <ConsequenceLine>
            Nothing is sent to Meta or Karix until you save a mapping.
          </ConsequenceLine>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-surface-resting space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Connected WABAs
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {wabas.length === 0
                ? 'No WhatsApp accounts connected yet'
                : `${wabas.length} WABA${wabas.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {wabas.length > 0 && !showAdd && (
            <button
              type="button"
              onClick={() => {
                setShowAdd(true)
                setExpandedId(null)
              }}
              className="rounded-xl border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              + Add WABA
            </button>
          )}
        </div>

        {wabas.length === 0 && !showAdd && (
          <div className="flex flex-col items-center rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
            <h3 className="text-base font-semibold text-foreground">No WhatsApp accounts connected yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add a WABA ID to fetch phone numbers from Meta and map Karix credentials.
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-5 rounded-xl bg-brand-pink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Add WABA
            </button>
          </div>
        )}

        {showAdd && (
          <AddWabaPanel
            onDone={(internalId) => {
              setShowAdd(false)
              setExpandedId(internalId)
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {wabas.map((waba) => (
          <WabaBlock
            key={waba.id}
            waba={waba}
            expanded={expandedId === waba.id}
            onToggle={() => setExpandedId(expandedId === waba.id ? null : waba.id)}
          />
        ))}
      </section>

      <AiProviderPanel />

      {expandedId && (
        <AdvancedAuditPanel wabaInternalId={expandedId} />
      )}
    </div>
  )
}

function WabaBlock({
  waba,
  expanded,
  onToggle,
}: {
  waba: WabaEntry
  expanded: boolean
  onToggle: () => void
}) {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, DraftCred>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [phones, setPhones] = useState<PhoneRow[] | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const mappingsQuery = useQuery<MappingView[]>({
    queryKey: ['phone-mappings', waba.id],
    queryFn: () => api.get(`/templates/${waba.id}/phone-mappings`).then((r) => r.data.data),
    enabled: expanded,
  })

  const esmeOptionsQuery = useQuery<EsmeOption[]>({
    queryKey: ['esme-options'],
    queryFn: () => api.get('/templates/esme-options').then((r) => r.data.data),
    enabled: expanded,
  })

  const fetchPhonesMutation = useMutation({
    mutationFn: () =>
      api.get(`/waba/${waba.wabaId}/phones`).then((r) => r.data.data as Array<{
        phoneNumberId: string
        displayPhoneNumber: string
        qualityRating: string | null
      }>),
    onSuccess: (data) => {
      setFetchError(null)
      setPhones(
        data.map((p) => ({
          phoneNumberId: p.phoneNumberId,
          displayPhoneNumber: p.displayPhoneNumber,
          qualityRating: p.qualityRating,
        })),
      )
      queryClient.invalidateQueries({ queryKey: ['phone-mappings', waba.id] })
      queryClient.invalidateQueries({ queryKey: ['unmapped-phones', waba.id] })
    },
    onError: (err) => setFetchError(extractErrorMessage(err)),
  })

  const mappingByPhone = useMemo(() => {
    const map = new Map<string, MappingView>()
    for (const m of mappingsQuery.data ?? []) map.set(m.phoneNumberId, m)
    return map
  }, [mappingsQuery.data])

  // Prefer live-fetched phones; fall back to mapped-only list so configured
  // phones still show before the first Fetch click.
  const rows: PhoneRow[] = useMemo(() => {
    if (phones) return phones
    return (mappingsQuery.data ?? []).map((m) => ({
      phoneNumberId: m.phoneNumberId,
      displayPhoneNumber: m.displayPhoneNumber,
      qualityRating: null,
    }))
  }, [phones, mappingsQuery.data])

  const dirtyUnmapped = rows.filter((r) => {
    if (mappingByPhone.has(r.phoneNumberId)) return false
    const d = drafts[r.phoneNumberId]
    return !!(d?.apiKey.trim() && d?.esmeAddr.trim())
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const options = esmeOptionsQuery.data ?? []
      for (const row of dirtyUnmapped) {
        const d = drafts[row.phoneNumberId]
        const existing = options.find((o) => o.esmeAddr === d.esmeAddr.trim())
        if (existing) {
          await api.post(`/templates/${waba.id}/phone-mappings/existing-esme`, {
            phoneNumberId: row.phoneNumberId,
            esmeCredentialId: existing.id,
          })
        } else {
          await api.post(`/templates/${waba.id}/phone-mappings/new-esme`, {
            phoneNumberId: row.phoneNumberId,
            esmeAddr: d.esmeAddr.trim(),
            label: d.label.trim() || d.esmeAddr.trim(),
            apiKey: d.apiKey.trim(),
          })
        }
      }
    },
    onSuccess: () => {
      setSaveError(null)
      setDrafts({})
      queryClient.invalidateQueries({ queryKey: ['phone-mappings', waba.id] })
      queryClient.invalidateQueries({ queryKey: ['esme-options'] })
    },
    onError: (err) => setSaveError(extractErrorMessage(err)),
  })

  const mappedCount = rows.filter((r) => mappingByPhone.has(r.phoneNumberId)).length
  const panelId = `waba-panel-${waba.id}`

  return (
    <div className="overflow-hidden rounded-2xl border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {waba.label || 'Untitled WABA'}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            WABA ID · {waba.wabaId}
            {expanded && phones
              ? ` · ${phones.length} phone${phones.length === 1 ? '' : 's'} · ${mappedCount} Karix mapped`
              : null}
          </p>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div id={panelId} className="space-y-3 border-t bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Fetch phone numbers from Meta before mapping Karix credentials.
            </p>
            <button
              type="button"
              onClick={() => fetchPhonesMutation.mutate()}
              disabled={fetchPhonesMutation.isPending}
              className="rounded-xl border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {fetchPhonesMutation.isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Fetching…
                </span>
              ) : (
                'Fetch phones'
              )}
            </button>
          </div>

          {fetchError && <ErrorBanner error={fetchError} />}
          {mappingsQuery.isError && <ErrorBanner error={mappingsQuery.error} />}
          {saveError && <ErrorBanner error={saveError} />}

          {mappingsQuery.isLoading && !phones && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}

          {!phones && !mappingsQuery.isLoading && rows.length === 0 && (
            <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No phones loaded yet. Click <span className="font-medium text-foreground">Fetch phones</span> to pull
              numbers from Meta.
            </p>
          )}

          {rows.length > 0 && (
            <>
              {/* md+: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2">Phone number</th>
                      <th className="px-2 py-2">Health</th>
                      <th className="px-2 py-2">Karix API Key</th>
                      <th className="px-2 py-2">Karix ESME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => (
                      <PhoneTableRow
                        key={row.phoneNumberId}
                        row={row}
                        mapping={mappingByPhone.get(row.phoneNumberId)}
                        draft={drafts[row.phoneNumberId]}
                        onDraftChange={(next) =>
                          setDrafts((prev) => ({ ...prev, [row.phoneNumberId]: next }))
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: card stack for credential fields */}
              <div className="space-y-3 md:hidden">
                {rows.map((row) => (
                  <PhoneCard
                    key={row.phoneNumberId}
                    row={row}
                    mapping={mappingByPhone.get(row.phoneNumberId)}
                    draft={drafts[row.phoneNumberId]}
                    onDraftChange={(next) =>
                      setDrafts((prev) => ({ ...prev, [row.phoneNumberId]: next }))
                    }
                  />
                ))}
              </div>

              <div className="flex flex-col items-end gap-2 border-t pt-3">
                {dirtyUnmapped.length === 0 && rows.some((r) => !mappingByPhone.has(r.phoneNumberId)) && (
                  <p className="text-xs text-muted-foreground">
                    Enter Karix credentials for at least one unmapped phone number.
                  </p>
                )}
                <button
                  type="button"
                  disabled={dirtyUnmapped.length === 0 || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save mappings
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PhoneTableRow({
  row,
  mapping,
  draft,
  onDraftChange,
}: {
  row: PhoneRow
  mapping: MappingView | undefined
  draft: DraftCred | undefined
  onDraftChange: (d: DraftCred) => void
}) {
  const q = qualityIndicator(row.qualityRating)
  const configured = !!mapping?.esmeAddr
  const value = draft ?? { apiKey: '', esmeAddr: '', label: '' }

  return (
    <tr>
      <td className="px-2 py-2.5 font-medium text-foreground">
        {row.displayPhoneNumber || row.phoneNumberId}
      </td>
      <td className="px-2 py-2.5">
        <StatusIndicator label={q.label} tone={q.tone} />
      </td>
      <td className="px-2 py-2.5">
        {configured ? (
          <span className="text-xs text-muted-foreground" title="API key is stored encrypted and never shown again">
            ••••••••••••
          </span>
        ) : (
          <input
            type="password"
            value={value.apiKey}
            onChange={(e) => onDraftChange({ ...value, apiKey: e.target.value })}
            placeholder="Paste API key"
            className="w-full min-w-[140px] rounded-xl border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground"
          />
        )}
      </td>
      <td className="px-2 py-2.5">
        {configured ? (
          <span className="text-sm text-foreground">{mapping.esmeAddr}</span>
        ) : (
          <input
            type="text"
            value={value.esmeAddr}
            onChange={(e) => onDraftChange({ ...value, esmeAddr: e.target.value, label: e.target.value })}
            placeholder="esme_addr"
            className="w-full min-w-[120px] rounded-xl border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground"
          />
        )}
      </td>
    </tr>
  )
}

function PhoneCard({
  row,
  mapping,
  draft,
  onDraftChange,
}: {
  row: PhoneRow
  mapping: MappingView | undefined
  draft: DraftCred | undefined
  onDraftChange: (d: DraftCred) => void
}) {
  const q = qualityIndicator(row.qualityRating)
  const configured = !!mapping?.esmeAddr
  const value = draft ?? { apiKey: '', esmeAddr: '', label: '' }

  return (
    <div className="space-y-3 rounded-xl border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {row.displayPhoneNumber || row.phoneNumberId}
        </p>
        <StatusIndicator label={q.label} tone={q.tone} />
      </div>
      {configured ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted-foreground">Karix API Key · ••••••••••••</p>
          <p className="text-foreground">ESME · {mapping.esmeAddr}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Karix API Key</label>
            <input
              type="password"
              value={value.apiKey}
              onChange={(e) => onDraftChange({ ...value, apiKey: e.target.value })}
              placeholder="Paste API key"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Karix ESME</label>
            <input
              type="text"
              value={value.esmeAddr}
              onChange={(e) => onDraftChange({ ...value, esmeAddr: e.target.value, label: e.target.value })}
              placeholder="esme_addr"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface ValidatePreview {
  wabaId: string
  wabaName: string
  phoneNumbers: Array<{ phoneNumberId: string; displayPhoneNumber: string }>
}

function AddWabaPanel({
  onDone,
  onCancel,
}: {
  onDone: (internalId: string) => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const [wabaIdInput, setWabaIdInput] = useState('')
  const [preview, setPreview] = useState<ValidatePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateMutation = useMutation({
    mutationFn: (wabaId: string) =>
      api.post('/waba/validate', { wabaId }).then((r) => r.data.data as ValidatePreview),
    onSuccess: (data) => {
      setPreview(data)
      setError(null)
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const registerMutation = useMutation({
    mutationFn: (payload: { wabaId: string; label: string }) =>
      api.post('/waba', payload).then((r) => r.data.data as { id: string }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wabas'] })
      onDone(data.id)
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  return (
    <div className="space-y-3 rounded-2xl border border-dashed bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add WABA</p>
      {!preview ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">WABA ID</label>
            <input
              type="text"
              inputMode="numeric"
              value={wabaIdInput}
              onChange={(e) => setWabaIdInput(e.target.value)}
              placeholder="Enter WABA ID"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
          </div>
          {error && <ErrorBanner error={error} />}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!wabaIdInput.trim() || validateMutation.isPending}
              onClick={() => {
                setError(null)
                validateMutation.mutate(wabaIdInput.trim())
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {validateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Fetch phone numbers
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border bg-background px-3 py-2 text-sm">
            <p className="font-semibold text-foreground">{preview.wabaName}</p>
            <p className="text-xs text-muted-foreground">WABA · {preview.wabaId}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {preview.phoneNumbers.length} phone number{preview.phoneNumbers.length === 1 ? '' : 's'} found
            </p>
          </div>
          {error && <ErrorBanner error={error} />}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={registerMutation.isPending}
              onClick={() =>
                registerMutation.mutate({ wabaId: preview.wabaId, label: preview.wabaName })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {registerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm &amp; register
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setError(null)
              }}
              className="rounded-xl border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface CredentialStatus {
  configured: boolean
  provider: string
  model: string
}

type ProviderTab = 'CLAUDE' | 'NVIDIA_LLAMA' | 'OPENAI'

function AiProviderPanel() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<ProviderTab>('CLAUDE')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const credentialQuery = useQuery<CredentialStatus>({
    queryKey: ['iris-credential'],
    queryFn: () => api.get('/templates/iris/credential').then((r) => r.data.data),
  })

  const optionsQuery = useQuery({
    queryKey: ['iris-credential-options'],
    queryFn: () => api.get('/templates/iris/credential/options').then((r) => r.data.data),
  })
  const providers: Record<string, string[]> = optionsQuery.data?.providers ?? {}

  useEffect(() => {
    const models = providers[tab] ?? []
    if (models.length > 0 && !models.includes(model)) {
      setModel(models[0])
    }
  }, [tab, providers, model])

  const mutation = useMutation({
    mutationFn: () => api.put('/templates/iris/credential', { provider: tab, model, apiKey }),
    onSuccess: () => {
      setApiKey('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['iris-credential'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const canSave = !!model && !!apiKey.trim() && !mutation.isPending

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-surface-resting space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        LLM API key · Iris
      </p>
      <p className="text-sm text-muted-foreground">
        Bring your own API key. Template drafts are sent to that provider under their terms.
      </p>

      {credentialQuery.data?.configured && (
        <p className="rounded-xl border bg-background px-3 py-2 text-sm text-foreground">
          Using <span className="font-medium">{credentialQuery.data.provider}</span>
          {' / '}
          {credentialQuery.data.model}
        </p>
      )}

      <div
        role="tablist"
        aria-label="AI provider"
        className="inline-flex rounded-xl bg-muted p-1"
      >
        <ProviderTabButton
          label="OpenAI"
          selected={tab === 'OPENAI'}
          onSelect={() => setTab('OPENAI')}
        />
        <ProviderTabButton
          label="Claude"
          selected={tab === 'CLAUDE'}
          onSelect={() => setTab('CLAUDE')}
        />
        <ProviderTabButton
          label="NVIDIA"
          selected={tab === 'NVIDIA_LLAMA'}
          onSelect={() => setTab('NVIDIA_LLAMA')}
        />
      </div>

      {(providers[tab]?.length ?? 0) > 1 && (
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full max-w-md rounded-xl border bg-background px-3 py-2 text-sm"
        >
          {(providers[tab] ?? []).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">
          {tab === 'CLAUDE' ? 'Claude' : tab === 'OPENAI' ? 'OpenAI' : 'NVIDIA'} API key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste API key"
          className="w-full max-w-md rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
        />
      </div>
      {error && <ErrorBanner error={error} />}
      <button
        type="button"
        disabled={!canSave}
        onClick={() => {
          setError(null)
          mutation.mutate()
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save key
      </button>
    </section>
  )
}

function ProviderTabButton({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

/** Client-side belt for audit display — never show credential material even if a body leaked it. */
function redactSecrets(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    return JSON.stringify(redactValue(parsed), null, 2)
  } catch {
    return raw
      .replace(/(api[_-]?key|client_secret|authorization|bearer)\s*[:=]\s*["']?[^"'&\s,}]+/gi, '$1=[REDACTED]')
  }
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/api[_-]?key|client_secret|authorization|password|token/i.test(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = redactValue(v)
      }
    }
    return out
  }
  return value
}

function AdvancedAuditPanel({ wabaInternalId }: { wabaInternalId: string }) {
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const logQuery = useQuery({
    queryKey: ['template-audit-log', wabaInternalId],
    queryFn: () =>
      api
        .get(`/templates/${wabaInternalId}/audit-log`, { params: { pathPrefix: '/api/templates' } })
        .then((r) => r.data.data),
    enabled: open,
  })

  const entries: Array<{
    id: string
    method: string
    path: string
    status_code: number | null
    request_body: string | null
    response_body: string | null
    error: string | null
    called_at: string
  }> = logQuery.data?.result ?? []

  return (
    <section className="rounded-2xl border bg-card shadow-surface-resting">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Advanced — API activity log</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Debugging detail for Karix API calls. Not needed for day-to-day setup.
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-3 border-t px-5 py-4">
          {logQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {logQuery.isError && <ErrorBanner error={logQuery.error} />}
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
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusIndicator
                      label={entry.status_code != null ? String(entry.status_code) : 'ERR'}
                      tone={entry.status_code && entry.status_code < 400 ? 'positive' : 'negative'}
                    />
                    <span className="shrink-0 font-medium text-foreground">{entry.method}</span>
                    <span className="truncate text-muted-foreground">{entry.path}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(entry.called_at).toLocaleString()}
                  </span>
                </button>
                {expandedId === entry.id && (
                  <div className="mt-2 space-y-2 text-xs">
                    {entry.error && <p className="text-destructive">Error: {entry.error}</p>}
                    {entry.request_body && (
                      <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-muted-foreground">
                        {redactSecrets(entry.request_body)}
                      </pre>
                    )}
                    {entry.response_body && (
                      <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-muted-foreground">
                        {redactSecrets(entry.response_body)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
