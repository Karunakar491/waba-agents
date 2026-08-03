import { Loader2, Megaphone } from 'lucide-react'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import WabaPicker from '../components/templatestudio/WabaPicker'

// Campaigns section of Template Studio (2026-08-04 nav split). Placeholder —
// PM+EM approved build order puts the campaigns schema/async-job/karix-mcp
// bulk-send endpoint and the chat-based launch flow AFTER this nav split
// lands, not alongside it. Nothing here calls Karix yet.
export default function TemplateCampaignsPage() {
  const { wabas, isLoading: wabasLoading, selectedWabaId, setSelectedWabaId } = useSelectedWaba()

  if (wabasLoading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an approved template to a list of recipients.
        </p>
      </div>

      <WabaPicker wabas={wabas} selectedWabaId={selectedWabaId} onChange={setSelectedWabaId} />

      {selectedWabaId && (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center space-y-2">
          <Megaphone className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Campaigns is being built next</p>
          <p className="text-xs text-muted-foreground">
            Bulk sending, recipient lists, and a chat-based launch flow are in progress — this page will go live
            here once ready.
          </p>
        </div>
      )}
    </div>
  )
}
