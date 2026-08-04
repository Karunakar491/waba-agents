import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send, Save, Check, X, ShieldAlert, AlertCircle } from 'lucide-react'
import api from '../lib/api'

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } } }
  return e.response?.data?.error ?? 'Something went wrong. Please try again.'
}

// Iris — Template Studio's chat assistant (2026-08-04, real build). Locked
// scope: create/edit/list templates, send TEST templates, discuss marketing
// strategy. Nothing else — see project_iris_scope_and_byok memory. Every
// mutating tool call pauses for explicit confirmation (ConfirmPanel) before
// anything is submitted — Iris never submits invisibly from a chat reply.
//
// No WABA picker (2026-08-04) — a session no longer binds to one WABA
// upfront. Iris is told the account's full WABA list in its system prompt
// (backend) and resolves which one the operator means from conversation,
// supplying wabaId on every tool call itself — see IrisConversationService.
interface WabaEntry { id: string; label: string | null }

export default function TemplateIrisPage() {
  const credentialQuery = useQuery({
    queryKey: ['iris-credential'],
    queryFn: () => api.get('/templates/iris/credential').then((r) => r.data.data),
  })
  const wabasQuery = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })

  if (credentialQuery.isLoading || wabasQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="space-y-2">
          <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-40 animate-pulse rounded-xl border bg-card" />
      </div>
    )
  }

  const wabaCount = wabasQuery.data?.length ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Iris</h1>
        <p className="text-sm text-muted-foreground">
          Create or edit templates, send a test message, or talk through marketing copy — Iris always shows you
          the exact thing it's about to submit before anything goes out.
        </p>
        {wabaCount > 1 && (
          <p className="text-xs text-muted-foreground">Iris will ask which WABA you mean before taking any action.</p>
        )}
        {credentialQuery.data?.configured && (
          <ConnectedStrip provider={credentialQuery.data.provider} model={credentialQuery.data.model} />
        )}
      </div>

      {wabaCount === 0 ? (
        <NoWabaState />
      ) : !credentialQuery.data?.configured ? (
        <AiCredentialSetup />
      ) : (
        <IrisChat />
      )}
    </div>
  )
}

function NoWabaState() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center">
      <p className="text-sm text-muted-foreground">
        This account has no WABA connected yet — Iris needs one to create or send templates.
      </p>
      <Link
        to="/wabas"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Connect a WABA
      </Link>
    </div>
  )
}

