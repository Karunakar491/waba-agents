import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Send, Sparkles } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import { queryKeysForIrisTool } from './irisQueryKeys'
import IrisRailConfirmCard from './IrisRailConfirmCard'
import { wizardPatchFromIris } from './wizardPatchFromIris'
import type { StepNumber, WizardState } from './wizardTypes'

/**
 * Figma 8.3–8.9 right rail — "Iris · Building this agent with you".
 *
 * This is the real Iris conversation service (POST /api/v1/iris/sessions),
 * the same one Template Studio uses, opened against the WABA the operator
 * picked in Basics. Mutating tools pause for a rail-local confirm card;
 * after confirm we invalidate wizard queries and patch Basics/Persona state.
 */

const OPENING_LINES: Record<StepNumber, string[]> = {
  1: [
    "Not much to discuss here — just pick the number and give it a name your team will recognize. I'll have real questions for you on the next step.",
  ],
  2: [
    "Hi! Let's set up your agent together — I'll ask a few plain questions, no jargon.",
    "First: when a customer messages you, what's the very first thing you usually say back?",
    "One more thing while we're here — what are your hours, how do people pay, and what's your return policy? I'll fill these in as you talk.",
  ],
  3: [
    "Want to add a few FAQs? Tell me a question customers ask a lot and I'll help you write a self-contained answer.",
  ],
  4: [
    'Two different things here. First — any rules it should always follow? Just tell me plainly, like you would a new employee.',
    'Then, if it should send anything richer than text — a product carousel or a quick-reply button — pick a type on the left.',
  ],
  5: [
    "Does it need to reach any real system — like checking if an order actually shipped? I can't invent this part, you'd need to connect the real thing.",
  ],
  6: [
    'Run the scenarios on the left and I can talk you through anything that comes back weak before you deploy.',
  ],
  7: [
    "You're all set. Everything you told me is saved either way — turning the agent on is the only thing left, and it's completely your call, not mine.",
  ],
}

interface RailMessage {
  role: 'assistant' | 'user'
  content: string
}

interface TurnResponse {
  sessionId: string
  reply: string
  needsConfirmation: boolean
  pendingToolName: string | null
  pendingToolArgs: Record<string, unknown> | null
}

interface PendingAction {
  toolName: string
  args: Record<string, unknown>
}

function inlineToolName(res: TurnResponse): string | null {
  if (res.needsConfirmation) return null
  if (res.pendingToolName) return res.pendingToolName
  return null
}

export default function IrisRail({
  step,
  wabaId,
  agentId,
  onWizardPatch,
}: {
  step: StepNumber
  wabaId: string
  agentId: string | null
  onWizardPatch: (patch: Partial<WizardState>) => void
}) {
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [messages, setMessages] = useState<RailMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wabaId || sessionId || unavailable) return
    let cancelled = false
    api
      .post('/iris/sessions', { wabaId, featureKey: 'agent_creation' })
      .then((r) => {
        if (!cancelled) setSessionId(String(r.data.data.id))
      })
      .catch((err) => {
        if (!cancelled) setUnavailable(extractErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [wabaId, sessionId, unavailable])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, step, pending])

  function applyToolSideEffects(toolName: string, args: Record<string, unknown>) {
    if (agentId) {
      for (const key of queryKeysForIrisTool(toolName, agentId, wabaId)) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    }
    onWizardPatch(wizardPatchFromIris(toolName, args))
  }

  async function send() {
    const text = draft.trim()
    if (!text || !sessionId || sending || pending || confirming || cancelling) return
    setDraft('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSending(true)
    try {
      const r = await api.post(`/iris/sessions/${sessionId}/messages`, { text })
      const data = r.data.data as TurnResponse
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
      if (data.needsConfirmation && data.pendingToolName && data.pendingToolArgs) {
        setPending({ toolName: data.pendingToolName, args: data.pendingToolArgs })
      } else {
        setPending(null)
        const toolName = inlineToolName(data)
        if (toolName) applyToolSideEffects(toolName, data.pendingToolArgs ?? {})
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: extractErrorMessage(err) }])
    } finally {
      setSending(false)
    }
  }

  async function confirmPending() {
    if (!sessionId || !pending || confirming || cancelling) return
    const { toolName, args } = pending
    setConfirming(true)
    try {
      await api.post(`/iris/sessions/${sessionId}/confirm`)
      applyToolSideEffects(toolName, args)
      setPending(null)
      setMessages((m) => [...m, { role: 'assistant', content: 'Confirmed and submitted.' }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: extractErrorMessage(err) }])
    } finally {
      setConfirming(false)
    }
  }

  async function cancelPending() {
    if (!sessionId || !pending || confirming || cancelling) return
    setCancelling(true)
    try {
      await api.post(`/iris/sessions/${sessionId}/cancel`)
      setPending(null)
      setMessages((m) => [...m, { role: 'assistant', content: 'Cancelled — nothing was submitted.' }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: extractErrorMessage(err) }])
    } finally {
      setCancelling(false)
    }
  }

  const canChat = !!sessionId && !unavailable
  const composerLocked = !!pending || sending || confirming || cancelling

  return (
    <aside
      aria-label="Iris"
      className="hidden w-96 shrink-0 flex-col border-l bg-card xl:flex"
    >
      <div className="flex items-center gap-4 border-b px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-teal/10">
          <Sparkles className="h-4 w-4 text-accent-teal-solid" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Iris</p>
          <p className="text-xs text-muted-foreground">Building this agent with you</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {OPENING_LINES[step].map((line) => (
          <p key={line} className="text-sm text-muted-foreground">
            {line}
          </p>
        ))}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <p
              className={
                m.role === 'user'
                  ? 'max-w-xs rounded-lg bg-muted px-4 py-3 text-sm text-foreground'
                  : 'text-sm text-muted-foreground'
              }
            >
              {m.content}
            </p>
          </div>
        ))}
        {sending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </p>
        )}
        {pending && (
          <IrisRailConfirmCard
            toolName={pending.toolName}
            args={pending.args}
            onConfirm={() => void confirmPending()}
            onCancel={() => void cancelPending()}
            confirming={confirming}
            cancelling={cancelling}
          />
        )}
      </div>

      <div className="border-t px-5 py-4">
        {canChat ? (
          <>
            {pending && (
              <p className="mb-3 text-xs text-muted-foreground">
                Confirm or cancel the pending action before sending another message.
              </p>
            )}
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder={pending ? 'Confirm or cancel the pending action…' : 'Type your answer…'}
                aria-label="Message Iris"
                disabled={composerLocked}
                className="h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || composerLocked}
                aria-label="Send to Iris"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-teal-solid text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {wabaId
              ? `Chatting with Iris isn't available right now — ${unavailable ?? 'connecting…'} You can fill in every step by hand.`
              : 'Pick a phone number in Basics and Iris can start helping.'}
          </p>
        )}
      </div>
    </aside>
  )
}
