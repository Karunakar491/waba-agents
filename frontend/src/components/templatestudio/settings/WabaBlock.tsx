import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2 } from 'lucide-react'
import api from '../../../lib/api'
import { cn } from '../../../lib/utils'
import type { WabaEntry } from '../../../hooks/useSelectedWaba'
import { extractErrorMessage } from '../../../lib/errors'
import ErrorBanner from '../../shared/ErrorBanner'
import type { DraftCred, MappingView, PhoneRow } from './PhoneMappingRow'
import PhoneMappingTable from './PhoneMappingTable'

// One WABA's accordion — fetch phones, map Karix credentials, save.
// Extracted from TemplateSettingsPage.tsx (V2 rebrand slice 6, Figma node
// 84:9) per the EM-approved decomposition plan.
export default function WabaBlock({
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

  const esmeOptionsQuery = useQuery<Array<{ id: string; esmeAddr: string }>>({
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
      setPhones(data.map((p) => ({
        phoneNumberId: p.phoneNumberId,
        displayPhoneNumber: p.displayPhoneNumber,
        qualityRating: p.qualityRating,
      })))
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
    <div className="overflow-hidden rounded-xl border bg-background">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {waba.label || 'Untitled WABA'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            WABA · {waba.wabaId}
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
              className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
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
            <p className="rounded-xl border border-dashed bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              No phones loaded yet. Click <span className="font-medium text-foreground">Fetch phones</span> to pull
              numbers from Meta.
            </p>
          )}

          {rows.length > 0 && (
            <PhoneMappingTable
              rows={rows}
              mappingByPhone={mappingByPhone}
              drafts={drafts}
              onDraftChange={(phoneNumberId, next) =>
                setDrafts((prev) => ({ ...prev, [phoneNumberId]: next }))
              }
              dirtyUnmappedCount={dirtyUnmapped.length}
              saving={saveMutation.isPending}
              onSave={() => saveMutation.mutate()}
            />
          )}
        </div>
      )}
    </div>
  )
}
