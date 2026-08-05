import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Upload, List, Plus, Trash2, Pencil, RefreshCw, Settings as SettingsIcon, CheckCircle2, Clock, XCircle, LayoutGrid, MessageSquare } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import StatusIndicator, { type StatusTone } from '../components/shared/StatusIndicator'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import WabaPicker from '../components/templatestudio/WabaPicker'
import { templateQueryKeys } from '../lib/templateQueryKeys'
import { extractErrorMessage } from '../lib/errors'
import ErrorBanner from '../components/shared/ErrorBanner'

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
  const [showCreateForm, setShowCreateForm] = useState(false)
  const credentialQuery = useQuery<CredentialStatus>({
    queryKey: ['karix-credential', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/karix-credential`).then((r) => r.data.data),
  })

  const configured = credentialQuery.data?.configured ?? false

  // Dashboard shell always renders — configuring credentials is a data
  // state (zero counts, disabled actions), never a blocking wall. See
  // knowledge-index entry: founder explicitly rejected the prior full-page
  // redirect-to-Settings behavior.
  return (
    <div className="space-y-6">
      {!credentialQuery.isLoading && !configured && (
        <div className="flex items-center justify-between rounded-xl border border-dashed bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            This WABA doesn't have Karix credentials configured yet — creating templates is disabled until then.
          </p>
          <Link
            to="/templates/settings"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            Go to Settings
          </Link>
        </div>
      )}

      <TemplateListPanel wabaId={wabaId} configured={configured} configuredLoading={credentialQuery.isLoading} />

      {/* Builder gated behind an explicit action (2026-08-05) — previously
          permanently expanded under the table on every visit, even for an
          operator who only opened this page to check approval status. */}
      {configured && !showCreateForm && (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium
            text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      )}
      {configured && showCreateForm && (
        <TemplateBuilderForm wabaId={wabaId} mode="create" onDone={() => setShowCreateForm(false)} />
      )}
      {configured && <BulkImportPanel wabaId={wabaId} />}
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
  quality_score?: { score?: string } | string
}

function templateId(t: TemplateSummary): string {
  return String(t.id ?? t.sno ?? t.template_id ?? '')
}

function qualityLabel(t: TemplateSummary): string | null {
  const q = t.quality_score
  if (!q) return null
  return typeof q === 'string' ? q : q.score ?? null
}

// Meta's template statuses, tallied client-side from a single unfiltered
// list call (EM-approved 2026-08-04 — the whole library is fetched once;
// the table below paginates client-side, see PAGE_SIZE).
const STATUS_COUNTERS = [
  { key: 'APPROVED', label: 'Approved', icon: CheckCircle2, tint: 'text-brand-green', bg: 'bg-brand-green/10' },
  { key: 'PENDING', label: 'Pending', icon: Clock, tint: 'text-warning', bg: 'bg-warning/10' },
  { key: 'REJECTED', label: 'Rejected', icon: XCircle, tint: 'text-destructive', bg: 'bg-destructive/10' },
] as const

// Single source of truth for status classification — the status pill and
// the counter tally must never disagree on what counts as e.g. "pending"
// (Design Evaluator caught these using two different matching rules).
function classifyStatus(status: string | undefined): 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'OTHER' {
  const s = status || ''
  if (/approved/i.test(s)) return 'APPROVED'
  if (/rejected/i.test(s)) return 'REJECTED'
  if (/pending|submitted/i.test(s)) return 'PENDING'
  if (/paused/i.test(s)) return 'PAUSED'
  return 'OTHER'
}

const TEMPLATE_STATUS_TONE: Record<ReturnType<typeof classifyStatus>, StatusTone> = {
  APPROVED: 'positive',
  REJECTED: 'negative',
  PENDING: 'warning',
  PAUSED: 'neutral',
  OTHER: 'neutral',
}

const PAGE_SIZE = 10

function TemplateListPanel({ wabaId, configured, configuredLoading }: { wabaId: string; configured: boolean; configuredLoading: boolean }) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [editingTemplate, setEditingTemplate] = useState<TemplateSummary | null>(null)
  // Unfiltered fetch is the base query — it's what the counters need, and
  // it's what the table needs whenever no filter is selected. A second,
  // filtered fetch only fires once the operator actually picks a status,
  // so the common (no-filter) case makes exactly one network call.
  const allQuery = useQuery({
    queryKey: [...templateQueryKeys.list(wabaId), 'all'],
    queryFn: () => api.get(`/templates/${wabaId}`).then((r) => r.data.data),
    enabled: configured,
  })
  const filteredQuery = useQuery({
    queryKey: [...templateQueryKeys.list(wabaId), statusFilter],
    queryFn: () => api.get(`/templates/${wabaId}`, { params: { status: statusFilter } }).then((r) => r.data.data),
    enabled: configured && !!statusFilter,
  })
  const listQuery = statusFilter ? filteredQuery : allQuery

  const extractTemplates = (data: typeof allQuery.data): TemplateSummary[] =>
    data?.result?.templates ?? data?.result?.data ?? (Array.isArray(data?.result) ? data.result : [])

  const templates: TemplateSummary[] = configured ? extractTemplates(listQuery.data) : []
  const allTemplates: TemplateSummary[] = configured ? extractTemplates(allQuery.data) : []

  // Recomputing these on every render against an unbounded client-fetched
  // list is a real cost at large-WABA scale (2026-08-05 fix) — memoize
  // against the actual data, not re-derive on every parent re-render.
  const counts = useMemo(
    () =>
      STATUS_COUNTERS.reduce<Record<string, number>>((acc, c) => {
        acc[c.key] = allTemplates.filter((t) => classifyStatus(t.status) === c.key).length
        return acc
      }, {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTemplates],
  )
  const countersLoading = configuredLoading || (configured && allQuery.isLoading)

  const pageCount = Math.max(1, Math.ceil(templates.length / PAGE_SIZE))
  const pagedTemplates = useMemo(
    () => templates.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates, page],
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5" />
            Total
          </div>
          {countersLoading ? (
            <div className="mt-1.5 h-7 w-10 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{configured ? allTemplates.length : 0}</p>
          )}
        </div>
        {STATUS_COUNTERS.map(({ key, label, icon: Icon, tint, bg }) => (
          <div key={key} className="rounded-xl border bg-card p-4">
            <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', bg)}>
              <Icon className={cn('h-3.5 w-3.5', tint)} />
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
            {countersLoading ? (
              <div className="mt-1 h-7 w-10 animate-pulse rounded-md bg-muted" />
            ) : (
              <p className={cn('text-2xl font-semibold tabular-nums', tint)}>{configured ? counts[key] ?? 0 : 0}</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-surface-resting space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Templates</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
              disabled={!configured}
              className="rounded-lg border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <option value="">All statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAUSED">Paused</option>
            </select>
            <button
              type="button"
              onClick={() => { allQuery.refetch(); if (statusFilter) filteredQuery.refetch() }}
              disabled={!configured}
              className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', listQuery.isFetching && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {configuredLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!configured && !configuredLoading && (
          <p className="text-xs text-muted-foreground">No templates to show yet — configure Karix credentials for this WABA first.</p>
        )}
        {configured && listQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {configured && listQuery.isError && <p className="text-xs text-destructive">Could not load templates. {extractErrorMessage(listQuery.error)}</p>}
        {configured && listQuery.data && listQuery.data.ok === false && <p className="text-xs text-destructive">{listQuery.data.error}</p>}

        {configured && templates.length === 0 && !listQuery.isLoading && !listQuery.isError && (
          <p className="text-xs text-muted-foreground">No templates match this filter.</p>
        )}

        {configured && templates.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Language</th>
                  <th className="pb-2 pr-3">Quality</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagedTemplates.map((t) => (
                  <tr key={templateId(t)}>
                    <td className="py-2 pr-3 max-w-[220px]">
                      <p className="truncate font-medium text-foreground" title={t.template_name || t.name}>{t.template_name || t.name}</p>
                      {classifyStatus(t.status) === 'REJECTED' && (t.rejected_reason || t.reject_reason) && (
                        <p className="truncate text-xs text-destructive" title={t.rejected_reason || t.reject_reason}>
                          Rejected: {t.rejected_reason || t.reject_reason}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.category ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.language ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{qualityLabel(t) ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <StatusIndicator
                        label={t.status || 'unknown'}
                        tone={TEMPLATE_STATUS_TONE[classifyStatus(t.status)]}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            navigate('/templates/iris', {
                              state: { prefillMessage: `Help me edit the template "${t.template_name || t.name}".` },
                            })
                          }
                          className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted transition"
                          aria-label="Edit with Iris"
                          title="Edit with Iris"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTemplate(t)}
                          className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted transition"
                          aria-label="Edit template"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pageCount > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {page * PAGE_SIZE + 1}–{Math.min(templates.length, (page + 1) * PAGE_SIZE)} of {templates.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="rounded-lg border px-2 py-1 hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="tabular-nums">Page {page + 1} of {pageCount}</span>
                  <button
                    type="button"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    className="rounded-lg border px-2 py-1 hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {editingTemplate && (
          <TemplateBuilderForm
            wabaId={wabaId}
            mode="edit"
            templateId={templateId(editingTemplate)}
            onDone={() => setEditingTemplate(null)}
          />
        )}
      </div>
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
    onError: (err) => setMediaError(extractErrorMessage(err)),
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
        queryClient.invalidateQueries({ queryKey: templateQueryKeys.list(wabaId) })
        // Delay collapse so the success message is actually visible (EL
        // round-1 REJECT, 2026-08-05) — calling onDone in the same commit as
        // setResult unmounts this form before React ever paints the message.
        setTimeout(() => onDone?.(), 1500)
      }
    },
    onError: (err) => setResult({ ok: false, message: extractErrorMessage(err) }),
  })

  const headerReady = headerFormat === 'NONE' || headerFormat === 'TEXT'
    ? true
    : !!headerHandle
  const canSubmit = (isEdit || templateName.trim()) && bodyText.trim() && headerReady
    && (!isEdit || seeded) && !submitMutation.isPending

  return (
    <div className="rounded-xl border bg-card p-5 shadow-surface-resting space-y-4">
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
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Language</label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
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
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
          {mediaError && <ErrorBanner error={mediaError} />}
          {headerFormat === 'IMAGE' && (
            <p className="text-xs text-warning">
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
        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
      />
      {extractVariables(bodyText).map((v) => (
        <div key={v} className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0">{'{{' + v + '}}'} =</span>
          <input
            type="text"
            value={bodyExamples[v] || ''}
            onChange={(e) => setBodyExamples((prev) => ({ ...prev, [v]: e.target.value }))}
            placeholder="Example value"
            className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const statusQuery = useQuery({
    queryKey: ['bulk-import-status', wabaId, jobId],
    queryFn: () => api.get(`/templates/${wabaId}/bulk-import/${jobId}`).then((r) => r.data.data),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data?.job?.status === 'completed' || query.state.data?.job?.status === 'failed' ? false : 2000),
  })

  return (
    <div className="rounded-xl border bg-card p-5 shadow-surface-resting space-y-3">
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
      {error && <ErrorBanner error={error} />}
      {jobId && statusQuery.data && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Job status: <span className="font-medium text-foreground">{statusQuery.data.job?.status}</span></p>
          <p>Rows: {statusQuery.data.job?.processed_rows ?? 0} / {statusQuery.data.job?.total_rows ?? 0}</p>
        </div>
      )}
    </div>
  )
}
