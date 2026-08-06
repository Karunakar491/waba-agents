import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '../lib/utils'
import api from '../lib/api'
import { templateQueryKeys } from '../lib/templateQueryKeys'
import { extractErrorMessage } from '../lib/errors'
import { useIrisSidebarStore } from '../store/irisSidebarStore'
import { TEMPLATE_STUDIO_WABA_KEY } from '../hooks/useSelectedWaba'
import IrisConfirmPanel from '../components/templatestudio/IrisConfirmPanel'
import IrisChatPane, { type IrisChatEntry } from '../components/templatestudio/IrisChatPane'

// Iris — Template Studio chat (A− pass 2026-08-06). Sessions in AppShell
// navy rail. Mutating tools pause for docked IrisConfirmPanel beside Iris's
// reply (DESIGN.md §6). No credential forms — Settings only.

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

  const needsSetup = !credentialQuery.isLoading && !wabasQuery.isLoading
    && ((wabasQuery.data?.length ?? 0) === 0 || !credentialQuery.data?.configured)

  return <IrisWorkspace needsSetup={needsSetup} />
}

interface TurnResponse {
  sessionId: string
  reply: string
  needsConfirmation: boolean
  pendingToolName: string | null
  pendingToolArgs: Record<string, unknown> | null
}

interface SessionSummary { id: string; title: string | null; updatedAt: string }
interface MessageDto { role: string; content: string; createdAt: string }

function newEntryId() {
  return crypto.randomUUID()
}

function templatesDeepLink(args: Record<string, unknown> | undefined): string {
  if (!args) return '/templates'
  const editId = args.templateId ?? args.template_id ?? args.id ?? args.karix_template_id
  if (editId != null && String(editId)) {
    return `/templates?edit=${encodeURIComponent(String(editId))}`
  }
  return '/templates'
}

function rememberWabaFromArgs(args: Record<string, unknown> | undefined) {
  if (args?.wabaId == null) return
  localStorage.setItem(TEMPLATE_STUDIO_WABA_KEY, String(args.wabaId))
}

