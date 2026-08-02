import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import api from '../lib/api'
import {
  EMPTY_FORM,
  toFormValues,
  extractMessage,
} from '../components/agent-detail/BusinessProfileTab'
import type { BusinessProfileResponse, BusinessProfileFormValues } from '../components/agent-detail/BusinessProfileTab'
import { PersonaTable } from '../components/persona/PersonaTable'
import { PersonaFilters, PersonaDraftEditor } from '../components/persona/PersonaFilters'
import type { StatusFilter } from '../components/persona/PersonaFilters'
import { usePersonaData } from '../components/persona/usePersonaData'

export default function BusinessPersonaLibraryPage() {
  const queryClient = useQueryClient()
  const { phones, rows, isLoading } = usePersonaData()

  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [form, setForm] = useState<BusinessProfileFormValues>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [deployingDraftId, setDeployingDraftId] = useState<string | null>(null)
  const [deployTargets, setDeployTargets] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

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
    onError: (err) => setFormError(extractMessage(err)),
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
      setDeployError(extractMessage(err))
      setDeployingDraftId(null)
    },
  })

  function startEdit(profile?: BusinessProfileResponse) {
    setEditingDraftId(profile?.id ?? null)
    setForm(profile ? toFormValues(profile) : EMPTY_FORM)
    setFormError(null)
    setShowEditor(true)
  }

  function deploy(draftId: string, phoneNumberId: string) {
    setDeployError(null)
    setDeployingDraftId(draftId)
    deployMutation.mutate({ draftId, phoneNumberId })
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Business Persona</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Payment terms, return policy, and contact info — drafted account-wide, deployed to one phone
            number at a time. Deploying replaces what's live on that number; the prior version moves to history.
          </p>
        </div>
        <button
          onClick={() => startEdit()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold
            text-white transition-opacity hover:opacity-90 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          New draft
        </button>
      </div>

      <PersonaFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
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
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{deployError}</div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <PersonaTable
          isLoading={isLoading}
          totalCount={rows.length}
          filteredRows={filteredRows}
          phones={phones}
          deployTargets={deployTargets}
          onDeployTargetChange={(draftId, phoneNumberId) =>
            setDeployTargets((prev) => ({ ...prev, [draftId]: phoneNumberId }))
          }
          onEdit={startEdit}
          onDeploy={deploy}
          onDelete={(id) => deleteDraftMutation.mutate(id)}
          deploying={deployMutation.isPending}
          deployingDraftId={deployingDraftId}
        />
      </div>
    </div>
  )
}
