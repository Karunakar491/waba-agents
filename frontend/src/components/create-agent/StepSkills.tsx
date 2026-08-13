import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Library, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import {
  BottomBar,
  LinkAction,
  SectionCard,
  SelectField,
  StepHeader,
  TextField,
  WizardToggle,
} from './WizardChrome'
import SkillsLibraryDrawer from './SkillsLibraryDrawer'

export interface LibrarySkill {
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
  source: 'AGENT' | 'LIBRARY'
  title: string
  description: string
  body: string
  status: string
  librarySkillId: string | null
}

interface UiSkill {
  id: string
  title: string
  componentType: string
  instruction: string
  status: 'enabled' | 'disabled'
}

/**
 * Figma's five chips, mapped onto the component types the backend actually
 * accepts (AgentUiSkill.ComponentType). "Flow" has no backend type and no
 * flow_id column — it stays disabled with Figma's own reason, rather than
 * being drawn as if it worked.
 */
const COMPONENT_CHIPS: { label: string; type: string | null; note?: string }[] = [
  { label: 'Carousel', type: 'carousel_url' },
  { label: 'CTA button', type: 'cta_url' },
  { label: 'Interactive list', type: 'interactive_list' },
  { label: 'Location request', type: 'location_request' },
  { label: 'Flow', type: null, note: 'Needs a published flow' },
]

const COMPONENT_TYPES = [
  'carousel_quick_reply',
  'carousel_url',
  'cta_url',
  'image',
  'interactive_list',
  'location',
  'location_request',
]

const CHIP_INSTRUCTION_PLACEHOLDER: Record<string, string> = {
  carousel_url:
    'e.g. When the customer asks to browse products, show up to 3 matching items with images and prices.',
  cta_url: 'e.g. After confirming an order, include a button linking to the tracking page.',
  interactive_list: 'e.g. When the customer asks what you sell, list your top categories.',
  location_request: 'e.g. When a delivery address is missing, ask the customer to share a location.',
}

/**
 * Screen: Create Agent — Step 4, Skills (Figma nodes 218:2 and 289:2)
 *
 * 1. USER GOAL: Two separate things — the plain-language rules the agent
 *    always follows, and the richer message shapes it may send.
 * 2. EMOTIONAL STATE: Confident about the rules (they know their business),
 *    unsure about the components (Meta's vocabulary, not theirs).
 * 3. POSSIBLE ACTIONS: Write a rule, import one from the library, save one
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
  const { data: librarySkills = [] } = useQuery<LibrarySkill[]>({
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
    librarySkills.forEach((s) => map.set(s.id, s.deployments?.length ?? 0))
    return map
  }, [librarySkills])

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
                  icon={<Library className="h-4 w-4" />}
                  disabled={!wabaId}
                >
                  Import from Library
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
                      {r.source === 'LIBRARY' && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          From Skills Library · used by{' '}
                          {Math.max(0, (usedByCount.get(r.librarySkillId ?? '') ?? 1) - 1)} other
                          agents
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {r.source === 'AGENT' && (
                        <LinkAction onClick={() => promoteRule.mutate(r.id)}>
                          + Save to Library
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
                  key={c.label}
                  type="button"
                  disabled={!c.type || !enabled}
                  aria-pressed={activeChip === c.type}
                  title={c.note}
                  onClick={() => {
                    setActiveChip(c.type)
                    setChipInstruction('')
                    setFormOpen(false)
                  }}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-left text-sm transition-colors',
                    activeChip === c.type
                      ? 'border-accent-teal-solid bg-accent-teal/10 font-medium text-accent-teal-solid'
                      : 'text-foreground hover:border-accent-teal',
                    !c.type && 'cursor-not-allowed text-muted-foreground hover:border-border',
                  )}
                >
                  {c.label}
                  {c.note && <span className="mt-1 block text-xs">{c.note}</span>}
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
                  {COMPONENT_CHIPS.find((c) => c.type === activeChip)?.label} — configuration
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  When should it send this?
                </p>
                <input
                  value={chipInstruction}
                  onChange={(e) => setChipInstruction(e.target.value)}
                  maxLength={1024}
                  aria-label="When should it send this?"
                  placeholder={CHIP_INSTRUCTION_PLACEHOLDER[activeChip]}
                  className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent-teal-solid"
                />
                <button
                  type="button"
                  disabled={!chipInstruction.trim() || addUiSkill.isPending}
                  onClick={() =>
                    addUiSkill.mutate({
                      title: COMPONENT_CHIPS.find((c) => c.type === activeChip)!.label,
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
                  label="Component type"
                  apiName="component_type"
                  value={form.componentType}
                  onChange={(v) => setForm((f) => ({ ...f, componentType: v }))}
                  options={COMPONENT_TYPES.map((t) => ({ value: t, label: t }))}
                  placeholder="Select a type…"
                />
                <TextField
                  id="ui-instruction"
                  label="Instruction — when should this send?"
                  apiName="instruction"
                  value={form.instruction}
                  onChange={(v) => setForm((f) => ({ ...f, instruction: v }))}
                  placeholder="e.g. When a customer asks about order status, show tracking as a carousel."
                  maxLength={1024}
                />
                <SelectField
                  id="ui-flow"
                  label="Flow"
                  apiName="flow_id"
                  value=""
                  onChange={() => undefined}
                  options={[]}
                  disabled
                  placeholder="Flow components aren't supported yet"
                  hint="Meta's Flow component type isn't accepted by this platform yet — nothing to pick here."
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
        <SkillsLibraryDrawer
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
