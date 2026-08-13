import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import type { StepNumber } from './wizardTypes'

/**
 * Figma 8.3–8.9 right rail — "Iris · Building this agent with you".
 *
 * This is the real Iris conversation service (POST /templates/iris/sessions),
 * the same one Template Studio uses, opened against the WABA the operator
 * picked in Basics. Iris genuinely can act here: AgentCreationToolProvider
 * gives it create_skill against this account's agents.
 *
 * When a session can't be opened — Iris is behind the Template Studio module
 * and needs a BYOK credential — the rail keeps the step's opening line and
 * says plainly that chat is unavailable, instead of drawing a composer that
 * does nothing.
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

export default function IrisRail({ step, wabaId }: { step: StepNumber; wabaId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [messages, setMessages] = useState<RailMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wabaId || sessionId || unavailable) return
    let cancelled = false
    api
      .post('/templates/iris/sessions', { wabaId })
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
  }, [messages, step])

  async function send() {
    const text = draft.trim()
    if (!text || !sessionId || sending) return
    setDraft('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSending(true)
    try {
      const r = await api.post(`/templates/iris/sessions/${sessionId}/messages`, { text })
      setMessages((m) => [...m, { role: 'assistant', content: r.data.data.reply }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: extractErrorMessage(err) }])
    } finally {
      setSending(false)
    }
  }

  const canChat = !!sessionId && !unavailable

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
      </div>

      <div className="border-t px-5 py-4">
        {canChat ? (
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
              placeholder="Type your answer…"
              aria-label="Message Iris"
              className="h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              aria-label="Send to Iris"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-teal-solid text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
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
