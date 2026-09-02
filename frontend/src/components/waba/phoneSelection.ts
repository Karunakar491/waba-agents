// Pure selection logic for the phone-number picker (ConnectPhoneModal.tsx),
// extracted so it's unit-testable without rendering — this repo's jest setup
// is testEnvironment 'node' with no @testing-library/react installed, so a
// component-render test isn't available; matches the existing
// toolRequestDefinition.ts / .test.ts pattern for pure-logic extraction.
//
// Root cause this exists for: a phone number still PENDING registration on
// Meta's side was previously shown as a normal, selectable option in the
// picker, and provisioning a BizAI agent on one always failed server-side on
// Meta's end (raw 500, "Could not update settings for channel"). Fail
// closed: only the exact string "CONNECTED" counts as ready — an
// unrecognized value or a missing field must never be treated as safe.

export interface SelectablePhone {
  status: string
  alreadyConnected: boolean
}

export interface LabeledPhone extends SelectablePhone {
  connectedAgentName: string | null
  verifiedName: string
}

export function isPhoneConnected(phone: Pick<SelectablePhone, 'status'>): boolean {
  return phone.status === 'CONNECTED'
}

export function isPhoneSelectable(phone: SelectablePhone): boolean {
  return !phone.alreadyConnected && isPhoneConnected(phone)
}

export function phoneStatusLabel(phone: LabeledPhone): string {
  if (phone.alreadyConnected) {
    return `Already connected to ${phone.connectedAgentName ?? 'another agent'}`
  }
  if (!isPhoneConnected(phone)) {
    return 'Still connecting on WhatsApp — try again shortly'
  }
  return phone.verifiedName
}

export function hasSelectablePhone(phones: SelectablePhone[]): boolean {
  return phones.some(isPhoneSelectable)
}
