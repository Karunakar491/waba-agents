import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Circle, FileText, Loader2, Plus, Rocket, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ConsequenceLine from '../shared/ConsequenceLine'
import ErrorBanner from '../shared/ErrorBanner'
import { formatDateTimeIST } from '../../lib/dateFormat'

export interface BusinessProfileResponse {
  id: string
  status: 'DRAFT' | 'DEPLOYED' | 'ARCHIVED'
  phoneNumberId: string | null
  paymentMethod: string | null
  returnPolicy: string | null
  purchaseInfo: string | null
  deliveryAndShipping: string | null
  businessDescription: string | null
  contactEmail: string | null
  contactHoursOfOperation: string | null
  contactAddress: string | null
  deployedAt: string | null
  archivedAt: string | null
  updatedAt: string | null
}

export type BusinessProfileFormValues = {
  paymentMethod: string
  returnPolicy: string
  purchaseInfo: string
  deliveryAndShipping: string
  businessDescription: string
  contactEmail: string
  contactHoursOfOperation: string
  contactAddress: string
}

export const EMPTY_FORM: BusinessProfileFormValues = {
  paymentMethod: '',
  returnPolicy: '',
  purchaseInfo: '',
  deliveryAndShipping: '',
  businessDescription: '',
  contactEmail: '',
  contactHoursOfOperation: '',
  contactAddress: '',
}

export function toFormValues(p: BusinessProfileResponse): BusinessProfileFormValues {
  return {
    paymentMethod: p.paymentMethod ?? '',
    returnPolicy: p.returnPolicy ?? '',
    purchaseInfo: p.purchaseInfo ?? '',
    deliveryAndShipping: p.deliveryAndShipping ?? '',
    businessDescription: p.businessDescription ?? '',
    contactEmail: p.contactEmail ?? '',
    contactHoursOfOperation: p.contactHoursOfOperation ?? '',
    contactAddress: p.contactAddress ?? '',
  }
}

export default function BusinessProfileTab({ phoneNumberId }: { phoneNumberId: string | null }) {
  const queryClient = useQueryClient()
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [form, setForm] = useState<BusinessProfileFormValues>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)

  const { data: live } = useQuery<BusinessProfileResponse | null>({
    queryKey: ['business-profile-live', phoneNumberId],
    queryFn: () =>
      api.get('/business-profiles/live', { params: { phoneNumberId } }).then((r) => r.data.data),
    enabled: !!phoneNumberId,
  })

  const { data: history = [] } = useQuery<BusinessProfileResponse[]>({
    queryKey: ['business-profile-history', phoneNumberId],
    queryFn: () =>
      api.get('/business-profiles/history', { params: { phoneNumberId } }).then((r) => r.data.data ?? []),
    enabled: !!phoneNumberId,
  })

  const { data: drafts = [], isLoading: draftsLoading } = useQuery<BusinessProfileResponse[]>({
    queryKey: ['business-profile-drafts'],
    queryFn: () => api.get('/business-profiles/drafts').then((r) => r.data.data ?? []),
  })

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
    mutationFn: (draftId: string) =>
      api.post(`/business-profiles/draft/${draftId}/deploy`, { phoneNumberId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['business-profile-live', phoneNumberId] })
      queryClient.invalidateQueries({ queryKey: ['business-profile-history', phoneNumberId] })
      setDeployError(null)
    },
    onError: (err) => setDeployError(extractErrorMessage(err)),
  })

  if (!phoneNumberId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-16 text-center shadow-surface-resting">
        <FileText className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-semibold text-foreground">No phone number connected</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Connect a phone number in Settings to manage its business profile.
        </p>
      </div>
    )
  }

  function startEdit(profile?: BusinessProfileResponse) {
    setEditingDraftId(profile?.id ?? null)
    setForm(profile ? toFormValues(profile) : EMPTY_FORM)
    setFormError(null)
    setShowEditor(true)
  }

  return (
    <div className="space-y-5">
      <LiveStatusCard live={live ?? null} />

      <DraftsCard
        drafts={drafts}
        isLoading={draftsLoading}
        showEditor={showEditor}
        editingDraftId={editingDraftId}
        form={form}
        formError={formError}
        deployError={deployError}
        saving={saveMutation.isPending}
        deploying={deployMutation.isPending}
        onNewDraft={() => startEdit()}
        onEditDraft={startEdit}
        onDeleteDraft={(id) => deleteDraftMutation.mutate(id)}
        onDeployDraft={(id) => { setDeployError(null); deployMutation.mutate(id) }}
        onFormChange={setForm}
        onSave={() => { setFormError(null); saveMutation.mutate(form) }}
        onCancel={() => { setEditingDraftId(null); setForm(EMPTY_FORM); setFormError(null); setShowEditor(false) }}
      />

      <HistoryCard history={history} />
    </div>
  )
}

