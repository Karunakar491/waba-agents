import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Loader2, Send, Save, Check, X } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import WabaPicker from '../components/templatestudio/WabaPicker'

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } } }
  return e.response?.data?.error ?? 'Something went wrong. Please try again.'
}

// Iris — Template Studio's chat assistant (2026-08-04, real build). Locked
// scope: create/edit/list templates, send TEST templates, discuss marketing
// strategy. Nothing else — see project_iris_scope_and_byok memory. Every
// mutating tool call pauses for explicit confirmation (ConfirmPanel) before
// anything is submitted — Iris never submits invisibly from a chat reply.
export default function TemplateIrisPage() {
  const { wabas, isLoading: wabasLoading, selectedWabaId, setSelectedWabaId } = useSelectedWaba()
  const credentialQuery = useQuery({
    queryKey: ['iris-credential'],
    queryFn: () => api.get('/templates/iris/credential').then((r) => r.data.data),
  })

  if (wabasLoading || credentialQuery.isLoading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Iris</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create or edit templates, send a test message, or talk through marketing copy — Iris always shows you
          the exact thing it's about to submit before anything goes out.
        </p>
      </div>

      {!credentialQuery.data?.configured ? (
        <AiCredentialSetup />
      ) : (
        <>
          <WabaPicker wabas={wabas} selectedWabaId={selectedWabaId} onChange={setSelectedWabaId} />
          {selectedWabaId && <IrisChat wabaId={selectedWabaId} />}
        </>
      )}
    </div>
  )
}

function AiCredentialSetup() {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iris-credential'] }),
    onError: (err) => setError(extractMessage(err)),
  })

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Connect an AI provider</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Bring your own API key. Only providers we've built and tested support for are selectable — never free text.
      </p>
      <div className="space-y-2">
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setModel('') }}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select a provider…</option>
          {Object.keys(providers).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {provider && (
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select a model…</option>
            {(providers[provider] ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API key"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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

function IrisChat({ wabaId }: { wabaId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<{ toolName: string; args: Record<string, unknown> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startSession = useMutation({
    mutationFn: () => api.post('/templates/iris/sessions', { wabaId }).then((r) => r.data.data.id as string),
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

  function submit() {
    const text = input.trim()
    if (!text || pending) return
    setError(null)
    setEntries((prev) => [...prev, { who: 'user', text }])
    setInput('')
    sendMessage.mutate(text)
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm flex flex-col" style={{ height: 480 }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask Iris to create a template, edit one, send a test, or talk through your marketing copy.
          </p>
        )}
        {entries.map((e, i) => (
          <div key={i} className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', e.who === 'user' ? 'ml-auto bg-muted' : 'bg-transparent')}>
            {e.text}
          </div>
        ))}
        {(sendMessage.isPending || startSession.isPending) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {pending && (
        <div className="border-t bg-muted/40 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review before submitting</p>
          <p className="text-xs text-muted-foreground">Action: <span className="font-medium text-foreground">{pending.toolName}</span></p>
          <pre className="overflow-x-auto rounded-lg bg-background p-2 text-xs text-foreground">{JSON.stringify(pending.args, null, 2)}</pre>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={confirmAction.isPending}
              onClick={() => confirmAction.mutate()}
              className="flex items-center gap-1 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {confirmAction.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirm
            </button>
            <button
              type="button"
              disabled={cancelAction.isPending}
              onClick={() => cancelAction.mutate()}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border-t p-3 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          disabled={!!pending}
          placeholder={pending ? 'Confirm or cancel the pending action above…' : 'Message Iris…'}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!input.trim() || !!pending || sendMessage.isPending}
          onClick={submit}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-pink text-white disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
