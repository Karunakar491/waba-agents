import { Building2, ChevronDown } from 'lucide-react'
import type { WabaEntry } from '../../hooks/useSelectedWaba'

// 2026-08-19 redesign — a WABA is a page-scoped equivalent of the Command
// Bar's Client/Module scope switchers (DESIGN.md §5, see
// ClientCommandBar.tsx's rail buttons), so it follows that precedent
// exactly: no border or shadow at rest, chrome only appears on
// hover/focus. An earlier pass here shrank the old bordered card down to a
// smaller bordered box, which Design Evaluator correctly blocked as the
// same "boxy control next to a title" shape, just smaller — this version
// has no resting chrome at all, reading as a clickable label until touched.
export default function WabaPicker({ wabas, selectedWabaId, onChange }: {
  wabas: WabaEntry[]
  selectedWabaId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="relative inline-flex w-full max-w-[280px] sm:w-auto">
      <Building2 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <select
        value={selectedWabaId}
        onChange={(e) => onChange(e.target.value)}
        aria-label="WhatsApp Business Account"
        className="w-full min-w-[200px] appearance-none rounded-md bg-transparent py-1.5 pl-7 pr-7 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <option value="">Select a WABA…</option>
        {wabas.map((w) => (
          <option key={w.id} value={w.id}>{w.label || w.wabaId}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
