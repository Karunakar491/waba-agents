import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import {
  UI_COMPONENT_TYPES,
  instructionHint,
  uiComponentLabel,
  uiComponentSpec,
} from '../skills/uiComponentTypes'
import {
  BottomBar,
  LinkAction,
  SectionCard,
  SelectField,
  StepHeader,
  TextField,
  WizardToggle,
} from './WizardChrome'
import YourSkillsDrawer from './YourSkillsDrawer'

export interface AvailableSkill {
  id: string
  title: string
  description: string
  body: string
  deployed: boolean
  industry: string | null
  deployments?: { agentId: string }[]
}

interface AgentSkillView {
  id: string
  source: 'AGENT' | 'SHARED'
  title: string
  description: string
  body: string
  status: string
  sharedSkillId: string | null
}

interface UiSkill {
  id: string
  title: string
  componentType: string
  instruction: string
  status: 'enabled' | 'disabled'
}

/**
 * The chips are every rich message we can actually send, from the single list in
 * components/skills/uiComponentTypes — no separate subset to drift.
 *
 * It used to be Figma's five, which showed a disabled "Flow" chip for a type we
 * do not support, mapped "Carousel" onto `carousel_url` alone (so the
 * reply-button carousel could not be reached at all), and left out Image. A
 * control for something we cannot do is an advertisement, not an explanation.
 */
const COMPONENT_CHIPS = UI_COMPONENT_TYPES

/**
 * Worked examples. Each one names the content Meta needs for that type, because
 * the old placeholders described only the trigger and taught people to leave the
 * content out — which produced rich messages the agent could never build.
 */
const CHIP_PLACEHOLDER: Record<string, string> = {
  cta_url:
    'e.g. After confirming an order, send a button with the text "Your order is on its way", ' +
    'the button labelled "Track order", linking to https://example.com/track',
  interactive_reply_buttons:
    'e.g. When the customer asks to change an order, send "What would you like to change?" ' +
    'with buttons labelled "Delivery date", "Address" and "Cancel order"',
  interactive_list:
    'e.g. When the customer asks what we sell, send "Here is what we stock" with a button ' +
    'labelled "Browse" opening a list of Spices, Ready mixes and Gift packs, each with a one-line description',
  carousel_url:
    'e.g. When the customer asks to browse products, send up to 3 cards, each with the product ' +
    'photo, its name and price, and a button labelled "View" linking to that product page',
  carousel_quick_reply:
    'e.g. When the customer asks for delivery slots, send a card per slot with its photo and ' +
    'time, each with a button labelled "Book this"',
  image:
    'e.g. When the customer asks what the gift pack looks like, send the photo at ' +
    'https://example.com/giftpack.jpg with the caption "Our 500g gift pack"',
  location:
    'e.g. When the customer asks where the shop is, send our location: MDH Store, ' +
    '12 Main Road Gurgaon, latitude 28.4595, longitude 77.0266',
  location_request:
    'e.g. When we need a delivery address, ask "Please share your location so we can check delivery"',
}

/**
 * Screen: Create Agent — Step 4, Skills (Figma nodes 218:2 and 289:2)
 *
 * 1. USER GOAL: Two separate things — the plain-language rules the agent
 *    always follows, and the richer message shapes it may send.
 * 2. EMOTIONAL STATE: Confident about the rules (they know their business),
 *    unsure about the components (Meta's vocabulary, not theirs).
 * 3. POSSIBLE ACTIONS: Write a rule, add one already saved, save one
 *    back, pick a component type, or define a brand-new one.
 * 4. HOW WE HELP: One standard shape covers every component type, so a type
 *    Meta adds later needs no new screen — and the step says it's skippable.
 */
