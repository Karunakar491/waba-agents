import { queryKeysForIrisTool } from './irisQueryKeys'

test('create_skill invalidates skills views', () => {
  expect(queryKeysForIrisTool('create_skill', 'agent-1', 'waba-1')).toEqual([
    ['agent-skills-view', 'agent-1'],
    ['skills', 'waba-1'],
  ])
})

test('list_faqs does not invalidate', () => {
  expect(queryKeysForIrisTool('list_faqs', 'agent-1', 'waba-1')).toEqual([])
})

test('update_agent_basics has no query keys (wizard state patch instead)', () => {
  expect(queryKeysForIrisTool('update_agent_basics', 'agent-1', 'waba-1')).toEqual([])
})

test('update_skill and delete_skill share skill query keys', () => {
  const expected = [
    ['agent-skills-view', 'agent-1'],
    ['skills', 'waba-1'],
  ]
  expect(queryKeysForIrisTool('update_skill', 'agent-1', 'waba-1')).toEqual(expected)
  expect(queryKeysForIrisTool('delete_skill', 'agent-1', 'waba-1')).toEqual(expected)
})

test('create_ui_skill invalidates ui-skills', () => {
  expect(queryKeysForIrisTool('create_ui_skill', 'agent-1', 'waba-1')).toEqual([
    ['agent-ui-skills', 'agent-1'],
  ])
})

test('create_faq invalidates faqs', () => {
  expect(queryKeysForIrisTool('create_faq', 'agent-1', 'waba-1')).toEqual([
    ['agent-faqs', 'agent-1'],
  ])
})

test('add_knowledge_website invalidates websites', () => {
  expect(queryKeysForIrisTool('add_knowledge_website', 'agent-1', 'waba-1')).toEqual([
    ['agent-websites', 'agent-1'],
  ])
})

test('create_connector invalidates connectors and library', () => {
  expect(queryKeysForIrisTool('create_connector', 'agent-1', 'waba-1')).toEqual([
    ['agent-connectors', 'agent-1'],
    ['connector-library', 'waba-1'],
  ])
})

test('run_connector_tool invalidates connectors only', () => {
  expect(queryKeysForIrisTool('run_connector_tool', 'agent-1', 'waba-1')).toEqual([
    ['agent-connectors', 'agent-1'],
  ])
})

test('update_business_persona does not invalidate', () => {
  expect(queryKeysForIrisTool('update_business_persona', 'agent-1', 'waba-1')).toEqual([])
})
