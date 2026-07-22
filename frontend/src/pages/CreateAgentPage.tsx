import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot,
  Check,
  Loader2,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  MessageCircle,
  Rocket,
} from 'lucide-react'
import api from '../lib/api'

/* ------------------------------------------------------------------ */
/* Types + wizard store (spec section 4 — 5-step Create Agent wizard) */
/* ------------------------------------------------------------------ */

type Channel = 'whatsapp' | 'messenger' | 'instagram'

interface Faq {
  id: string
  question: string
  answer: string
}

interface WizardState {
  agentId: string | null
  displayName: string
  customerFacingName: string
  businessDescription: string
  channel: Channel
  tone: string
  language: string
  behaviorRules: string
  faqs: Faq[]
}

const STEPS = [
  { n: 1, title: 'Identity', desc: 'Name and channel' },
  { n: 2, title: 'Personality', desc: 'Tone and behavior' },
  { n: 3, title: 'Knowledge', desc: 'FAQs (optional)' },
  { n: 4, title: 'Connections', desc: 'Coming soon' },
  { n: 5, title: 'Go live', desc: 'Review and launch' },
] as const

const TONES = ['Friendly', 'Professional', 'Casual', 'Formal']

function extractError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })
    ?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}

/* ------------------------------------------------------------------ */

