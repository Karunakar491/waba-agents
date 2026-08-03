import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Upload, List, Plus, Trash2, Pencil, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import WabaPicker from '../components/templatestudio/WabaPicker'

// Templates section of Template Studio (2026-08-04, split into Iris/
// Templates/Settings nav 2026-08-04) — structured UI first, chat interface
// layered on top later (both call the SAME backend logic via
// domain/templatestudio's proxy to karix-mcp — never diverge). Reuses the
// existing AppShell, gated by the TEMPLATE_STUDIO module entitlement via
// ProtectedRoute + ModuleAccessFilter (path-prefix routed to that module,
// not BUSINESS_AGENTS).

interface CredentialStatus {
  configured: boolean
  esmeAddr: string | null
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } } }
  return e.response?.data?.error ?? 'Something went wrong. Please try again.'
}

export default function TemplateStudioPage() {
  const { wabas, isLoading: wabasLoading, selectedWabaId, setSelectedWabaId } = useSelectedWaba()

  if (wabasLoading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and bulk-import WhatsApp message templates — separate from Business Agents' Skills/Knowledge Base,
          this is about the templates themselves, not agent behavior.
        </p>
      </div>

      <WabaPicker wabas={wabas} selectedWabaId={selectedWabaId} onChange={setSelectedWabaId} />

      {selectedWabaId && <WabaTemplateStudio wabaId={selectedWabaId} />}
    </div>
  )
}

