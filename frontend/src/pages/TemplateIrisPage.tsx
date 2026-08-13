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
import type { IrisAttachment } from '../components/templatestudio/IrisComposer'
import { useSelectedWaba } from '../hooks/useSelectedWaba'

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
interface MessageDto {
  role: string
  content: string
  createdAt: string
  toolName: string | null
  toolArgs: Record<string, unknown> | null
}
interface SessionResumeResponse {
  messages: MessageDto[]
  needsConfirmation: boolean
  pendingToolName: string | null
  pendingToolArgs: Record<string, unknown> | null
}

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
  const [attachment, setAttachment] = useState<IrisAttachment | null>(null)
  // Iris's tool-calling has no wabaId selected yet when a file is chosen
  // (the model only picks one once it reads the message) -- media upload is
  // a separate, WABA-scoped karix-mcp call that must happen up front, so it
  // reuses whichever WABA the rest of Template Studio has remembered.
  const { selectedWabaId } = useSelectedWaba()

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('category', 'image')
      const res = await api.post(`/templates/${selectedWabaId}/media`, form, { headers: { 'Content-Type': undefined } })
      const handle = res.data?.data?.result?.fileHandle || res.data?.data?.result?.file_handle
      if (!handle) throw new Error('Upload succeeded but no file handle was returned.')
      return handle as string
    },
    onSuccess: (fileHandle, file) => setAttachment({ fileName: file.name, status: 'ready', fileHandle }),
    onError: (err, file) => setAttachment({ fileName: file.name, status: 'error', errorMessage: extractErrorMessage(err) }),
  })

  function handleAttach(file: File) {
    if (!selectedWabaId) {
      setAttachment({ fileName: file.name, status: 'error', errorMessage: 'Pick a WABA on the Templates page first — image uploads need one.' })
      return
    }
    setAttachment({ fileName: file.name, status: 'uploading' })
    uploadAttachment.mutate(file)
  }

  useEffect(() => {
    const state = location.state as { prefillMessage?: string; resumeSessionId?: string } | null
    if (state?.prefillMessage) {
      setInput(state.prefillMessage)
      navigate(location.pathname, { replace: true, state: null })
    } else if (state?.resumeSessionId) {
      // From the "All Chats" page (2026-08-12) — same resume path the sidebar uses.
      resumeSession(state.resumeSessionId)
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

  // Draft Snapshot cards diff against the PREVIOUS turn's template args to
  // decide what to highlight (IrisDraftSnapshotCard) — tracked as a ref, not
  // state, since it's write-only bookkeeping that never itself drives a
  // render. Reset whenever the session changes so a new chat's first
  // snapshot never diffs against a leftover value from the last one.
  const lastTemplateArgsRef = useRef<Record<string, unknown> | null>(null)

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
    lastTemplateArgsRef.current = null
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
      const resume = await api.get(`/templates/iris/sessions/${id}/messages`).then((r) => r.data.data as SessionResumeResponse)
      setSessionId(id)
      lastTemplateArgsRef.current = null
      setEntries(resume.messages.map((m) => {
        const previousTemplateArgs = lastTemplateArgsRef.current
        if (m.toolArgs) lastTemplateArgsRef.current = m.toolArgs
        return {
          id: newEntryId(),
          who: m.role === 'USER' ? 'user' as const : 'iris' as const,
          text: m.content,
          status: 'sent' as const,
          toolName: m.toolName,
          templateArgs: m.toolArgs,
          previousTemplateArgs,
        }
      }))
      // PM-caught gap (2026-08-07 audit, C1): a session left with an
      // unresolved confirmation used to silently lose that state on resume —
      // the confirm panel never came back and the next message hard-failed.
      setPending(resume.needsConfirmation && resume.pendingToolName && resume.pendingToolArgs
        ? { toolName: resume.pendingToolName, args: resume.pendingToolArgs }
        : null)
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

  // UX-caught gap (2026-08-07 audit): no way to abort a pending send at all —
  // the composer just locked until the request resolved. This only aborts
  // the client-side wait (the backend call to the AI provider isn't
  // cancellable mid-flight and its result is simply discarded) but that's
  // still real relief for a user stuck watching "Iris is thinking..." on a
  // slow/hung request.
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useMutation({
    mutationFn: async ({ text }: { text: string; entryId: string }) => {
      let sid = sessionId
      if (!sid) sid = await startSession.mutateAsync()
      setSessionId(sid)
      const controller = new AbortController()
      abortControllerRef.current = controller
      return api.post(`/templates/iris/sessions/${sid}/messages`, { text }, { signal: controller.signal })
        .then((r) => r.data.data as TurnResponse)
    },
    onSuccess: (res, vars) => {
      const isTemplateAction = res.pendingToolName === 'create_template' || res.pendingToolName === 'edit_template'
      const previousTemplateArgs = lastTemplateArgsRef.current
      if (isTemplateAction && res.pendingToolArgs) lastTemplateArgsRef.current = res.pendingToolArgs
      setEntries((prev) => [
        ...prev.map((e) => (e.id === vars.entryId ? { ...e, status: 'sent' as const } : e)),
        {
          id: newEntryId(),
          who: 'iris',
          text: res.reply,
          status: 'sent' as const,
          toolName: isTemplateAction ? res.pendingToolName : null,
          templateArgs: isTemplateAction ? res.pendingToolArgs : null,
          previousTemplateArgs: isTemplateAction ? previousTemplateArgs : null,
        },
      ])
      if (res.needsConfirmation && res.pendingToolName && res.pendingToolArgs) {
        setPending({ toolName: res.pendingToolName, args: res.pendingToolArgs })
      } else {
        setPending(null)
      }
      queryClient.invalidateQueries({ queryKey: ['iris-sessions'] })
    },
    onError: (err, vars) => {
      const aborted = (err as { code?: string; name?: string })?.code === 'ERR_CANCELED' || (err as { name?: string })?.name === 'CanceledError'
      const message = aborted ? 'Cancelled — Iris\'s reply (if any) was discarded.' : extractErrorMessage(err)
      setEntries((prev) => prev.map((e) => (e.id === vars.entryId ? { ...e, status: 'error' as const, errorMessage: message } : e)))
    },
  })

  function abortSend() {
    abortControllerRef.current?.abort()
  }

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
    const readyAttachment = attachment?.status === 'ready' ? attachment : null
    if ((!value && !readyAttachment) || pending || sendMessage.isPending) return
    setError(null)
    const entryId = newEntryId()
    // The bracketed tag is the ONLY channel carrying the file_handle to the
    // model -- Iris reads plain message text, so this is deliberately
    // machine-readable prose rather than a separate request field. Its
    // system prompt (IrisConversationService.SYSTEM_PROMPT) is written to
    // recognize this exact tag and use the handle for a HEADER IMAGE
    // component instead of asking the operator to attach differently.
    const attachmentTag = readyAttachment ? `\n\n[Attached image: ${readyAttachment.fileName} — file_handle: ${readyAttachment.fileHandle}]` : ''
    const displayText = value + (readyAttachment ? `\n\n📎 ${readyAttachment.fileName}` : '')
    setEntries((prev) => [...prev, { id: entryId, who: 'user', text: displayText, status: 'sending' }])
    setInput('')
    setAttachment(null)
    sendEntry(entryId, value + attachmentTag)
  }

  function removeAttachment() {
    setAttachment(null)
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
          onAbort={abortSend}
          attachment={attachment}
          onAttach={handleAttach}
          onRemoveAttachment={removeAttachment}
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
