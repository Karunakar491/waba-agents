import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import api from '../lib/api'
import ConsequenceLine from '../components/shared/ConsequenceLine'
import StatusIndicator from '../components/shared/StatusIndicator'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import WabaPicker from '../components/templatestudio/WabaPicker'
import TemplateListPanel from '../components/templatestudio/TemplateListPanel'
import TemplateBuilderForm from '../components/templatestudio/TemplateBuilderForm'
import BulkImportPanel from '../components/templatestudio/BulkImportPanel'
import {
  TEMPLATE_STATUS_TONE,
  classifyStatus,
  templateId,
  type TemplateSummary,
} from '../components/templatestudio/templateModel'

// Templates section of Template Studio — 2026-08-06 Structure B + A− pass
// (Iris confirm Modal / live list refresh / cross-WABA health strip).

interface PhoneMapping {
  phoneNumberId: string
  displayPhoneNumber: string | null
  esmeAddr: string | null
  esmeLabel: string | null
}

type StudioView = 'list' | 'create' | 'edit' | 'bulk'

export default function TemplateStudioPage() {
  const { wabas, isLoading: wabasLoading, selectedWabaId, setSelectedWabaId } = useSelectedWaba()

  if (wabasLoading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <p className="text-xs text-muted-foreground">Template Studio &nbsp;›&nbsp; Templates</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All templates across your WhatsApp Business Accounts.
        </p>
      </div>

      <WabaPicker wabas={wabas} selectedWabaId={selectedWabaId} onChange={setSelectedWabaId} />

      {selectedWabaId ? (
        <WabaTemplateStudio wabaId={selectedWabaId} />
      ) : (
        <p className="text-sm text-muted-foreground">Select a WABA to list and create templates.</p>
      )}
    </div>
  )
}

function WabaTemplateStudio({ wabaId }: { wabaId: string }) {
  const [view, setView] = useState<StudioView>('list')
  const [editingTemplate, setEditingTemplate] = useState<TemplateSummary | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const credentialQuery = useQuery<PhoneMapping[]>({
    queryKey: ['phone-mappings', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/phone-mappings`).then((r) => r.data.data),
  })

  const configured = (credentialQuery.data?.length ?? 0) > 0

  function backToList() {
    setEditingTemplate(null)
    setView('list')
    if (searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }

  if (view === 'create' && configured) {
    return (
      <TemplateEditorPage wabaId={wabaId} mode="create" onBack={backToList} onDone={backToList} />
    )
  }

  if (view === 'edit' && configured && editingTemplate) {
    return (
      <TemplateEditorPage
        wabaId={wabaId}
        mode="edit"
        templateId={templateId(editingTemplate)}
        lockedMeta={{
          name: editingTemplate.template_name || editingTemplate.name || '',
          category: editingTemplate.category || '',
          language: editingTemplate.language || '',
          status: editingTemplate.status || '',
        }}
        onBack={backToList}
        onDone={backToList}
      />
    )
  }

  if (view === 'bulk' && configured) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToList}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to templates
        </button>
        <BulkImportPanel wabaId={wabaId} />
      </div>
    )
  }

  return (
    <TemplateListPanel
      wabaId={wabaId}
      configured={configured}
      configuredLoading={credentialQuery.isLoading}
      configuredError={credentialQuery.isError ? credentialQuery.error : null}
      onRetryConfigured={() => credentialQuery.refetch()}
      onCreate={() => { setEditingTemplate(null); setView('create') }}
      onBulk={() => { setEditingTemplate(null); setView('bulk') }}
      onEdit={(t) => { setEditingTemplate(t); setView('edit') }}
      editingFromUrl={searchParams.get('edit')}
    />
  )
}

function TemplateEditorPage({
  wabaId,
  mode,
  templateId,
  lockedMeta,
  onBack,
  onDone,
}: {
  wabaId: string
  mode: 'create' | 'edit'
  templateId?: string
  lockedMeta?: { name: string; category: string; language: string; status: string }
  onBack: () => void
  onDone: () => void
}) {
  const isEdit = mode === 'edit'
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to templates
      </button>

      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isEdit ? 'Edit template' : 'Create template'}
        </h2>
        <div className="mt-2 space-y-1.5">
          {isEdit ? (
            <>
              <ConsequenceLine>
                Meta allows edits only for Approved, Rejected, or Paused templates.
                Name and language stay locked. Category of an approved template cannot change.
              </ConsequenceLine>
              <ConsequenceLine tone="warning">
                Approved templates: at most 1 edit per 24 hours and 10 edits per 30 days.
                Rejected or paused: unlimited. Submitting replaces the full component set.
              </ConsequenceLine>
            </>
          ) : (
            <>
              <ConsequenceLine>
                Name: lowercase letters, numbers, and underscores only (max 512). Categories: Marketing, Utility, Authentication.
                Same name + different language = separate templates.
              </ConsequenceLine>
              <ConsequenceLine>
                Meta review can take up to 24 hours. Body max 1024 characters; variables need examples and cannot start or end the body (except Authentication).
              </ConsequenceLine>
            </>
          )}
        </div>
        {isEdit && lockedMeta && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><span className="font-medium text-foreground">Name</span> {lockedMeta.name || '—'}</span>
            <span><span className="font-medium text-foreground">Category</span> {lockedMeta.category || '—'}</span>
            <span><span className="font-medium text-foreground">Language</span> {lockedMeta.language || '—'}</span>
            <StatusIndicator
              label={lockedMeta.status || 'unknown'}
              tone={TEMPLATE_STATUS_TONE[classifyStatus(lockedMeta.status)]}
            />
          </div>
        )}
      </div>

      <TemplateBuilderForm wabaId={wabaId} mode={mode} templateId={templateId} onDone={onDone} />
    </div>
  )
}
