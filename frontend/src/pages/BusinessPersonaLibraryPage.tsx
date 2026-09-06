import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Rocket, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import {
  EMPTY_FORM,
  toFormValues,
} from '../components/agent-detail/BusinessProfileTab'
import type { BusinessProfileResponse, BusinessProfileFormValues } from '../components/agent-detail/BusinessProfileTab'
import { PersonaDraftEditor } from '../components/persona/PersonaFilters'
import { usePersonaData } from '../components/persona/usePersonaData'
import LibraryTable, { LibraryTableSkeleton } from '../components/library/LibraryTable'
import LibraryToolbar from '../components/library/LibraryToolbar'
import type { StatusTone } from '../components/shared/StatusIndicator'
import Modal from '../components/shared/Modal'
import ErrorBanner from '../components/shared/ErrorBanner'

/** Our real persona lifecycle, in the user's words. Figma 8.15 only draws
 *  Published/Draft; ARCHIVED is a third state that genuinely exists here
 *  (a prior version moved to history) and is kept rather than hidden. */
const STATUS_DISPLAY: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  DEPLOYED: { label: 'Published', tone: 'positive' },
  ARCHIVED: { label: 'Saved', tone: 'neutral' },
}

export default function BusinessPersonaLibraryPage() {
  const queryClient = useQueryClient()
  const { phones, rows, isLoading } = usePersonaData()

  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [form, setForm] = useState<BusinessProfileFormValues>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [deployingDraftId, setDeployingDraftId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [pendingDeploy, setPendingDeploy] = useState<{ draftId: string; phoneNumberId: string } | null>(null)

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => statusFilter === 'ALL' || r.profile.status === statusFilter)
      .filter((r) => !q || (r.profile.businessDescription ?? '').toLowerCase().includes(q))
      .sort((a, b) => (b.lastTouched ?? '').localeCompare(a.lastTouched ?? ''))
  }, [rows, search, statusFilter])

  const saveMutation = useMutation({
    mutationFn: (values: BusinessProfileFormValues) =>
      editingDraftId
        ? api.put(`/business-profiles/draft/${editingDraftId}`, values)
        : api.post('/business-profiles/draft', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile-drafts'] })
      setEditingDraftId(null)
      setForm(EMPTY_FORM)
      setFormError(null)
      setShowEditor(false)
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  })

  const deleteDraftMutation = useMutation({
    mutationFn: (draftId: string) => api.delete(`/business-profiles/draft/${draftId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-profile-drafts'] }),
  })

  const deployMutation = useMutation({
    mutationFn: ({ draftId, phoneNumberId }: { draftId: string; phoneNumberId: string }) =>
      api.post(`/business-profiles/draft/${draftId}/deploy`, { phoneNumberId }),
    // Drafts and live-and-history are two independent refetches — between
    // them resolving, the deployed draft can transiently render twice (once
    // stale-DRAFT, once fresh-DEPLOYED). Self-corrects once both land; not a
    // stale-data bug, just a one-frame flicker (EL review, 2026-07-30).
    onSuccess: (_data, { phoneNumberId }) => {
      queryClient.invalidateQueries({ queryKey: ['business-profile-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['business-profile-live-and-history', phoneNumberId] })
      setDeployError(null)
      setDeployingDraftId(null)
    },
    onError: (err) => {
      setDeployError(extractErrorMessage(err))
      setDeployingDraftId(null)
    },
  })

  function startEdit(profile?: BusinessProfileResponse) {
    // A DEPLOYED/ARCHIVED row can't be PUT directly (the backend's
    // loadOwnedDraft() rejects it — live data is never mutated in place).
    // Pre-fill the editor from it, but save as a new DRAFT for redeploy.
    const editable = profile?.status === 'DRAFT'
    setEditingDraftId(editable ? profile.id : null)
    setForm(profile ? toFormValues(profile) : EMPTY_FORM)
    setFormError(null)
    setShowEditor(true)
  }

  function deploy(draftId: string, phoneNumberId: string) {
    setDeployError(null)
    setDeployingDraftId(draftId)
    deployMutation.mutate({ draftId, phoneNumberId })
  }

  function confirmDeploy() {
    if (!pendingDeploy || !pendingDeploy.phoneNumberId) return
    deploy(pendingDeploy.draftId, pendingDeploy.phoneNumberId)
    setPendingDeploy(null)
  }

  const pendingDeployPhone = pendingDeploy
    ? phones.find((p) => p.phoneNumberId === pendingDeploy.phoneNumberId)
    : null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Persona Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Saved tones and starting styles pulled from every agent on your account. Payment terms, return
            policy, and contact info are drafted account-wide, then deployed to one phone number at a time —
            deploying replaces what's live on that number and the prior version moves to history.
          </p>
        </div>
        <button
          onClick={() => startEdit()}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium
            text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Save current persona
        </button>
      </div>

      <LibraryToolbar
        searchId="persona-search"
        searchLabel="Search personas by description"
        searchPlaceholder="Search personas…"
        search={search}
        onSearchChange={setSearch}
        filters={[
          {
            id: 'persona-status-filter',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'DEPLOYED', label: 'Published' },
              { value: 'ARCHIVED', label: 'Saved (history)' },
            ],
          },
        ]}
      />

      {showEditor && (
        <PersonaDraftEditor
          editingDraftId={editingDraftId}
          form={form}
          formError={formError}
          saving={saveMutation.isPending}
          onChange={setForm}
          onSave={() => { setFormError(null); saveMutation.mutate(form) }}
          onCancel={() => { setEditingDraftId(null); setForm(EMPTY_FORM); setFormError(null); setShowEditor(false) }}
        />
      )}

      {deployError && (
        <div className="mt-3">
          <ErrorBanner error={deployError} />
        </div>
      )}

      {isLoading ? (
        <LibraryTableSkeleton />
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-l-4 border-l-accent-teal-solid bg-card p-6 shadow-surface-resting">
          <p className="text-base font-semibold text-foreground">
            {rows.length === 0 ? 'No personas saved yet' : 'Nothing matches those filters'}
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {rows.length === 0
              ? 'Save a persona to describe your payment terms, return policy, and contact info once, then deploy it to any number.'
              : 'Clear a filter or search for a different word to see the rest of your personas.'}
          </p>
        </div>
      ) : (
        <LibraryTable
          itemLabel="Persona"
          rows={filteredRows.map((row) => {
            const status = STATUS_DISPLAY[row.profile.status] ?? {
              label: row.profile.status,
              tone: 'neutral' as StatusTone,
            }
            const isDraft = row.profile.status === 'DRAFT'
            return {
              id: `${row.profile.status}-${row.profile.id}`,
              name: row.profile.businessDescription || `Persona ${row.profile.id}`,
              detail: row.displayPhoneNumber ? `Live on ${row.displayPhoneNumber}` : null,
              // Figma's Industry / Tone chips have no backing data — business_profile
              // stores policy text and contact details, not a categorisation.
              statusLabel: status.label,
              statusTone: status.tone,
              // A persona is live on one number or none. Counting numbers keeps
              // the column meaning the same thing it does on every other list.
              usedByCount: row.displayPhoneNumber ? 1 : 0,
              updatedAt: row.lastTouched ?? null,
              onOpen: () => startEdit(row.profile),
              actions: (
                <>
                  <button
                    onClick={() => startEdit(row.profile)}
                    className="min-h-11 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {isDraft ? 'Edit' : 'Edit as new draft'}
                  </button>
                  {isDraft && (
                    <>
                      {/* Choosing the number moved into the publish modal. A
                          per-row dropdown does not fit a table, and the choice
                          belongs next to the sentence explaining that real
                          customers on that number see the change immediately. */}
                      <button
                        onClick={() =>
                          setPendingDeploy({
                            draftId: row.profile.id,
                            phoneNumberId: phones.length === 1 ? phones[0].phoneNumberId : '',
                          })
                        }
                        disabled={deployMutation.isPending || phones.length === 0}
                        title={phones.length === 0 ? 'No phone number connected yet' : undefined}
                        className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-accent-teal-solid
                          transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        {deployMutation.isPending && deployingDraftId === row.profile.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Rocket className="h-3.5 w-3.5" />
                        )}
                        Publish
                      </button>
                      <button
                        onClick={() => deleteDraftMutation.mutate(row.profile.id)}
                        aria-label={`Delete persona draft ${row.profile.businessDescription || row.profile.id}`}
                        className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </>
              ),
            }
          })}
        />
      )}

      {pendingDeploy && (
        <Modal
          title="Deploy this persona?"
          onClose={() => setPendingDeploy(null)}
          preventClose={deployMutation.isPending}
          maxWidthClassName="max-w-md"
        >
          {phones.length > 1 && (
            <div className="mb-4 space-y-1.5">
              <label htmlFor="deploy-target" className="block text-xs font-medium text-foreground">
                Which number?
              </label>
              <select
                id="deploy-target"
                value={pendingDeploy.phoneNumberId}
                onChange={(e) =>
                  setPendingDeploy((prev) => (prev ? { ...prev, phoneNumberId: e.target.value } : prev))
                }
                disabled={deployMutation.isPending}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">Choose a number…</option>
                {phones.map((p) => (
                  <option key={p.phoneNumberId} value={p.phoneNumberId}>
                    {p.displayPhoneNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            This replaces what's currently live on{' '}
            <span className="font-medium text-foreground">
              {pendingDeployPhone?.displayPhoneNumber ?? 'this number'}
            </span>
            — real customers messaging this number will see the new payment terms, return policy,
            and contact info immediately. The prior version moves to history and can be redeployed later.
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDeploy(null)}
              disabled={deployMutation.isPending}
              className="rounded-xl border px-3.5 py-2 text-sm font-medium hover:bg-muted transition-colors
                disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeploy}
              disabled={deployMutation.isPending || !pendingDeploy.phoneNumberId}
              className="flex items-center gap-1.5 rounded-xl bg-accent-teal-solid px-3.5 py-2 text-sm font-semibold
                text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deployMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Deploy now
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
