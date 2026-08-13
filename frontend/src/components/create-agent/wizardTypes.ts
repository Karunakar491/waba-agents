/**
 * Shared types + constants for the 7-step Create Agent wizard
 * (Figma 8.3–8.9, nodes 217:16 / 206:2 / 213:2 / 218:2 / 252:35 / 218:253 / 215:10).
 *
 * The wizard writes to four separate backends, deliberately kept apart here
 * rather than merged into one blob, because each has its own lifecycle:
 *   - agent            POST/PUT /agents            (Basics, persona style)
 *   - business profile POST/PUT /business-profiles (Business Persona details)
 *   - agent children   /agents/{id}/faq|files|websites|skills|ui-skills|connectors
 *   - eval + test      /reports/agents/{id}/eval, /agents/{id}/test
 */

export const WIZARD_STEPS = [
  'Basics',
  'Business Persona',
  'Knowledge Base',
  'Skills',
  'Connectors',
  'Evals',
  'Test & Deploy',
] as const

export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Figma 8.4 — the four starting tones, with the exact sample reply each shows. */
export interface PersonaPreset {
  id: string
  title: string
  subtitle: string
  sampleReply: string
}

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'friendly-shopkeeper',
    title: 'Friendly shopkeeper',
    subtitle: 'Warm, casual, like talking to a person',
    sampleReply: "Hey! Yep, we've got that in stock 😊 Want me to hold one for you?",
  },
  {
    id: 'straight-to-the-point',
    title: 'Straight to the point',
    subtitle: 'Short, efficient, no small talk',
    sampleReply: 'Yes, in stock. 3 units available. Reply ORDER to buy.',
  },
  {
    id: 'formal-professional',
    title: 'Formal & professional',
    subtitle: 'Polished, business-like tone',
    sampleReply:
      'Thank you for your inquiry. The item is currently in stock and available for purchase.',
  },
  {
    id: 'warm-reassuring',
    title: 'Warm & reassuring',
    subtitle: 'Extra caring, good for sensitive topics',
    sampleReply:
      "I understand, and I'm here to help sort this out with you. Let's take it step by step.",
  },
]

/** The eight Business Persona detail fields, in Figma's card order. */
export interface BusinessInfo {
  contactHoursOfOperation: string
  contactAddress: string
  contactEmail: string
  paymentMethod: string
  deliveryAndShipping: string
  returnPolicy: string
  purchaseInfo: string
  businessDescription: string
}

export const EMPTY_BUSINESS_INFO: BusinessInfo = {
  contactHoursOfOperation: '',
  contactAddress: '',
  contactEmail: '',
  paymentMethod: '',
  deliveryAndShipping: '',
  returnPolicy: '',
  purchaseInfo: '',
  businessDescription: '',
}

export const BUSINESS_INFO_FIELD_COUNT = 8

export function filledBusinessInfoCount(info: BusinessInfo): number {
  return Object.values(info).filter((v) => v.trim().length > 0).length
}

export interface WizardState {
  agentId: string | null
  /** Internal name — customers never see this (Figma 8.3). */
  displayName: string
  /** Internal waba.id of the WABA the selected phone belongs to. */
  wabaId: string
  /** Meta phone_number_id, bound via PUT /agents/{id}/phone. */
  phoneNumberId: string
  /** Human-readable "+91 90100 55210 · Karix_Global_Production" for summaries. */
  phoneLabel: string
  /** Preset label, e.g. "Friendly shopkeeper" — persisted as agent.tone. */
  personaPreset: string
  /** Edited sample reply — persisted as agent.personaSampleReply. */
  personaSampleReply: string
  businessInfo: BusinessInfo
  /** Which business-info fields Iris filled, so the badge is never claimed falsely. */
  filledByIris: (keyof BusinessInfo)[]
  /** Saved business_profile draft id, so re-saving updates instead of duplicating. */
  businessProfileId: string | null
  enabled: boolean
}

export const EMPTY_WIZARD_STATE: WizardState = {
  agentId: null,
  displayName: '',
  wabaId: '',
  phoneNumberId: '',
  phoneLabel: '',
  personaPreset: '',
  personaSampleReply: '',
  businessInfo: EMPTY_BUSINESS_INFO,
  filledByIris: [],
  businessProfileId: null,
  enabled: false,
}

export interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

export interface PhoneEntry {
  phoneNumberId: string
  displayPhoneNumber: string
  verifiedName: string | null
}