function WabaTemplateStudio({ wabaId }: { wabaId: string }) {
  const credentialQuery = useQuery<CredentialStatus>({
    queryKey: ['karix-credential', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/karix-credential`).then((r) => r.data.data),
  })

  if (credentialQuery.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  if (!credentialQuery.data?.configured) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-2">
        <p className="text-sm text-muted-foreground">
          This WABA doesn't have Karix credentials configured yet — set them up in Settings before creating templates.
        </p>
        <Link
          to="/templates/settings"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <SettingsIcon className="h-4 w-4" />
          Go to Settings
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TemplateListPanel wabaId={wabaId} />
      <TemplateBuilderForm wabaId={wabaId} mode="create" />
      <BulkImportPanel wabaId={wabaId} />
    </div>
  )
}

interface TemplateSummary {
  id?: string
  sno?: string
  template_id?: string
  template_name?: string
  name?: string
  status?: string
  rejected_reason?: string
  reject_reason?: string
  category?: string
  language?: string
}

function templateId(t: TemplateSummary): string {
  return String(t.id ?? t.sno ?? t.template_id ?? '')
}

function TemplateListPanel({ wabaId }: { wabaId: string }) {
  const [statusFilter, setStatusFilter] = useState('')
  const [editingTemplate, setEditingTemplate] = useState<TemplateSummary | null>(null)
  const listQuery = useQuery({
    queryKey: ['templates', wabaId, statusFilter],
    queryFn: () => api.get(`/templates/${wabaId}`, { params: statusFilter ? { status: statusFilter } : {} }).then((r) => r.data.data),
  })

  const templates: TemplateSummary[] =
    listQuery.data?.result?.templates ?? listQuery.data?.result?.data ?? (Array.isArray(listQuery.data?.result) ? listQuery.data.result : [])

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Templates</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAUSED">Paused</option>
          </select>
          <button
            type="button"
            onClick={() => listQuery.refetch()}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition"
          >
            <RefreshCw className={cn('h-3 w-3', listQuery.isFetching && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {listQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {listQuery.isError && <p className="text-xs text-destructive">Could not load templates. {extractMessage(listQuery.error)}</p>}
      {listQuery.data && listQuery.data.ok === false && <p className="text-xs text-destructive">{listQuery.data.error}</p>}

      {templates.length === 0 && !listQuery.isLoading && !listQuery.isError && (
        <p className="text-xs text-muted-foreground">No templates yet.</p>
      )}

      <div className="divide-y">
        {templates.map((t) => (
          <div key={templateId(t)} className="flex items-center justify-between py-2 text-sm">
            <div>
              <p className="font-medium text-foreground">{t.template_name || t.name}</p>
              <p className="text-xs text-muted-foreground">{t.category} · {t.language}</p>
              {(t.status === 'REJECTED' || t.status === 'Rejected') && (t.rejected_reason || t.reject_reason) && (
                <p className="text-xs text-destructive mt-0.5">Rejected: {t.rejected_reason || t.reject_reason}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  /approved/i.test(t.status || '') && 'bg-brand-green/10 text-brand-green',
                  /rejected/i.test(t.status || '') && 'bg-destructive/10 text-destructive',
                  /pending|submitted/i.test(t.status || '') && 'bg-amber-500/10 text-amber-600',
                  /paused/i.test(t.status || '') && 'bg-muted text-muted-foreground',
                )}
              >
                {t.status || 'unknown'}
              </span>
              <button
                type="button"
                onClick={() => setEditingTemplate(t)}
                className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted transition"
                aria-label="Edit template"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingTemplate && (
        <TemplateBuilderForm
          wabaId={wabaId}
          mode="edit"
          templateId={templateId(editingTemplate)}
          onDone={() => setEditingTemplate(null)}
        />
      )}
    </div>
  )
}

type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
interface ButtonDraft { type: ButtonType; text: string; url: string; phoneNumber: string }

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g

function extractVariables(text: string): string[] {
  const found = new Set<string>()
  let m
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(text)) !== null) found.add(m[1])
  return Array.from(found)
}

// Meta/Karix template component shape, as returned by GET /templates/{wabaId}/{templateId} —
// used only to seed the edit form; buildComponents() below produces the same shape on submit.
interface KarixComponent {
  type: string
  format?: string
  text?: string
  example?: { header_handle?: string[]; body_text?: string[][] }
  buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string }>
}

function seedFromComponents(components: KarixComponent[]) {
  const seed = {
    headerFormat: 'NONE' as HeaderFormat,
    headerText: '',
    headerHandle: '',
    bodyText: '',
    bodyExamples: {} as Record<string, string>,
    footerText: '',
    buttons: [] as ButtonDraft[],
  }
  for (const c of components) {
    if (c.type === 'HEADER') {
      seed.headerFormat = (c.format as HeaderFormat) || 'TEXT'
      if (c.format === 'TEXT') seed.headerText = c.text || ''
      else seed.headerHandle = c.example?.header_handle?.[0] || ''
    } else if (c.type === 'BODY') {
      seed.bodyText = c.text || ''
      const vars = extractVariables(seed.bodyText)
      const examples = c.example?.body_text?.[0] || []
      vars.forEach((v, i) => { seed.bodyExamples[v] = examples[i] || '' })
    } else if (c.type === 'FOOTER') {
      seed.footerText = c.text || ''
    } else if (c.type === 'BUTTONS') {
      seed.buttons = (c.buttons || []).map((b) => ({
        type: (b.type as ButtonType) || 'QUICK_REPLY',
        text: b.text || '',
        url: b.url || '',
        phoneNumber: b.phone_number || '',
      }))
    }
  }
  return seed
}

function TemplateBuilderForm({ wabaId, mode, templateId, onDone }:
  { wabaId: string; mode: 'create' | 'edit'; templateId?: string; onDone?: () => void }) {
  const queryClient = useQueryClient()
  const isEdit = mode === 'edit'

  const [templateName, setTemplateName] = useState('')
  const [language, setLanguage] = useState('en')
  const [category, setCategory] = useState('UTILITY')

  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('NONE')
  const [headerText, setHeaderText] = useState('')
  const [headerHandle, setHeaderHandle] = useState('')
  const [mediaError, setMediaError] = useState<string | null>(null)

  const [bodyText, setBodyText] = useState('')
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({})
  const [footerText, setFooterText] = useState('')
  const [buttons, setButtons] = useState<ButtonDraft[]>([])
  const [seeded, setSeeded] = useState(!isEdit)

  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const existingTemplateQuery = useQuery({
    queryKey: ['template-detail', wabaId, templateId],
    queryFn: () => api.get(`/templates/${wabaId}/${templateId}`).then((r) => r.data.data),
    enabled: isEdit && !!templateId,
  })

  useEffect(() => {
    if (!isEdit || seeded || !existingTemplateQuery.data?.result) return
    const components: KarixComponent[] =
      existingTemplateQuery.data.result.components ?? existingTemplateQuery.data.result.template?.components ?? []
    const seed = seedFromComponents(components)
    setHeaderFormat(seed.headerFormat)
    setHeaderText(seed.headerText)
    setHeaderHandle(seed.headerHandle)
    setBodyText(seed.bodyText)
    setBodyExamples(seed.bodyExamples)
    setFooterText(seed.footerText)
    setButtons(seed.buttons)
    setSeeded(true)
  }, [isEdit, seeded, existingTemplateQuery.data])

  const uploadMediaMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('category', headerFormat.toLowerCase())
      return api.post(`/templates/${wabaId}/media`, form, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: (res) => {
      const handle = res.data?.data?.result?.fileHandle || res.data?.data?.result?.file_handle || ''
      if (!handle) { setMediaError('Upload succeeded but no file handle was returned.'); return }
      setHeaderHandle(handle)
      setMediaError(null)
    },
    onError: (err) => setMediaError(extractMessage(err)),
  })

  function buildComponents(): Array<Record<string, unknown>> {
    const components: Array<Record<string, unknown>> = []

    if (headerFormat !== 'NONE') {
      if (headerFormat === 'TEXT') {
        components.push({ type: 'HEADER', format: 'TEXT', text: headerText })
      } else {
        components.push({ type: 'HEADER', format: headerFormat, example: { header_handle: [headerHandle] } })
      }
    }

    const variables = extractVariables(bodyText)
    const bodyComponent: Record<string, unknown> = { type: 'BODY', text: bodyText }
    if (variables.length > 0) {
      bodyComponent.example = { body_text: [variables.map((v) => bodyExamples[v] || '')] }
    }
    components.push(bodyComponent)

    if (footerText.trim()) {
      components.push({ type: 'FOOTER', text: footerText })
    }

    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url }
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber }
          return { type: 'QUICK_REPLY', text: b.text }
        }),
      })
    }

    return components
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const components = buildComponents()
      if (isEdit && templateId) {
        return api.post(`/templates/${wabaId}/${templateId}/edit`, { components })
      }
      return api.post(`/templates/${wabaId}`, { templateName, language, category, components })
    },
    onSuccess: (res) => {
      const ok = res.data?.data?.ok !== false
      setResult({
        ok,
        message: ok
          ? (isEdit ? 'Template edit submitted.' : 'Template submitted for Meta approval.')
          : res.data?.data?.error || 'Submission failed.',
      })
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ['templates', wabaId] })
        if (isEdit) onDone?.()
      }
    },
    onError: (err) => setResult({ ok: false, message: extractMessage(err) }),
  })

  const headerReady = headerFormat === 'NONE' || headerFormat === 'TEXT'
    ? true
    : !!headerHandle
  const canSubmit = (isEdit || templateName.trim()) && bodyText.trim() && headerReady
    && (!isEdit || seeded) && !submitMutation.isPending

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{isEdit ? `Edit template ${templateId}` : 'Create a template'}</h3>
        </div>
        {isEdit && (
          <button type="button" onClick={onDone} className="text-xs text-muted-foreground hover:underline">Cancel</button>
        )}
      </div>

      {!isEdit && (
        <TemplateMetaFields
          templateName={templateName} setTemplateName={setTemplateName}
          language={language} setLanguage={setLanguage}
          category={category} setCategory={setCategory}
        />
      )}

      {isEdit && !seeded && !existingTemplateQuery.isError && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {isEdit && !seeded && existingTemplateQuery.isError && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span>Could not load this template's current content — editing is blocked to avoid submitting a blank replacement.</span>
          <button type="button" onClick={() => existingTemplateQuery.refetch()} className="underline shrink-0">Retry</button>
        </div>
      )}
      {(!isEdit || seeded) && (
        <>
          <HeaderEditor
            headerFormat={headerFormat} setHeaderFormat={setHeaderFormat}
            headerText={headerText} setHeaderText={setHeaderText}
            headerHandle={headerHandle} setMediaError={setMediaError} mediaError={mediaError}
            uploadMediaMutation={uploadMediaMutation}
          />
          <BodyEditor bodyText={bodyText} setBodyText={setBodyText} bodyExamples={bodyExamples} setBodyExamples={setBodyExamples} />
          <FooterEditor footerText={footerText} setFooterText={setFooterText} />
          <ButtonsEditor buttons={buttons} setButtons={setButtons} />
        </>
      )}

      {result && (
        <p className={cn('text-xs', result.ok ? 'text-brand-green' : 'text-destructive')}>{result.message}</p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => { setResult(null); submitMutation.mutate() }}
        className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {isEdit ? 'Submit edit' : 'Submit template'}
      </button>
    </div>
  )
}

function TemplateMetaFields({ templateName, setTemplateName, language, setLanguage, category, setCategory }: {
  templateName: string; setTemplateName: (v: string) => void
  language: string; setLanguage: (v: string) => void
  category: string; setCategory: (v: string) => void
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Template name</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="order_shipped"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Language</label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        >
          <option value="UTILITY">Utility</option>
          <option value="MARKETING">Marketing</option>
          <option value="AUTHENTICATION">Authentication</option>
        </select>
      </div>
    </>
  )
}

function HeaderEditor({ headerFormat, setHeaderFormat, headerText, setHeaderText, headerHandle, mediaError, setMediaError, uploadMediaMutation }: {
  headerFormat: HeaderFormat
  setHeaderFormat: (f: HeaderFormat) => void
  headerText: string
  setHeaderText: (t: string) => void
  headerHandle: string
  mediaError: string | null
  setMediaError: (e: string | null) => void
  uploadMediaMutation: { mutate: (f: File) => void; isPending: boolean }
}) {
  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <label className="block text-xs font-medium text-foreground">Header (optional)</label>
      <select
        value={headerFormat}
        onChange={(e) => { setHeaderFormat(e.target.value as HeaderFormat); setMediaError(null) }}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <option value="NONE">None</option>
        <option value="TEXT">Text</option>
        <option value="IMAGE">Image</option>
        <option value="VIDEO">Video</option>
        <option value="DOCUMENT">Document</option>
      </select>
      {headerFormat === 'TEXT' && (
        <input
          type="text"
          value={headerText}
          onChange={(e) => setHeaderText(e.target.value)}
          placeholder="Header text"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}
      {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
        <div className="space-y-1">
          <input
            type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMediaMutation.mutate(f) }}
            className="text-sm text-foreground"
          />
          {uploadMediaMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {headerHandle && <p className="text-xs text-brand-green">Media uploaded.</p>}
          {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}
          {headerFormat === 'IMAGE' && (
            <p className="text-xs text-amber-600">
              Known Karix issue: image header handles can be rejected by Meta (error 2388084) due to a malformed
              type marker on Karix's side. If submission fails on an image header, this is likely why — not a bug
              in this form.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function BodyEditor({ bodyText, setBodyText, bodyExamples, setBodyExamples }: {
  bodyText: string
  setBodyText: (t: string) => void
  bodyExamples: Record<string, string>
  setBodyExamples: (updater: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">Body text</label>
      <textarea
        rows={3}
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Hi {{1}}, your order has shipped."
        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
      />
      {extractVariables(bodyText).map((v) => (
        <div key={v} className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0">{'{{' + v + '}}'} =</span>
          <input
            type="text"
            value={bodyExamples[v] || ''}
            onChange={(e) => setBodyExamples((prev) => ({ ...prev, [v]: e.target.value }))}
            placeholder="Example value"
            className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      ))}
    </div>
  )
}

function FooterEditor({ footerText, setFooterText }: { footerText: string; setFooterText: (t: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">Footer (optional)</label>
      <input
        type="text"
        value={footerText}
        onChange={(e) => setFooterText(e.target.value)}
        placeholder="Footer text"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  )
}

function ButtonsEditor({ buttons, setButtons }: {
  buttons: ButtonDraft[]
  setButtons: (updater: (prev: ButtonDraft[]) => ButtonDraft[]) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground">Buttons (optional)</label>
        <button
          type="button"
          onClick={() => setButtons((prev) => [...prev, { type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '' }])}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add button
        </button>
      </div>
      {buttons.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={b.type}
            onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value as ButtonType } : x)))}
            className="rounded-lg border bg-background px-2 py-1.5 text-xs"
          >
            <option value="QUICK_REPLY">Quick reply</option>
            <option value="URL">URL</option>
            <option value="PHONE_NUMBER">Phone</option>
          </select>
          <input
            type="text"
            value={b.text}
            onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            placeholder="Button text"
            className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground"
          />
          {b.type === 'URL' && (
            <input
              type="text"
              value={b.url}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              placeholder="https://…"
              className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground"
            />
          )}
          {b.type === 'PHONE_NUMBER' && (
            <input
              type="text"
              value={b.phoneNumber}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, phoneNumber: e.target.value } : x)))}
              placeholder="+911234567890"
              className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground"
            />
          )}
          <button
            type="button"
            onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
            className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted transition"
            aria-label="Remove button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

function BulkImportPanel({ wabaId }: { wabaId: string }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post(`/templates/${wabaId}/bulk-import`, form, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: (res) => setJobId(res.data?.data?.job_id ?? null),
    onError: (err) => setError(extractMessage(err)),
  })

  const statusQuery = useQuery({
    queryKey: ['bulk-import-status', wabaId, jobId],
    queryFn: () => api.get(`/templates/${wabaId}/bulk-import/${jobId}`).then((r) => r.data.data),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data?.job?.status === 'completed' || query.state.data?.job?.status === 'failed' ? false : 2000),
  })

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Bulk import</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload an Excel sheet (.xlsx) with columns: template_name, category, language, body_text, and optional
        header/footer/button columns.
      </p>
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) { setError(null); setJobId(null); uploadMutation.mutate(file) }
        }}
        className="text-sm text-foreground"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {jobId && statusQuery.data && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Job status: <span className="font-medium text-foreground">{statusQuery.data.job?.status}</span></p>
          <p>Rows: {statusQuery.data.job?.processed_rows ?? 0} / {statusQuery.data.job?.total_rows ?? 0}</p>
        </div>
      )}
    </div>
  )
}
