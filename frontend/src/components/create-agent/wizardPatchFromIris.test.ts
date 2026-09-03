import { wizardPatchFromIris } from './wizardPatchFromIris'

test('update_agent_basics maps displayName', () => {
  expect(wizardPatchFromIris('update_agent_basics', { displayName: 'Acme Support' })).toEqual({
    displayName: 'Acme Support',
  })
})

test('update_business_persona maps tone and sample reply', () => {
  expect(
    wizardPatchFromIris('update_business_persona', {
      tone: 'friendly-shopkeeper',
      personaSampleReply: 'Hey!',
    }),
  ).toEqual({ personaPreset: 'friendly-shopkeeper', personaSampleReply: 'Hey!' })
})

test('create_skill returns empty patch', () => {
  expect(wizardPatchFromIris('create_skill', { title: 'x' })).toEqual({})
})