export default function StepSkills({
  agentId,
  wabaId,
  drawerOpen,
  onDrawerOpenChange,
  onBack,
  onNext,
}: {
  agentId: string | null
  wabaId: string
  drawerOpen: boolean
  onDrawerOpenChange: (open: boolean) => void
  onBack: () => void
  onNext: () => void
}) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [newRule, setNewRule] = useState('')
  const [activeChip, setActiveChip] = useState<string | null>(null)
  const [chipInstruction, setChipInstruction] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    componentType: '',
    instruction: '',
    status: true,
  })

  const enabled = !!agentId
  const onError = (err: unknown) => setError(extractErrorMessage(err))

  const { data: rules = [] } = useQuery<AgentSkillView[]>({
    queryKey: ['agent-skills-view', agentId],
    queryFn: () => api.get(`/agents/${agentId}/skills-view`).then((r) => r.data.data),
    enabled,
  })
  const { data: availableSkills = [] } = useQuery<AvailableSkill[]>({
    queryKey: ['skills', wabaId],
    queryFn: () => api.get('/skills', { params: { wabaId } }).then((r) => r.data.data),
    enabled: !!wabaId,
  })
  const { data: uiSkills = [] } = useQuery<UiSkill[]>({
    queryKey: ['agent-ui-skills', agentId],
    queryFn: () => api.get(`/agents/${agentId}/ui-skills`).then((r) => r.data.data),
    enabled,
  })

  const usedByCount = useMemo(() => {
    const map = new Map<string, number>()
    availableSkills.forEach((s) => map.set(s.id, s.deployments?.length ?? 0))
    return map
  }, [availableSkills])

  const addRule = useMutation({
    mutationFn: (body: string) =>
      api.post(`/agents/${agentId}/skills`, {
        title: body.slice(0, 64),
        description: body.slice(0, 1024),
        body,
      }),
    onSuccess: () => {
      setNewRule('')
      void qc.invalidateQueries({ queryKey: ['agent-skills-view', agentId] })
    },
    onError,
  })
  const removeRule = useMutation({
    mutationFn: (skillId: string) => api.delete(`/agents/${agentId}/skills/${skillId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-skills-view', agentId] }),
    onError,
  })
  const promoteRule = useMutation({
    mutationFn: (skillId: string) =>
      api.post(`/agents/${agentId}/skills/${skillId}/promote`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agent-skills-view', agentId] })
      void qc.invalidateQueries({ queryKey: ['skills', wabaId] })
    },
    onError,
  })
  const addUiSkill = useMutation({
    mutationFn: (payload: {
      title: string
      componentType: string
      instruction: string
      status: 'enabled' | 'disabled'
    }) => api.post(`/agents/${agentId}/ui-skills`, payload),
    onSuccess: () => {
      setChipInstruction('')
      setActiveChip(null)
      setFormOpen(false)
      setForm({ title: '', componentType: '', instruction: '', status: true })
      void qc.invalidateQueries({ queryKey: ['agent-ui-skills', agentId] })
    },
    onError,
  })
  const removeUiSkill = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${agentId}/ui-skills/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-ui-skills', agentId] }),
    onError,
  })

  const attachedTitles = new Set(rules.map((r) => r.title))

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <StepHeader
          title="What should it do — and how should it show up?"
          subtitle="Plain-language rules it should follow, plus richer message types like carousels or quick buttons."
        />

        {error && (
          <div className="mb-6">
            <ErrorBanner error={error} />
          </div>
        )}

        <div className="space-y-6">
          <SectionCard
            title="Skills"
            footnote="Optional — tell Iris about any rules, or skip this and add them later."
            actions={
              <>
                <LinkAction
                  onClick={() => onDrawerOpenChange(!drawerOpen)}
                  icon={<FolderOpen className="h-4 w-4" />}
                  disabled={!wabaId}
                >
                  Add a saved skill
                </LinkAction>
                <span className="text-sm text-muted-foreground">·</span>
                <LinkAction
                  onClick={() => {
                    setError(null)
                    addRule.mutate(newRule.trim())
                  }}
                  icon={<Plus className="h-4 w-4" />}
                  disabled={!enabled || !newRule.trim() || addRule.isPending}
                >
                  Add a rule
                </LinkAction>
              </>
            }
          >
            {rules.length > 0 && (
              <ul className="divide-y">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{r.body || r.title}</p>
                      {r.source === 'SHARED' && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Shared across agents · used by{' '}
                          {Math.max(0, (usedByCount.get(r.sharedSkillId ?? '') ?? 1) - 1)} other
                          agents
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {r.source === 'AGENT' && (
                        <LinkAction onClick={() => promoteRule.mutate(r.id)}>
                          + Share across agents
                        </LinkAction>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRule.mutate(r.id)}
                        aria-label={`Remove rule: ${r.title}`}
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <TextField
              id="skills-new-rule"
              label="New rule"
              value={newRule}
              onChange={setNewRule}
              placeholder="e.g. Never discuss refunds — always direct to the returns policy instead."
              maxLength={1024}
            />
          </SectionCard>

          <SectionCard
            title="Rich message components"
            description="Beyond plain text — carousels, buttons, lists, and location requests it can send at the right moment."
            footnote="Tap a type to configure when it sends and what it contains. Flow-type skills stay disabled until the flow is published in Meta's Flow Builder."
          >
            <div className="flex flex-wrap gap-3">
              {COMPONENT_CHIPS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  disabled={!enabled}
                  aria-pressed={activeChip === c.value}
                  title={c.summary}
                  onClick={() => {
                    setActiveChip(c.value)
                    setChipInstruction('')
                    setFormOpen(false)
                  }}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-left text-sm transition-colors',
                    activeChip === c.value
                      ? 'border-accent-teal-solid bg-accent-teal/10 font-medium text-accent-teal-solid'
                      : 'text-foreground hover:border-accent-teal',
                  )}
                >
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                disabled={!enabled}
                onClick={() => {
                  setFormOpen(true)
                  setActiveChip(null)
                }}
                className="rounded-lg border border-dashed px-4 py-2 text-sm text-accent-teal-solid transition-colors hover:bg-accent-teal/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                + Add component
              </button>
            </div>

            {uiSkills.length > 0 && (
              <ul className="divide-y">
                {uiSkills.map((u) => (
                  <li key={u.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{u.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {u.componentType} · {u.instruction}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUiSkill.mutate(u.id)}
                      aria-label={`Remove component: ${u.title}`}
                      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {activeChip && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  {uiComponentLabel(activeChip)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uiComponentSpec(activeChip)?.summary}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  When to send it, and what it should say
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{instructionHint(activeChip)}</p>
                {/* A textarea, not a single-line input: this now has to hold the
                    component's content as well as its trigger, and one line of a
                    1024-character field hides what someone has written. */}
                <textarea
                  rows={4}
                  value={chipInstruction}
                  onChange={(e) => setChipInstruction(e.target.value)}
                  maxLength={1024}
                  aria-label="When to send it, and what it should say"
                  placeholder={CHIP_PLACEHOLDER[activeChip] ?? ''}
                  className="mt-2 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent-teal-solid"
                />
                <button
                  type="button"
                  disabled={!chipInstruction.trim() || addUiSkill.isPending}
                  onClick={() =>
                    addUiSkill.mutate({
                      title: uiComponentLabel(activeChip),
                      componentType: activeChip,
                      instruction: chipInstruction.trim(),
                      status: 'enabled',
                    })
                  }
                  className="mt-4 h-10 rounded-lg bg-accent-teal-solid px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Save component
                </button>
              </div>
            )}

            {formOpen && (
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    New component — standard shape
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every rich component uses this exact shape. When Meta adds a new type, it works
                    here immediately — no new screen needed.
                  </p>
                </div>
                <TextField
                  id="ui-title"
                  label="Title"
                  apiName="title"
                  value={form.title}
                  onChange={(v) => setForm((f) => ({ ...f, title: v }))}
                  placeholder="e.g. Shipping status carousel"
                  maxLength={64}
                />
                <SelectField
                  id="ui-type"
                  label="What it sends"
                  apiName="component_type"
                  value={form.componentType}
                  onChange={(v) => setForm((f) => ({ ...f, componentType: v }))}
                  options={UI_COMPONENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  placeholder="Select…"
                  hint={uiComponentSpec(form.componentType)?.summary}
                />
                <TextField
                  id="ui-instruction"
                  label="When to send it, and what it should say"
                  apiName="instruction"
                  value={form.instruction}
                  onChange={(v) => setForm((f) => ({ ...f, instruction: v }))}
                  placeholder={CHIP_PLACEHOLDER[form.componentType] ?? ''}
                  maxLength={1024}
                  hint={instructionHint(form.componentType)}
                />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-foreground">
                    Status <span className="text-xs text-muted-foreground">status</span>
                  </span>
                  <WizardToggle
                    checked={form.status}
                    onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    label="Component enabled"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    !form.title.trim() ||
                    !form.componentType ||
                    !form.instruction.trim() ||
                    addUiSkill.isPending
                  }
                  onClick={() =>
                    addUiSkill.mutate({
                      title: form.title.trim(),
                      componentType: form.componentType,
                      instruction: form.instruction.trim(),
                      status: form.status ? 'enabled' : 'disabled',
                    })
                  }
                  className="h-10 w-full rounded-lg bg-accent-teal-solid px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Save component
                </button>
              </div>
            )}
          </SectionCard>
        </div>

        <BottomBar onBack={onBack} onNext={onNext} />
      </div>

      {drawerOpen && (
        <YourSkillsDrawer
          wabaId={wabaId}
          attachedTitles={attachedTitles}
          onClose={() => onDrawerOpenChange(false)}
          onAdd={(s) =>
            addRule.mutate(s.body, {
              onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-skills-view', agentId] }),
            })
          }
        />
      )}
    </div>
  )
}
