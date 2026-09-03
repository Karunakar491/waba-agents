export type QueryKey = readonly unknown[]

export function queryKeysForIrisTool(
  toolName: string,
  agentId: string,
  wabaId: string,
): QueryKey[] {
  switch (toolName) {
    case 'create_skill':
    case 'update_skill':
    case 'delete_skill':
      return [
        ['agent-skills-view', agentId],
        ['skills', wabaId],
      ]
    case 'create_ui_skill':
    case 'update_ui_skill':
    case 'delete_ui_skill':
      return [['agent-ui-skills', agentId]]
    case 'create_faq':
    case 'update_faq':
    case 'delete_faq':
      return [['agent-faqs', agentId]]
    case 'add_knowledge_website':
    case 'update_knowledge_website':
    case 'delete_knowledge_website':
      return [['agent-websites', agentId]]
    case 'create_connector':
    case 'update_connector':
    case 'delete_connector':
    case 'create_connector_tool':
    case 'run_connector_tool':
      return [
        ['agent-connectors', agentId],
        ['connector-library', wabaId],
      ]
    default:
      return []
  }
}
