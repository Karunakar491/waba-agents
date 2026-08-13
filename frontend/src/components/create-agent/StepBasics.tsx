import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '../../lib/api'
import { BottomBar, SectionCard, SelectField, StepHeader, TextField } from './WizardChrome'
import type { PhoneEntry, WabaEntry, WizardState } from './wizardTypes'

/**
 * Screen: Create Agent — Step 1, Basics (Figma node 217:16)
 *
 * 1. USER GOAL: Point this agent at one real WhatsApp number and give it a
 *    name their team will recognise.
 * 2. EMOTIONAL STATE: Starting something they're not sure they can finish —
 *    so this step asks for exactly two things and nothing else.
 * 3. POSSIBLE ACTIONS: Pick a number, name it, continue, or cancel out
 *    entirely (nothing is created until Next Step).
 * 4. HOW WE HELP: Eligibility is answered before they invest any more time,
 *    and the name field says outright that customers never see it.
 */
export default function StepBasics({
  state,
  onChange,
  onCancel,
  onNext,
  busy,
}: {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onCancel: () => void
  onNext: () => void
  busy: boolean
}) {
  const { data: wabas = [] } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })

  // GET /waba/{wabaId}/phones expects Meta's external WABA id, not waba.id.
  const phoneQueries = useQueries({
    queries: wabas.map((w) => ({
      queryKey: ['waba-phones', w.id],
      queryFn: () =>
        api.get(`/waba/${w.wabaId}/phones`).then((r) => (r.data.data ?? []) as PhoneEntry[]),
    })),
  })

  // Numbers already bound to another agent can't be bound again — the unique
  // index on agent.phone_number_id rejects it server-side, so say so here
  // rather than let the operator find out at the end of the wizard.
  const { data: agents = [] } = useQuery<{ phoneNumberId: string | null }[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
  })
  const takenNumbers = useMemo(
    () => new Set(agents.map((a) => a.phoneNumberId).filter(Boolean) as string[]),
    [agents],
  )

  const options = useMemo(
    () =>
      wabas.flatMap((w, i) =>
        (phoneQueries[i]?.data ?? []).map((p) => ({
          value: `${w.id}::${p.phoneNumberId}`,
          label: `${p.displayPhoneNumber} · ${w.label ?? w.wabaId}`,
        })),
      ),
    [wabas, phoneQueries],
  )

  const selectedValue =
    state.wabaId && state.phoneNumberId ? `${state.wabaId}::${state.phoneNumberId}` : ''
  const eligible = !!state.phoneNumberId && !takenNumbers.has(state.phoneNumberId)

  function selectPhone(value: string) {
    const [wabaId, phoneNumberId] = value.split('::')
    const label = options.find((o) => o.value === value)?.label ?? ''
    onChange({ wabaId: wabaId ?? '', phoneNumberId: phoneNumberId ?? '', phoneLabel: label })
  }

  const nameValid = state.displayName.trim().length >= 2

  return (
    <>
      <StepHeader
        title="Let's start with the basics"
        subtitle="Which number is this agent for? We'll check it's eligible before you go any further."
      />

      <SectionCard>
        <SelectField
          id="basics-phone"
          label="Phone number / WABA"
          value={selectedValue}
          onChange={selectPhone}
          options={options}
          placeholder={
            options.length === 0 ? 'No numbers available on your WABAs' : 'Choose a number…'
          }
        />

        {state.phoneNumberId &&
          (eligible ? (
            <p className="flex items-center gap-3 rounded-lg bg-accent-teal/10 px-4 py-3 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-teal-solid" />
              This number is eligible for a Meta Business Agent.
            </p>
          ) : (
            <p className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              This number already belongs to another agent. Pick a different one.
            </p>
          ))}

        <TextField
          id="basics-name"
          label="Give this agent an internal name"
          value={state.displayName}
          onChange={(v) => onChange({ displayName: v })}
          placeholder="e.g., Support — Mumbai"
          hint="Just for your team — customers never see this."
          maxLength={40}
        />
      </SectionCard>

      <BottomBar
        backLabel="Cancel & Return"
        onBack={onCancel}
        onNext={onNext}
        nextDisabled={!nameValid || !eligible}
        busy={busy}
      />
    </>
  )
}
