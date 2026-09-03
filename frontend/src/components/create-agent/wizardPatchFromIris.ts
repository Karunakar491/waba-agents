import type { WizardState } from './wizardTypes'

export function wizardPatchFromIris(
  toolName: string,
  args: Record<string, unknown>,
): Partial<WizardState> {
  if (toolName === 'update_agent_basics') {
    const patch: Partial<WizardState> = {}
    if (typeof args.displayName === 'string') patch.displayName = args.displayName
    return patch
  }
  if (toolName === 'update_business_persona') {
    const patch: Partial<WizardState> = {}
    if (typeof args.tone === 'string') patch.personaPreset = args.tone
    if (typeof args.personaSampleReply === 'string') patch.personaSampleReply = args.personaSampleReply
    return patch
  }
  return {}
}
