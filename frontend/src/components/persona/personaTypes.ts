import type { BusinessProfileResponse } from '../agent-detail/BusinessProfileTab'

// One row per profile, across every phone number this account can see —
// PM+EM gate (2026-07-30): drop the "Agent" column from the original ask,
// since BusinessProfile is 1:1 with a phone number, not multi-attached to
// agents the way Skills is. "Which number" and "Last touched" are the real
// relationships this data actually has.
export interface PersonaRow {
  profile: BusinessProfileResponse
  displayPhoneNumber: string | null
  lastTouched: string | null
}
