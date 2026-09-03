import { PERSONA_PRESETS, type WizardState } from './wizardTypes'

function personaPresetTitleFromTone(tone: string): string | undefined {
  const preset = PERSONA_PRESETS.find((p) => p.id === tone || p.title === tone)
  return preset?.title
}

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
    if (typeof args.tone === 'string') {
      const title = personaPresetTitleFromTone(args.tone)
      if (title !== undefined) patch.personaPreset = title
    }
    if (typeof args.personaSampleReply === 'string') patch.personaSampleReply = args.personaSampleReply
    return patch
  }
  return {}
}
