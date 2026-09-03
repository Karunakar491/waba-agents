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
  ).toEqual({ personaPreset: 'Friendly shopkeeper', personaSampleReply: 'Hey!' })
})

test('update_business_persona accepts preset title as tone', () => {
  expect(
    wizardPatchFromIris('update_business_persona', {
      tone: 'Friendly shopkeeper',
    }),
  ).toEqual({ personaPreset: 'Friendly shopkeeper' })
})

test('update_business_persona ignores unknown tone but keeps sample reply', () => {
  expect(
    wizardPatchFromIris('update_business_persona', {
      tone: 'not-a-preset',
      personaSampleReply: 'Hey!',
    }),
  ).toEqual({ personaSampleReply: 'Hey!' })
})

test('create_skill returns empty patch', () => {
  expect(wizardPatchFromIris('create_skill', { title: 'x' })).toEqual({})
})
