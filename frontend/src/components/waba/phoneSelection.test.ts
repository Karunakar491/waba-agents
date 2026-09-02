// jest's describe/it/expect are ambient globals (per jest.config.cjs) — no import needed, matching this project's jest convention.
import { isPhoneConnected, isPhoneSelectable, phoneStatusLabel, hasSelectablePhone } from './phoneSelection'
import type { LabeledPhone } from './phoneSelection'

const connected: LabeledPhone = {
  status: 'CONNECTED',
  alreadyConnected: false,
  connectedAgentName: null,
  verifiedName: 'Acme Store',
}

describe('isPhoneConnected', () => {
  it('is true only for the exact string CONNECTED', () => {
    expect(isPhoneConnected({ status: 'CONNECTED' })).toBe(true)
  })

  it('is false for PENDING', () => {
    expect(isPhoneConnected({ status: 'PENDING' })).toBe(false)
  })

  it('is false for an unrecognized status Meta might introduce later', () => {
    expect(isPhoneConnected({ status: 'RESTRICTED' })).toBe(false)
  })

  it('is false when the field is missing entirely (fails closed, not open)', () => {
    expect(isPhoneConnected({ status: '' })).toBe(false)
  })
})

describe('isPhoneSelectable', () => {
  it('is true for a CONNECTED number not already bound to another agent', () => {
    expect(isPhoneSelectable(connected)).toBe(true)
  })

  it('is false for a PENDING number even if nothing else is using it', () => {
    expect(isPhoneSelectable({ ...connected, status: 'PENDING' })).toBe(false)
  })

  it('is false for a CONNECTED number that is already bound to another agent', () => {
    expect(isPhoneSelectable({ ...connected, alreadyConnected: true })).toBe(false)
  })

  it('is false when both conditions fail', () => {
    expect(isPhoneSelectable({ ...connected, status: 'PENDING', alreadyConnected: true })).toBe(false)
  })
})

describe('phoneStatusLabel', () => {
  it('shows the verified name for a selectable CONNECTED number', () => {
    expect(phoneStatusLabel(connected)).toBe('Acme Store')
  })

  it('explains the pending state in plain language, never the raw status code', () => {
    const label = phoneStatusLabel({ ...connected, status: 'PENDING' })
    expect(label).toBe('Still connecting on WhatsApp — try again shortly')
    expect(label).not.toMatch(/PENDING/)
  })

  it('prioritizes the already-connected message over the not-ready message', () => {
    const label = phoneStatusLabel({ ...connected, status: 'PENDING', alreadyConnected: true, connectedAgentName: 'Support Bot' })
    expect(label).toBe('Already connected to Support Bot')
  })

  it('falls back to a generic phrase when the connected agent name is unknown', () => {
    expect(phoneStatusLabel({ ...connected, alreadyConnected: true, connectedAgentName: null }))
      .toBe('Already connected to another agent')
  })
})

describe('hasSelectablePhone', () => {
  it('is false for an empty list', () => {
    expect(hasSelectablePhone([])).toBe(false)
  })

  it('is false when every number is PENDING', () => {
    expect(hasSelectablePhone([
      { status: 'PENDING', alreadyConnected: false },
      { status: 'PENDING', alreadyConnected: false },
    ])).toBe(false)
  })

  it('is false when the only CONNECTED number is already bound elsewhere', () => {
    expect(hasSelectablePhone([{ status: 'CONNECTED', alreadyConnected: true }])).toBe(false)
  })

  it('is true when at least one number is CONNECTED and free', () => {
    expect(hasSelectablePhone([
      { status: 'PENDING', alreadyConnected: false },
      { status: 'CONNECTED', alreadyConnected: false },
    ])).toBe(true)
  })
})