export default function CreateAgentPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<WizardState>({
    agentId: null,
    displayName: '',
    customerFacingName: '',
    businessDescription: '',
    channel: 'whatsapp',
    tone: '',
    language: '',
    behaviorRules: '',
    faqs: [],
  })

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const agentPayload = () => ({
    displayName: state.displayName.trim(),
    customerFacingName: state.customerFacingName.trim() || null,
    channel: state.channel,
    systemPrompt: state.businessDescription.trim(),
    tone: state.tone || null,
    language: state.language.trim() || null,
    behaviorRules: state.behaviorRules.trim() || null,
  })

  /** Autosave: agent is created as a draft on Step 1, updated on later steps. */
  async function saveAndGo(nextStep: number) {
    setSaving(true)
    setError(null)
    try {
      if (!state.agentId) {
        const r = await api.post('/agents', agentPayload())
        set('agentId', String(r.data.data.id))
      } else {
        await api.put(`/agents/${state.agentId}`, agentPayload())
      }
      setStep(nextStep)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  async function finish(activate: boolean) {
    if (!state.agentId) return
    setSaving(true)
    setError(null)
    try {
      await api.put(`/agents/${state.agentId}`, agentPayload())
      if (activate) {
        await api.post(`/agents/${state.agentId}/deploy`)
      }
      navigate(`/agents/${state.agentId}`)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const step1Valid =
    state.displayName.trim().length >= 2 &&
    state.displayName.length <= 40 &&
    state.customerFacingName.length <= 25 &&
    state.businessDescription.trim().length >= 20 &&
    state.businessDescription.length <= 200

  return (
    <div className="mx-auto max-w-6xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_320px]">
        {/* Left: steps rail */}
        <nav aria-label="Wizard steps" className="space-y-1">
          {STEPS.map((s) => {
            const done = s.n < step
            const active = s.n === step
            return (
              <div
                key={s.n}
                aria-current={active ? 'step' : undefined}
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                  active ? 'bg-primary/10' : ''
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? 'bg-primary text-white'
                      : active
                        ? 'border-2 border-primary text-primary'
                        : 'border text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground/70">{s.desc}</p>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Center: form */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 1 && (
            <StepIdentity
              state={state}
              set={set}
              valid={step1Valid}
              saving={saving}
              onNext={() => saveAndGo(2)}
            />
          )}
          {step === 2 && (
            <StepPersonality
              state={state}
              set={set}
              setState={setState}
              saving={saving}
              onBack={() => setStep(1)}
              onNext={() => saveAndGo(3)}
              onError={setError}
            />
          )}
          {step === 3 && (
            <StepKnowledge
              state={state}
              set={set}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              onError={setError}
            />
          )}
          {step === 4 && (
            <StepConnections onBack={() => setStep(3)} onNext={() => setStep(5)} />
          )}
          {step === 5 && (
            <StepGoLive
              state={state}
              saving={saving}
              onBack={() => setStep(4)}
              onFinish={finish}
            />
          )}
        </div>

        {/* Right: live preview */}
        <ChatPreview state={state} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 1 — Identity                                                   */
/* ------------------------------------------------------------------ */

const CHANNELS: { id: Channel; label: string; available: boolean }[] = [
  { id: 'whatsapp', label: 'WhatsApp', available: true },
  { id: 'messenger', label: 'Messenger', available: false },
  { id: 'instagram', label: 'Instagram', available: false },
]

function StepIdentity({
  state,
  set,
  valid,
  saving,
  onNext,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  valid: boolean
  saving: boolean
  onNext: () => void
}) {
  const locked = state.agentId !== null
  const [touched, setTouched] = useState<{ name?: boolean; desc?: boolean }>({})
  const nameError =
    touched.name && state.displayName.trim().length < 2
      ? 'Give your agent a name (at least 2 characters).'
      : null
  const descError =
    touched.desc && state.businessDescription.trim().length < 20
      ? 'Add a little more detail (at least 20 characters).'
      : null
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Identity</h2>
        <p className="text-sm text-muted-foreground">
          Tell us who your agent is and where it lives.
        </p>
      </div>

      <Field
        label="Agent name"
        hint="Only you see this."
        value={state.displayName}
        max={40}
        onChange={(v) => set('displayName', v)}
        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        error={nameError}
        placeholder="e.g. Bloom Bakery Support"
      />

      <Field
        label="Customer-facing name"
        hint="Shown to customers in chat. Optional."
        value={state.customerFacingName}
        max={25}
        onChange={(v) => set('customerFacingName', v)}
        placeholder="e.g. Bloom Assistant"
      />

      <div className="space-y-1.5">
        <label htmlFor="bizdesc" className="block text-sm font-medium text-foreground">
          What does your business do?
        </label>
        <p className="text-xs text-muted-foreground">
          One or two sentences. We use this to set up your agent automatically.
        </p>
        <textarea
          id="bizdesc"
          rows={3}
          maxLength={200}
          value={state.businessDescription}
          onChange={(e) => set('businessDescription', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, desc: true }))}
          placeholder="e.g. We're a bakery in Pune selling custom cakes and weekly bread subscriptions."
          className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
        />
        <div className="flex items-start justify-between">
          <p className="text-xs text-destructive">{descError}</p>
          <p className="ml-4 shrink-0 text-xs text-muted-foreground">
            {state.businessDescription.length}/200
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Channel</p>
        <p className="text-xs text-muted-foreground">
          {locked
            ? "Channel can't be changed after the agent is created."
            : 'Where your agent talks to customers. Locked after creation.'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={!c.available || locked}
              aria-pressed={state.channel === c.id}
              onClick={() => set('channel', c.id)}
              className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                state.channel === c.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'text-muted-foreground'
              } ${!c.available || locked ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/50'}`}
            >
              {c.label}
              {!c.available && (
                <span className="mt-0.5 block text-[10px] font-normal">Coming soon</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <WizardNav saving={saving} nextDisabled={!valid} onNext={onNext} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 2 — Personality (with Claude auto-generation)                  */
/* ------------------------------------------------------------------ */

interface GeneratedDefaults {
  generated: boolean
  tone: string | null
  language: string | null
  behaviorRules: string | null
  faqs: { question: string; answer: string }[]
}

function StepPersonality({
  state,
  set,
  setState,
  saving,
  onBack,
  onNext,
  onError,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  setState: React.Dispatch<React.SetStateAction<WizardState>>
  saving: boolean
  onBack: () => void
  onNext: () => void
  onError: (e: string | null) => void
}) {
  const [generating, setGenerating] = useState(false)
  const [suggestedFaqs, setSuggestedFaqs] = useState<
    { question: string; answer: string }[]
  >([])

  async function generate() {
    setGenerating(true)
    onError(null)
    try {
      const r = await api.post('/agents/generate-defaults', {
        businessDescription: state.businessDescription,
      })
      const d = r.data.data as GeneratedDefaults
      if (!d.generated) {
        onError("Auto-generation isn't available right now — fill these in manually.")
        return
      }
      setState((s) => ({
        ...s,
        tone: d.tone ?? s.tone,
        language: d.language ?? s.language,
        behaviorRules: d.behaviorRules ?? s.behaviorRules,
      }))
      setSuggestedFaqs(d.faqs)
    } catch {
      onError("Auto-generation isn't available right now — fill these in manually.")
    } finally {
      setGenerating(false)
    }
  }

  // Suggested FAQs carry into Step 3 via wizard state (saved there).
  function acceptFaqs() {
    setState((s) => ({
      ...s,
      faqs: [
        ...s.faqs,
        ...suggestedFaqs.map((f, i) => ({ id: `suggested-${Date.now()}-${i}`, ...f })),
      ],
    }))
    setSuggestedFaqs([])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Personality</h2>
          <p className="text-sm text-muted-foreground">
            How your agent sounds when talking to customers.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating ? 'Generating…' : 'Generate with AI'}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Tone</p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={state.tone === t}
              onClick={() => set('tone', t)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                state.tone === t
                  ? 'border-primary bg-primary/10 font-medium text-foreground'
                  : 'text-muted-foreground hover:border-primary/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Language"
        hint="The language your agent replies in."
        value={state.language}
        max={50}
        onChange={(v) => set('language', v)}
        placeholder="e.g. English"
      />

      <div className="space-y-1.5">
        <label htmlFor="rules" className="block text-sm font-medium text-foreground">
          Behavior rules
        </label>
        <p className="text-xs text-muted-foreground">
          Things your agent must always (or never) do. One per line.
        </p>
        <textarea
          id="rules"
          rows={5}
          maxLength={4000}
          value={state.behaviorRules}
          onChange={(e) => set('behaviorRules', e.target.value)}
          placeholder={'Never promise refunds — collect the order number instead.\nAlways greet the customer by name if known.'}
          className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
        />
      </div>

      {suggestedFaqs.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">
            {suggestedFaqs.length} suggested FAQs generated
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            You can review and edit them in the Knowledge step.
          </p>
          <button
            type="button"
            onClick={acceptFaqs}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            Add them to my agent
          </button>
        </div>
      )}

      <WizardNav saving={saving} onBack={onBack} onNext={onNext} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 3 — Knowledge (FAQs)                                           */
/* ------------------------------------------------------------------ */

function StepKnowledge({
  state,
  set,
  onBack,
  onNext,
  onError,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  onBack: () => void
  onNext: () => void
  onError: (e: string | null) => void
}) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)

  function addLocal() {
    if (!question.trim() || !answer.trim()) return
    set('faqs', [
      ...state.faqs,
      { id: `local-${Date.now()}`, question: question.trim(), answer: answer.trim() },
    ])
    setQuestion('')
    setAnswer('')
  }

  function remove(id: string) {
    set('faqs', state.faqs.filter((f) => f.id !== id))
  }

  /**
   * Persist pending FAQs, then advance. Already-saved ones have numeric ids.
   * State is updated per-item so a partial failure + retry never double-saves.
   */
  async function saveAndNext() {
    if (!state.agentId) return onNext()
    setBusy(true)
    onError(null)
    const faqs = state.faqs.map((f) => ({ ...f }))
    try {
      for (const f of faqs) {
        if (/^\d+$/.test(f.id)) continue
        const r = await api.post(`/agents/${state.agentId}/faq`, {
          question: f.question,
          answer: f.answer,
        })
        f.id = String(r.data.data.id)
        set('faqs', faqs.map((x) => ({ ...x })))
      }
      onNext()
    } catch (err) {
      onError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Knowledge</h2>
        <p className="text-sm text-muted-foreground">
          Add questions customers often ask. Optional — you can add these later.
        </p>
      </div>

      {state.faqs.length > 0 && (
        <ul className="space-y-2">
          {state.faqs.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{f.question}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{f.answer}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label={`Remove FAQ: ${f.question}`}
                className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-lg border border-dashed p-4">
        <input
          type="text"
          value={question}
          maxLength={512}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question — e.g. Do you deliver on Sundays?"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
        />
        <textarea
          rows={2}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer"
          className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
        />
        <button
          type="button"
          onClick={addLocal}
          disabled={!question.trim() || !answer.trim() || busy}
          className="flex items-center gap-1.5 text-sm font-medium text-primary transition hover:underline disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add FAQ
        </button>
      </div>

      <WizardNav
        saving={busy}
        onBack={onBack}
        onNext={saveAndNext}
        nextLabel={state.faqs.length === 0 ? 'Skip for now' : 'Continue'}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 4 — Connections (coming soon in wizard)                        */
/* ------------------------------------------------------------------ */

function StepConnections({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Connections</h2>
        <p className="text-sm text-muted-foreground">
          Connect a WhatsApp number so your agent can talk to customers.
        </p>
      </div>
      <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Connect your number from the agent page
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          After you finish this wizard, open your agent and use “Connect phone
          number”. Your agent works as a draft until then.
        </p>
      </div>
      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 5 — Go live                                                    */
/* ------------------------------------------------------------------ */

function StepGoLive({
  state,
  saving,
  onBack,
  onFinish,
}: {
  state: WizardState
  saving: boolean
  onBack: () => void
  onFinish: (activate: boolean) => void
}) {
  // capitalize only the channel — user-entered values render verbatim
  const rows: [string, string, boolean][] = [
    ['Agent name', state.displayName, false],
    ['Customer-facing name', state.customerFacingName || '—', false],
    ['Channel', state.channel, true],
    ['Tone', state.tone || '—', false],
    ['Language', state.language || '—', false],
    ['FAQs', String(state.faqs.length), false],
  ]
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Go live</h2>
        <p className="text-sm text-muted-foreground">
          Review your agent. You can change everything later from settings.
        </p>
      </div>

      <dl className="divide-y rounded-lg border">
        {rows.map(([k, v, cap]) => (
          <div key={k} className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className={`text-sm font-medium text-foreground ${cap ? 'capitalize' : ''}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => onFinish(true)}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Activate agent
        </button>
        <button
          type="button"
          onClick={() => onFinish(false)}
          disabled={saving}
          className="rounded-lg border px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:opacity-60"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="ml-auto rounded-lg px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Back
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  value,
  max,
  onChange,
  onBlur,
  error,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  max: number
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string | null
  placeholder?: string
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        id={id}
        type="text"
        value={value}
        maxLength={max}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
      />
      <div className="flex items-start justify-between">
        <p className="text-xs text-destructive">{error}</p>
        <p className="ml-4 shrink-0 text-xs text-muted-foreground">
          {value.length}/{max}
        </p>
      </div>
    </div>
  )
}

function WizardNav({
  saving,
  nextDisabled,
  nextLabel = 'Continue',
  onBack,
  onNext,
}: {
  saving?: boolean
  nextDisabled?: boolean
  nextLabel?: string
  onBack?: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || saving}
        className="flex items-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {nextLabel}
      </button>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Back
        </button>
      )}
    </div>
  )
}

/** Right panel: WhatsApp-style live preview driven by wizard state. */
function ChatPreview({ state }: { state: WizardState }) {
  const name = state.customerFacingName || state.displayName || 'Your agent'
  const greeting =
    state.tone === 'Formal'
      ? `Good day. This is ${name}. How may I assist you?`
      : state.tone === 'Professional'
        ? `Hello, you've reached ${name}. How can I help you today?`
        : state.tone === 'Casual'
          ? `Hey! ${name} here — what's up?`
          : `Hi there! I'm ${name}. How can I help? 😊`
  return (
    <aside aria-label="Chat preview" className="hidden lg:block">
      <div className="sticky top-6 overflow-hidden rounded-xl border shadow-sm">
        <div className="flex items-center gap-2.5 bg-whatsapp-header px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <p className="text-[11px] text-white/70">online</p>
          </div>
        </div>
        <div className="space-y-2 bg-whatsapp-canvas p-4 pb-6">
          <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
            <p className="text-sm text-whatsapp-ink">{greeting}</p>
          </div>
          {state.faqs[0] && (
            <>
              <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-whatsapp-bubble px-3 py-2 shadow-sm">
                <p className="text-sm text-whatsapp-ink">{state.faqs[0].question}</p>
              </div>
              <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
                <p className="text-sm text-whatsapp-ink">{state.faqs[0].answer}</p>
              </div>
            </>
          )}
        </div>
        <div className="border-t bg-card px-4 py-2.5">
          <p className="text-center text-[11px] text-muted-foreground">
            Live preview — updates as you type
          </p>
        </div>
      </div>
    </aside>
  )
}
