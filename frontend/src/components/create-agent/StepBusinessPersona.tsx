import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import {
  BottomBar,
  FilledByIrisBadge,
  LinkAction,
  SectionCard,
  StepHeader,
  TextField,
} from './WizardChrome'
import {
  PERSONA_PRESETS,
  type BusinessInfo,
  type PersonaPreset,
  type WizardState,
} from './wizardTypes'

interface BusinessProfileResponse {
  id: string
  paymentMethod: string | null
  returnPolicy: string | null
  purchaseInfo: string | null
  deliveryAndShipping: string | null
  businessDescription: string | null
  contactEmail: string | null
  contactHoursOfOperation: string | null
  contactAddress: string | null
}

/**
 * Screen: Create Agent — Step 2, Business Persona (Figma node 206:2)
 *
 * 1. USER GOAL: Decide how the agent sounds, and give it the handful of
 *    facts it needs to actually answer a customer.
 * 2. EMOTIONAL STATE: This is the step where "an AI agent" stops being
 *    abstract — the sample replies make the choice concrete before it's made.
 * 3. POSSIBLE ACTIONS: Pick a tone card, edit the wording, fill the details
 *    by hand or let Iris fill them, import a saved persona, save this one.
 * 4. HOW WE HELP: Every tone card renders the real reply it produces, and
 *    the consequence line says nothing is saved until the wizard finishes.
 */