function IrisWorkspace({ needsSetup }: { needsSetup: boolean }) {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const setIrisSidebar = useIrisSidebarStore((s) => s.setIrisSidebar)
  const clearIrisSidebar = useIrisSidebarStore((s) => s.clearIrisSidebar)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [entries, setEntries] = useState<IrisChatEntry[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<{ toolName: string; args: Record<string, unknown> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)

  useEffect(() => {
    const prefill = (location.state as { prefillMessage?: string } | null)?.prefillMessage
    if (prefill) {
      setInput(prefill)
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sessionsQuery = useQuery<SessionSummary[]>({
    queryKey: ['iris-sessions'],
    queryFn: () => api.get('/templates/iris/sessions').then((r) => r.data.data),
  })

  function isBusy() {
    return sendMessage.isPending || confirmAction.isPending || cancelAction.isPending
  }

  function startNewChat() {
    if (isBusy()) return
    if (pending) {
      setError('Confirm or cancel the pending action before starting a new chat.')
      return
    }
    setSessionId(null)
    setEntries([])
    setPending(null)
    setError(null)
    setInput('')
  }

  async function resumeSession(id: string) {
    if (id === sessionId) return
    if (isBusy()) return
    if (pending) {
      setError('Confirm or cancel the pending action before switching chats.')
      return
    }
    setResuming(true)
    setError(null)
    try {
      const messages = await api.get(`/templates/iris/sessions/${id}/messages`).then((r) => r.data.data as MessageDto[])
      setSessionId(id)
      setEntries(messages.map((m) => ({
        id: newEntryId(),
        who: m.role === 'USER' ? 'user' as const : 'iris' as const,
        text: m.content,
        status: 'sent' as const,
      })))
      setPending(null)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setResuming(false)
    }
  }

  useEffect(() => {
    setIrisSidebar({
      sessions: sessionsQuery.data ?? [],
      loading: sessionsQuery.isLoading,
      activeId: sessionId,
      onNewChat: startNewChat,
      onSelect: resumeSession,
    })
  }, [sessionsQuery.data, sessionsQuery.isLoading, sessionId])
  useEffect(() => clearIrisSidebar, [])

  const startSession = useMutation({
    mutationFn: () => api.post('/templates/iris/sessions', {}).then((r) => r.data.data.id as string),
  })

  const sendMessage = useMutation({
    mutationFn: async ({ text }: { text: string; entryId: string }) => {
      let sid = sessionId
      if (!sid) sid = await startSession.mutateAsync()
      setSessionId(sid)
      return api.post(`/templates/iris/sessions/${sid}/messages`, { text }).then((r) => r.data.data as TurnResponse)
    },
    onSuccess: (res, vars) => {
      setEntries((prev) => [
        ...prev.map((e) => (e.id === vars.entryId ? { ...e, status: 'sent' as const } : e)),
        { id: newEntryId(), who: 'iris', text: res.reply, status: 'sent' as const },
      ])
      if (res.needsConfirmation && res.pendingToolName && res.pendingToolArgs) {
        setPending({ toolName: res.pendingToolName, args: res.pendingToolArgs })
      } else {
        setPending(null)
      }
      queryClient.invalidateQueries({ queryKey: ['iris-sessions'] })
    },
    onError: (err, vars) => {
      const message = extractErrorMessage(err)
      setEntries((prev) => prev.map((e) => (e.id === vars.entryId ? { ...e, status: 'error' as const, errorMessage: message } : e)))
    },
  })

  const confirmAction = useMutation({
    mutationFn: () => api.post(`/templates/iris/sessions/${sessionId}/confirm`).then((r) => r.data.data),
    onSuccess: (result) => {
      const isTemplateAction = pending?.toolName === 'create_template' || pending?.toolName === 'edit_template'
      if (isTemplateAction && pending?.args.wabaId != null) {
        queryClient.invalidateQueries({ queryKey: templateQueryKeys.list(String(pending.args.wabaId)) })
        rememberWabaFromArgs(pending.args)
      }
      const resultArgs = {
        ...(pending?.args ?? {}),
        ...(typeof result === 'object' && result ? result as Record<string, unknown> : {}),
      }
      const linkTo = isTemplateAction ? templatesDeepLink(resultArgs) : undefined
      setEntries((prev) => [
        ...prev,
        {
          id: newEntryId(),
          who: 'iris',
          text: 'Confirmed and submitted.',
          status: 'sent',
          link: linkTo ? { label: 'View in Templates →', to: linkTo } : undefined,
        },
      ])
      setPending(null)
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const cancelAction = useMutation({
    mutationFn: () => api.post(`/templates/iris/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      setEntries((prev) => [...prev, { id: newEntryId(), who: 'iris', text: 'Cancelled — nothing was submitted.', status: 'sent' }])
      setPending(null)
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  function sendEntry(entryId: string, text: string) {
    sendMessage.mutate({ text, entryId })
  }

  function submit(text?: string) {
    const value = (text ?? input).trim()
    if (!value || pending || sendMessage.isPending) return
    setError(null)
    const entryId = newEntryId()
    setEntries((prev) => [...prev, { id: entryId, who: 'user', text: value, status: 'sending' }])
    setInput('')
    sendEntry(entryId, value)
  }

  function retry(entry: IrisChatEntry) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'sending' as const, errorMessage: undefined } : e)))
    sendEntry(entry.id, entry.text)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, sendMessage.isPending])

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden">
      <div
        className={cn(
          'grid min-w-0 flex-1',
          pending ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1',
        )}
      >
        <IrisChatPane
          needsSetup={needsSetup}
          resuming={resuming}
          started={entries.length > 0}
          entries={entries}
          input={input}
          setInput={setInput}
          pending={!!pending}
          thinking={sendMessage.isPending || startSession.isPending}
          error={error}
          bottomRef={bottomRef}
          onSubmit={submit}
          onRetry={retry}
          onSuggestion={submit}
        />
        {pending && (
          <IrisConfirmPanel
            toolName={pending.toolName}
            args={pending.args}
            onConfirm={() => confirmAction.mutate()}
            onCancel={() => cancelAction.mutate()}
            confirming={confirmAction.isPending}
            cancelling={cancelAction.isPending}
          />
        )}
      </div>
    </div>
  )
}
