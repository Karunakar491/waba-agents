import { useState } from 'react'
import { Loader2, MessageSquare, RotateCcw, Send } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import ConsequenceLine from '../shared/ConsequenceLine'
import { BottomBar, LinkAction, SectionCard, StepHeader, WizardToggle } from './WizardChrome'
import {
  BUSINESS_INFO_FIELD_COUNT,
  filledBusinessInfoCount,
  type StepNumber,
  type WizardState,
} from './wizardTypes'

interface TestTurn {
  role: 'user' | 'agent'
  text: string
}

/**
 * Screen: Create Agent — Step 7, Test & Deploy (Figma node 215:10)
 *
 * 1. USER GOAL: Check the agent behaves, then decide whether it goes live.
 * 2. EMOTIONAL STATE: The only irreversible-feeling moment in the wizard —
 *    so the copy separates "created" from "replying to customers".
 * 3. POSSIBLE ACTIONS: Jump back to any step, send test messages, reset the
 *    test thread, enable or leave it off, finish.
 * 4. HOW WE HELP: Test mode says outright that nothing reaches a real
 *    customer, and the toggle is off by default.
 */
export default function StepTestDeploy({
  state,
  onChange,
  onBack,
  onEditStep,
  onFinish,
  busy,
  connectorCount,
}: {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onBack: () => void
  onEditStep: (step: StepNumber) => void
  onFinish: () => void
  busy: boolean
  connectorCount: number
}) {
  const [testOpen, setTestOpen] = useState(true)
  const [turns, setTurns] = useState<TestTurn[]>([])
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filled = filledBusinessInfoCount(state.businessInfo)

  const summary: { label: string; value: string; step: StepNumber }[] = [
    { label: 'Phone number', value: state.phoneLabel || 'Not selected', step: 1 },
    { label: 'Business persona', value: state.personaPreset || 'Not chosen', step: 2 },
    {
      label: 'Business info',
      value: `${filled} of ${BUSINESS_INFO_FIELD_COUNT} fields filled`,
      step: 2,
    },
    {
      label: 'Connectors',
      value: connectorCount === 0 ? 'None connected' : `${connectorCount} connected`,
      step: 5,
    },
  ]

  async function sendTest() {
    const userMsg = draft.trim()
    if (!userMsg || !state.agentId || sending) return
    setDraft('')
    setError(null)
    setTurns((t) => [...t, { role: 'user', text: userMsg }])
    setSending(true)
    try {
      const r = await api.post(`/agents/${state.agentId}/test`, { userMsg, conversationId })
      const data = r.data.data as {
        agentResponse: string | null
        conversationId: string | null
        handoffReason: string | null
        noResponseReason: string | null
      }
      setConversationId(data.conversationId ?? conversationId)
      setTurns((t) => [
        ...t,
        {
          role: 'agent',
          text:
            data.agentResponse ??
            data.handoffReason ??
            data.noResponseReason ??
            'The agent did not reply to this message.',
        },
      ])
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <StepHeader
        title="Ready to launch"
        subtitle="Your agent is created either way — turning this on is what actually makes it start replying to customers."
      />

      {error && (
        <div className="mb-6">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="space-y-6">
        <section className="divide-y rounded-xl border bg-card shadow-surface-resting">
          {summary.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-foreground">{row.value}</span>
                <LinkAction onClick={() => onEditStep(row.step)}>Edit</LinkAction>
              </div>
            </div>
          ))}
        </section>

        <section className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-surface-resting">
          <div className="flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-teal/10">
              <MessageSquare className="h-4 w-4 text-accent-teal-solid" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Try it before you turn it on</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Send it a few test messages — this never reaches real customers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTestOpen((o) => !o)}
            className="h-8 shrink-0 rounded-lg border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {testOpen ? 'Hide test' : 'Test agent'}
          </button>
        </section>

        {testOpen && (
          <section className="overflow-hidden rounded-xl border bg-card shadow-surface-resting">
            <p className="flex items-center gap-3 border-b px-4 py-3 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-accent-teal-solid" />
              Test mode — messages never reach real customers, not billed
            </p>
            <div className="max-h-96 space-y-3 overflow-y-auto p-4">
              {turns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Send the first message below to see how it answers.
                </p>
              ) : (
                turns.map((t, i) => (
                  <div key={i} className={t.role === 'user' ? 'flex justify-end' : ''}>
                    <p
                      className={
                        t.role === 'user'
                          ? 'max-w-md rounded-lg bg-muted px-4 py-3 text-sm text-foreground'
                          : 'max-w-md rounded-lg border px-4 py-3 text-sm text-foreground'
                      }
                    >
                      {t.text}
                    </p>
                  </div>
                ))
              )}
              {sending && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for a reply…
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 border-t p-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void sendTest()
                  }
                }}
                maxLength={1000}
                aria-label="Test message"
                placeholder="Type a test message…"
                className="h-10 flex-1 rounded-lg border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent-teal-solid"
              />
              <button
                type="button"
                onClick={() => void sendTest()}
                disabled={!draft.trim() || sending || !state.agentId}
                aria-label="Send test message"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-teal-solid text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTurns([])
                  setConversationId(null)
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Reset conversation
              </button>
            </div>
          </section>
        )}

        <SectionCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Enable this agent</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Off by default — nothing goes live until you turn this on.
              </p>
            </div>
            <WizardToggle
              checked={state.enabled}
              onChange={(v) => onChange({ enabled: v })}
              label="Enable this agent"
            />
          </div>
          <ConsequenceLine>
            You can create this agent disabled and turn it on later from the Agents list — or from
            here, right now.
          </ConsequenceLine>
        </SectionCard>
      </div>

      <BottomBar
        onBack={onBack}
        onNext={onFinish}
        nextLabel="Finish Setup"
        busy={busy}
      />
    </>
  )
}
