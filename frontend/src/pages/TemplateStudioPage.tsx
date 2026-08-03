import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Upload, KeyRound, Save } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'

// Template Studio landing page (2026-08-04) — structured UI first, chat
// interface layered on top later (both call the SAME backend logic via
// domain/templatestudio's proxy to karix-mcp — never diverge). Reuses the
// existing AppShell, gated by the TEMPLATE_STUDIO module entitlement via
// ProtectedRoute + ModuleAccessFilter (path-prefix routed to that module,
// not BUSINESS_AGENTS).

interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

interface CredentialStatus {
  configured: boolean
  esmeAddr: string | null
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } } }
  return e.response?.data?.error ?? 'Something went wrong. Please try again.'
}

export default function TemplateStudioPage() {
  const { data: wabas = [], isLoading: wabasLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const [selectedWabaId, setSelectedWabaId] = useState<string>('')

  if (wabasLoading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Template Studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and bulk-import WhatsApp message templates — separate from Business Agents' Skills/Knowledge Base,
          this is about the templates themselves, not agent behavior.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <label className="block text-sm font-medium text-foreground mb-1.5">WABA</label>
        <select
          value={selectedWabaId}
          onChange={(e) => setSelectedWabaId(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        >
          <option value="">Select a WABA…</option>
          {wabas.map((w) => (
            <option key={w.id} value={w.id}>{w.label || w.wabaId}</option>
          ))}
        </select>
      </div>

      {selectedWabaId && <WabaTemplateStudio wabaId={selectedWabaId} />}
    </div>
  )
}

function WabaTemplateStudio({ wabaId }: { wabaId: string }) {
  const queryClient = useQueryClient()

  const credentialQuery = useQuery<CredentialStatus>({
    queryKey: ['karix-credential', wabaId],
    queryFn: () => api.get(`/templates/${wabaId}/karix-credential`).then((r) => r.data.data),
  })

  if (credentialQuery.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  if (!credentialQuery.data?.configured) {
    return (
      <CredentialForm
        wabaId={wabaId}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['karix-credential', wabaId] })}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-2 text-sm text-muted-foreground">
        <KeyRound className="h-4 w-4" />
        Karix credential configured ({credentialQuery.data.esmeAddr})
      </div>
      <CreateTemplateForm wabaId={wabaId} />
      <BulkImportPanel wabaId={wabaId} />
    </div>
  )
}

function CredentialForm({ wabaId, onSaved }: { wabaId: string; onSaved: () => void }) {
  const [esmeAddr, setEsmeAddr] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.put(`/templates/${wabaId}/karix-credential`, { esmeAddr, apiKey }),
    onSuccess: onSaved,
    onError: (err) => setError(extractMessage(err)),
  })

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Karix credentials required</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        This WABA needs its Karix esme_addr and API key before Template Studio can create templates for it.
        Contact Karix to get these values for this WABA.
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

function CreateTemplateForm({ wabaId }: { wabaId: string }) {
  const [templateName, setTemplateName] = useState('')
  const [language, setLanguage] = useState('en')
  const [category, setCategory] = useState('UTILITY')
  const [bodyText, setBodyText] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/templates/${wabaId}`, {
        templateName,
        language,
        category,
        components: [{ type: 'BODY', text: bodyText }],
      }),
    onSuccess: (res) => {
      const ok = res.data?.data?.ok !== false
      setResult({ ok, message: ok ? 'Template submitted for Meta approval.' : res.data?.data?.error || 'Submission failed.' })
    },
    onError: (err) => setResult({ ok: false, message: extractMessage(err) }),
  })

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Create a template</h3>
      </div>

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

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Body text</label>
        <textarea
          rows={3}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="Hi {{1}}, your order has shipped."
          className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        />
      </div>

      {result && (
        <p className={cn('text-xs', result.ok ? 'text-brand-green' : 'text-destructive')}>{result.message}</p>
      )}

      <button
        type="button"
        disabled={!templateName.trim() || !bodyText.trim() || mutation.isPending}
        onClick={() => { setResult(null); mutation.mutate() }}
        className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        Submit template
      </button>
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
