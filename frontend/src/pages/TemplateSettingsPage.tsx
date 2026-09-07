import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import ConsequenceLine from '../components/shared/ConsequenceLine'
import WabaSettingsSection from '../components/templatestudio/settings/WabaSettingsSection'
import AiProviderPanel from '../components/templatestudio/AiProviderPanel'

/**
 * Template Studio Settings (V2 rebrand slice 6, Figma node 83:2) —
 * decomposed from an 870-line single file per an EM-approved plan:
 * WabaSettingsSection (+ WabaBlock, PhoneMappingRow, AddWabaPanel) and
 * AiProviderPanel now own their own logic. The old collapsed "Advanced —
 * API activity log" panel is REMOVED, not migrated — it isn't in the
 * Figma spec, and slice 4f already built a full dedicated Debug page
 * (/templates/debug) that does the same job with search/filters/WABA
 * picker. Duplicating it here would be exactly the kind of reinvented
 * primitive DESIGN.md's reuse discipline bans.
 */
export default function TemplateSettingsPage() {
  const { wabas, isLoading: wabasLoading } = useSelectedWaba()

  if (wabasLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect WABAs, map Karix credentials per phone, then set Iris's AI key.
        </p>
        <div className="mt-2 space-y-1">
          <ConsequenceLine>
            Nothing is sent to Meta or Karix until you save a mapping.
          </ConsequenceLine>
          <p className="text-xs text-muted-foreground">
            Need to check a raw API call?{' '}
            <Link to="/templates/debug" className="font-medium text-accent-teal-solid hover:underline">
              Open Debug
            </Link>
          </p>
        </div>
      </div>

      <WabaSettingsSection wabas={wabas} />
      <AiProviderPanel />
    </div>
  )
}