function LiveStatusCard({ live }: { live: BusinessProfileResponse | null }) {
  return (
    <div className="rounded-xl border bg-brand-navy/5 border-brand-navy/20 p-5">
      {live ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-0.5 text-xs font-medium text-brand-green">
            <Circle className="h-1.5 w-1.5 fill-current" />
            Published
          </span>
          <p className="text-sm text-muted-foreground">
            Live since {live.deployedAt ? formatDateTimeIST(live.deployedAt) : 'unknown'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No business profile is live on this number yet.</p>
      )}
    </div>
  )
}

interface DraftsCardProps {
  drafts: BusinessProfileResponse[]
  isLoading: boolean
  showEditor: boolean
  editingDraftId: string | null
  form: BusinessProfileFormValues
  formError: string | null
  deployError: string | null
  saving: boolean
  deploying: boolean
  onNewDraft: () => void
  onEditDraft: (draft: BusinessProfileResponse) => void
  onDeleteDraft: (id: string) => void
  onDeployDraft: (id: string) => void
  onFormChange: (form: BusinessProfileFormValues) => void
  onSave: () => void
  onCancel: () => void
}

function DraftsCard({
  drafts, isLoading, showEditor, editingDraftId, form, formError, deployError,
  saving, deploying, onNewDraft, onEditDraft, onDeleteDraft, onDeployDraft, onFormChange, onSave, onCancel,
}: DraftsCardProps) {
  return (
    <div className="rounded-xl border bg-card shadow-surface-resting">
      <div className="flex items-center justify-between px-4 py-3.5 border-b">
        <span className="text-sm font-semibold text-foreground">Drafts</span>
        <button
          onClick={onNewDraft}
          className="flex items-center gap-1.5 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold
            text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New draft
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : drafts.length === 0 && !showEditor ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No drafts yet. Create one to define payment terms, return policy, and contact info.
        </p>
      ) : (
        <ul className="divide-y">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm text-foreground truncate">
                {draft.businessDescription || `Draft ${draft.id}`}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onEditDraft(draft)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeployDraft(draft.id)}
                  disabled={deploying}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold
                    text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                  Deploy
                </button>
                <button
                  onClick={() => onDeleteDraft(draft.id)}
                  aria-label="Delete draft"
                  className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deployError && (
        <div className="mx-4 mb-4">
          <ErrorBanner error={deployError} />
        </div>
      )}

      {showEditor && (
        <ProfileEditor
          form={form}
          formError={formError}
          saving={saving}
          isEditing={editingDraftId !== null}
          onChange={onFormChange}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

const FIELDS = [
  ['businessDescription', 'Business description', 'textarea'],
  ['paymentMethod', 'Accepted payment methods', 'input'],
  ['returnPolicy', 'Return policy', 'textarea'],
  ['purchaseInfo', 'How to make a purchase', 'textarea'],
  ['deliveryAndShipping', 'Delivery and shipping', 'textarea'],
  ['contactEmail', 'Contact email', 'input'],
  ['contactHoursOfOperation', 'Hours of operation', 'input'],
  ['contactAddress', 'Address', 'input'],
] as const

export interface ProfileEditorProps {
  form: BusinessProfileFormValues
  formError: string | null
  saving: boolean
  isEditing: boolean
  onChange: (form: BusinessProfileFormValues) => void
  onSave: () => void
  onCancel: () => void
}

export function ProfileEditor({ form, formError, saving, isEditing, onChange, onSave, onCancel }: ProfileEditorProps) {
  const inputCls =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

  return (
    <div className="border-t bg-muted/20 px-4 py-4 space-y-3">
      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <ConsequenceLine>
        Deploying replaces what's live now — the old version moves to history.
      </ConsequenceLine>

      {FIELDS.map(([key, label, kind]) => (
        <div key={key} className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">{label}</label>
          {kind === 'textarea' ? (
            <textarea
              rows={2}
              value={form[key]}
              onChange={(e) => onChange({ ...form, [key]: e.target.value })}
              className={cn(inputCls, 'resize-none')}
            />
          ) : (
            <input
              type="text"
              value={form[key]}
              onChange={(e) => onChange({ ...form, [key]: e.target.value })}
              className={inputCls}
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold
            text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEditing ? 'Save draft' : 'Create draft'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function HistoryCard({ history }: { history: BusinessProfileResponse[] }) {
  if (history.length === 0) return null
  return (
    <div className="rounded-xl border bg-card shadow-surface-resting">
      <div className="px-4 py-3.5 border-b">
        <span className="text-sm font-semibold text-foreground">History</span>
      </div>
      <ul className="divide-y">
        {history.map((h) => (
          <li key={h.id} className="flex items-center gap-2 px-4 py-3">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Circle className="h-1.5 w-1.5 fill-current" />
              Saved
            </span>
            <p className="text-xs text-muted-foreground">
              {h.archivedAt ? formatDateTimeIST(h.archivedAt) : 'unknown time'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