function ConnectedStrip({ provider, model }: { provider: string; model: string }) {
  const queryClient = useQueryClient()
  const [changing, setChanging] = useState(false)

  if (changing) {
    return (
      <div className="space-y-2">
        <AiCredentialSetup onSaved={() => setChanging(false)} />
        <button
          type="button"
          onClick={() => setChanging(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <p className="pt-1 text-xs text-muted-foreground">
      Using {provider} / {model}
      {' · '}
      <button
        type="button"
        onClick={() => {
          queryClient.invalidateQueries({ queryKey: ['iris-credential-options'] })
          setChanging(true)
        }}
        className="text-foreground hover:underline"
      >
        Change
      </button>
    </p>
  )
}

function AiCredentialSetup({ onSaved }: { onSaved?: () => void }) {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const optionsQuery = useQuery({
    queryKey: ['iris-credential-options'],
    queryFn: () => api.get('/templates/iris/credential/options').then((r) => r.data.data),
  })
  const providers: Record<string, string[]> = optionsQuery.data?.providers ?? {}

  const mutation = useMutation({
    mutationFn: () => api.put('/templates/iris/credential', { provider, model, apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iris-credential'] })
      onSaved?.()
    },
    onError: (err) => setError(extractMessage(err)),
  })

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Connect an AI provider</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bring your own API key. Only providers we've built and tested support for are selectable — never free text.
          </p>
        </div>
        <div className="space-y-2">
          <select
            value={provider}
            onChange={(e) => { setProvider(e.target.value); setModel('') }}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50"
          >
            <option value="">Select a provider…</option>
            {Object.keys(providers).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {provider && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50"
            >
              <option value="">Select a model…</option>
              {(providers[provider] ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {provider && (
            <p className="text-xs text-muted-foreground">
              Template content and marketing discussion will be sent to {provider}'s hosted endpoint under their own
              terms — this is your key, not ours.
            </p>
          )}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50"
          />
        </div>
        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!provider || !model || !apiKey.trim() || mutation.isPending}
          onClick={() => { setError(null); mutation.mutate() }}
          className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </div>
  )
}

interface TurnResponse {
  sessionId: string
  reply: string
  needsConfirmation: boolean
  pendingToolName: string | null
  pendingToolArgs: Record<string, unknown> | null
}

interface ChatEntry { who: 'user' | 'iris'; text: string }

const SUGGESTIONS = [
  'Create a shipping-update template',
  'Help me plan a marketing message',
  'Send a test of an approved template',
]

function IrisChat() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<{ toolName: string; args: Record<string, unknown> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // No wabaId here — Iris asks which WABA in conversation and resolves it
  // itself (see IrisConversationService's dynamic system prompt).
  const startSession = useMutation({
    mutationFn: () => api.post('/templates/iris/sessions', {}).then((r) => r.data.data.id as string),
  })

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      let sid = sessionId
      if (!sid) sid = await startSession.mutateAsync()
      setSessionId(sid)
      return api.post(`/templates/iris/sessions/${sid}/messages`, { text }).then((r) => r.data.data as TurnResponse)
    },
    onSuccess: (res) => {
      setEntries((prev) => [...prev, { who: 'iris', text: res.reply }])
      setPending(res.needsConfirmation ? { toolName: res.pendingToolName!, args: res.pendingToolArgs! } : null)
    },
    onError: (err) => setError(extractMessage(err)),
  })

  const confirmAction = useMutation({
    mutationFn: () => api.post(`/templates/iris/sessions/${sessionId}/confirm`).then((r) => r.data.data),
    onSuccess: () => {
      setEntries((prev) => [...prev, { who: 'iris', text: 'Confirmed and submitted.' }])
      setPending(null)
    },
    onError: (err) => setError(extractMessage(err)),
  })

  const cancelAction = useMutation({
    mutationFn: () => api.post(`/templates/iris/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      setEntries((prev) => [...prev, { who: 'iris', text: 'Cancelled — nothing was submitted.' }])
      setPending(null)
    },
  })

  function submit(text?: string) {
    const value = (text ?? input).trim()
    if (!value || pending) return
    setError(null)
    setEntries((prev) => [...prev, { who: 'user', text: value }])
    setInput('')
    sendMessage.mutate(value)
  }

  const started = entries.length > 0

  return (
    // Fixed-width preview pane (360px), no responsive breakpoint — deliberate:
    // this is a desktop-only internal operator tool, not a public mobile
    // surface (UX gate 2026-08-04 confirmed this reading, flagged to document).
    <div className="grid gap-4 rounded-xl border bg-card shadow-sm overflow-hidden" style={{ height: 560, gridTemplateColumns: pending ? '1fr 360px' : '1fr' }}>
      <div className="flex min-w-0 flex-col">
        {started && (
          <div className="flex items-center gap-1.5 border-b px-5 py-2 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            Nothing is submitted to Meta until you review and confirm the exact result.
          </div>
        )}

        {!started ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">What do you want to send today?</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Describe a template in plain language — Iris drafts it with you and shows you the exact result
                before anything goes out.
              </p>
            </div>
            <div className="w-full max-w-md">
              <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-brand-pink/30">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                  placeholder="Ask Iris to create a template…"
                  className="flex-1 bg-transparent py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!input.trim() || sendMessage.isPending}
                  onClick={() => submit()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => submit(text)}
                  className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-foreground"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {entries.map((e, i) =>
              e.who === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-brand-navy px-3.5 py-2 text-sm text-white">{e.text}</div>
                </div>
              ) : (
                <p key={i} className="max-w-[85%] text-[15px] leading-relaxed text-foreground">{e.text}</p>
              )
            )}
            {(sendMessage.isPending || startSession.isPending) && (
              <p className="animate-pulse text-sm italic text-muted-foreground">Iris is thinking…</p>
            )}
            {error && (
              <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

        {started && (
          <div className="border-t p-3">
            <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-1 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-brand-pink/30">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                disabled={!!pending}
                placeholder={pending ? 'Confirm or cancel the pending action →' : 'Reply to Iris…'}
                className="flex-1 bg-transparent py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!input.trim() || !!pending || sendMessage.isPending}
                onClick={() => submit()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink text-white disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {pending && (
        <PendingActionPreview
          toolName={pending.toolName}
          args={pending.args}
          onConfirm={() => confirmAction.mutate()}
          onCancel={() => cancelAction.mutate()}
          confirming={confirmAction.isPending}
          cancelling={cancelAction.isPending}
        />
      )}
    </div>
  )
}

// Meta/Karix template component shape — same shape TemplateStudioPage.tsx
// seeds its edit form from. Read-only here: renders the pending action as
// an actual WhatsApp message bubble instead of a raw JSON dump, so the
// operator confirms what the customer will see, not what the API expects.
interface PreviewComponent {
  type: string
  format?: string
  text?: string
  buttons?: Array<{ type: string; text?: string }>
}

function fieldsForCreateOrEdit(args: Record<string, unknown>) {
  const components = (args.components as PreviewComponent[] | undefined) ?? []
  const header = components.find((c) => c.type === 'HEADER')
  const body = components.find((c) => c.type === 'BODY')
  const footer = components.find((c) => c.type === 'FOOTER')
  const buttons = components.find((c) => c.type === 'BUTTONS')?.buttons ?? []
  return { header, body, footer, buttons }
}

function PendingActionPreview({ toolName, args, onConfirm, onCancel, confirming, cancelling }: {
  toolName: string
  args: Record<string, unknown>
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
  cancelling: boolean
}) {
  const isTemplateAction = toolName === 'create_template' || toolName === 'edit_template'
  const { header, body, footer, buttons } = isTemplateAction ? fieldsForCreateOrEdit(args) : { header: undefined, body: undefined, footer: undefined, buttons: [] }

  return (
    <div className="flex flex-col border-l bg-muted/20">
      <div className="border-b px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isTemplateAction ? 'Live preview' : 'Review before submitting'}
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-foreground">
          {isTemplateAction ? 'How this template will look' : toolName}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Exactly what gets submitted — nothing here is inferred silently.</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isTemplateAction ? (
          <>
            <div className="space-y-2 text-xs">
              {typeof args.templateName === 'string' && (
                <PreviewField label="Name" value={args.templateName} />
              )}
              {typeof args.category === 'string' && <PreviewField label="Category" value={args.category} />}
              {typeof args.language === 'string' && <PreviewField label="Language" value={args.language} />}
            </div>
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="flex items-center gap-2 bg-whatsapp-header px-3 py-2 text-xs font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
                WhatsApp preview
              </div>
              <div className="bg-whatsapp-canvas p-4">
                <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-whatsapp-bubble px-3 py-2 text-[13px] leading-relaxed text-whatsapp-ink shadow-sm">
                  {header?.format === 'TEXT' && header.text && <p className="mb-1 font-semibold">{header.text}</p>}
                  {header && header.format && header.format !== 'TEXT' && header.format !== 'NONE' && (
                    <p className="mb-1 text-xs italic text-whatsapp-ink/60">[{header.format.toLowerCase()} header]</p>
                  )}
                  <p>{body?.text || <span className="italic text-whatsapp-ink/40">Body text will appear here…</span>}</p>
                  {footer?.text && <p className="mt-1 text-xs text-whatsapp-ink/50">{footer.text}</p>}
                  {buttons.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-px border-t border-whatsapp-ink/10 pt-1">
                      {buttons.map((b, i) => (
                        <span key={i} className="py-1.5 text-center text-xs font-semibold text-whatsapp-header">{b.text}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <pre className="overflow-x-auto rounded-lg border bg-foreground/5 p-2 text-xs text-foreground">{JSON.stringify(args, null, 2)}</pre>
        )}
      </div>

      <div className="space-y-2 border-t p-4">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Submitting sends this exact content to Meta — this cannot be undone from here.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="flex items-center gap-1 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Confirm
          </button>
          <button
            type="button"
            disabled={cancelling}
            onClick={onCancel}
            className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  )
}