export default function StepBusinessPersona({
  state,
  onChange,
  onBack,
  onNext,
  busy,
}: {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
  busy: boolean
}) {
  const [importOpen, setImportOpen] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  const { data: drafts = [] } = useQuery<BusinessProfileResponse[]>({
    queryKey: ['business-profile-drafts'],
    queryFn: () => api.get('/business-profiles/drafts').then((r) => r.data.data),
    enabled: importOpen,
  })

  function setInfo(key: keyof BusinessInfo, value: string) {
    onChange({
      businessInfo: { ...state.businessInfo, [key]: value },
      // An operator edit takes the field back from Iris — the badge must
      // never outlive the fact it describes.
      filledByIris: state.filledByIris.filter((k) => k !== key),
    })
  }

  function choosePreset(preset: PersonaPreset) {
    onChange({ personaPreset: preset.title, personaSampleReply: preset.sampleReply })
  }

  function importDraft(d: BusinessProfileResponse) {
    onChange({
      businessProfileId: d.id,
      filledByIris: [],
      businessInfo: {
        contactHoursOfOperation: d.contactHoursOfOperation ?? '',
        contactAddress: d.contactAddress ?? '',
        contactEmail: d.contactEmail ?? '',
        paymentMethod: d.paymentMethod ?? '',
        deliveryAndShipping: d.deliveryAndShipping ?? '',
        returnPolicy: d.returnPolicy ?? '',
        purchaseInfo: d.purchaseInfo ?? '',
        businessDescription: d.businessDescription ?? '',
      },
    })
    setImportOpen(false)
  }

  async function saveToLibrary() {
    setSaveNote(null)
    try {
      const body = { ...state.businessInfo }
      const r = state.businessProfileId
        ? await api.put(`/business-profiles/draft/${state.businessProfileId}`, body)
        : await api.post('/business-profiles/draft', body)
      onChange({ businessProfileId: String(r.data.data.id) })
      setSaveNote('Saved to your Business Persona library.')
    } catch (err) {
      setSaveNote(extractErrorMessage(err))
    }
  }

  const badgeFor = (key: keyof BusinessInfo) =>
    state.filledByIris.includes(key) ? <FilledByIrisBadge /> : undefined

  return (
    <>
      <StepHeader
        title="What's its business persona?"
        subtitle="Pick a starting tone, then fill in the details your agent needs to actually answer questions — hours, payment, delivery, returns."
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-foreground">Choose a starting tone</h2>
          <div className="flex items-center gap-4">
            <LinkAction onClick={() => setImportOpen((o) => !o)}>Import from Library</LinkAction>
            <span className="text-sm text-muted-foreground">·</span>
            <LinkAction onClick={() => void saveToLibrary()}>+ Save to Library</LinkAction>
          </div>
        </div>

        {importOpen && (
          <SectionCard
            title="Saved personas"
            description={
              drafts.length === 0
                ? 'Nothing saved yet — fill this step in and use “Save to Library” to reuse it on the next agent.'
                : 'Pick one to fill every detail field below.'
            }
          >
            {drafts.length > 0 && (
              <ul className="divide-y">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                    <p className="min-w-0 truncate text-sm text-foreground">
                      {d.businessDescription || d.contactHoursOfOperation || 'Untitled persona'}
                    </p>
                    <LinkAction onClick={() => importDraft(d)}>Use this</LinkAction>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {PERSONA_PRESETS.map((p) => {
            const selected = state.personaPreset === p.title
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                onClick={() => choosePreset(p)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors shadow-surface-resting',
                  selected ? 'border-accent-teal-solid bg-accent-teal/5' : 'bg-card hover:border-accent-teal',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.subtitle}</p>
                  </div>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-accent-teal-solid bg-accent-teal-solid' : 'border-border',
                    )}
                  >
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </span>
                </div>

                {/* DESIGN.md §6 live-preview snippet — the card claims a sample
                    reply, so it renders the real WhatsApp bubble, not a stand-in. */}
                <div className="mt-4 overflow-hidden rounded-lg border">
                  <div className="flex items-center gap-3 bg-whatsapp-header px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    <span className="text-xs text-white">Sample reply</span>
                  </div>
                  <div className="bg-whatsapp-canvas p-3">
                    <p className="rounded-lg bg-white px-3 py-2 text-xs text-whatsapp-ink">
                      {p.sampleReply}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {state.personaPreset && (
          <SectionCard>
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-accent-teal-solid" />
              <p className="text-sm font-medium text-foreground">
                Based on “{state.personaPreset}” — edit freely
              </p>
            </div>
            <textarea
              rows={3}
              value={state.personaSampleReply}
              maxLength={4000}
              onChange={(e) => onChange({ personaSampleReply: e.target.value })}
              aria-label="Starting style"
              className="w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm text-foreground transition-colors focus-visible:border-accent-teal-solid"
            />
            <p className="text-xs text-muted-foreground">
              This exact wording is what your agent will use as a starting style — nothing is saved
              until you finish this wizard.
            </p>
          </SectionCard>
        )}

        <SectionCard title="Contact & hours">
          <TextField
            id="bp-hours"
            label="Hours of operation"
            badge={badgeFor('contactHoursOfOperation')}
            value={state.businessInfo.contactHoursOfOperation}
            onChange={(v) => setInfo('contactHoursOfOperation', v)}
            placeholder="e.g., Mon–Sat, 9am–6pm"
          />
          <TextField
            id="bp-address"
            label="Address"
            badge={badgeFor('contactAddress')}
            value={state.businessInfo.contactAddress}
            onChange={(v) => setInfo('contactAddress', v)}
            placeholder="e.g., 12 MG Road, Andheri, Mumbai"
          />
          <TextField
            id="bp-email"
            label="Email"
            type="email"
            badge={badgeFor('contactEmail')}
            value={state.businessInfo.contactEmail}
            onChange={(v) => setInfo('contactEmail', v)}
            placeholder="e.g., support@yourbusiness.com"
          />
        </SectionCard>

        <SectionCard title="How customers buy from you">
          <TextField
            id="bp-payment"
            label="Payment methods"
            badge={badgeFor('paymentMethod')}
            value={state.businessInfo.paymentMethod}
            onChange={(v) => setInfo('paymentMethod', v)}
            placeholder="e.g., UPI, Cash on Delivery"
          />
          <TextField
            id="bp-delivery"
            label="Delivery & shipping"
            badge={badgeFor('deliveryAndShipping')}
            value={state.businessInfo.deliveryAndShipping}
            onChange={(v) => setInfo('deliveryAndShipping', v)}
            placeholder="e.g., 2–4 business days across India"
          />
          <TextField
            id="bp-returns"
            label="Return policy"
            badge={badgeFor('returnPolicy')}
            value={state.businessInfo.returnPolicy}
            onChange={(v) => setInfo('returnPolicy', v)}
            placeholder="e.g., Returns accepted within 7 days"
          />
          <TextField
            id="bp-purchase"
            label="How to purchase"
            badge={badgeFor('purchaseInfo')}
            value={state.businessInfo.purchaseInfo}
            onChange={(v) => setInfo('purchaseInfo', v)}
            placeholder="e.g., Order via this WhatsApp number or our website"
          />
        </SectionCard>

        <SectionCard title="About your business">
          <TextField
            id="bp-description"
            label="Business description"
            badge={badgeFor('businessDescription')}
            value={state.businessInfo.businessDescription}
            onChange={(v) => setInfo('businessDescription', v)}
            placeholder="e.g., We sell handmade candles and home decor"
          />
        </SectionCard>

        {saveNote && <p className="text-sm text-muted-foreground">{saveNote}</p>}
      </div>

      <BottomBar onBack={onBack} onNext={onNext} busy={busy} />
    </>
  )
}
