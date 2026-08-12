import { Building2, ChevronDown } from 'lucide-react'
import type { WabaEntry } from '../../hooks/useSelectedWaba'

// Figma node 34:2 ("WabaSelectorRow") — restyled 2026-08-12 to match the
// real spec exactly: a labeled card with an icon+select control and a
// plain-language scoping note, not the old bare label+select.
export default function WabaPicker({ wabas, selectedWabaId, onChange }: {
  wabas: WabaEntry[]
  selectedWabaId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-5 shadow-surface-resting">
      <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">WHATSAPP BUSINESS ACCOUNT</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-[340px]">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={selectedWabaId}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-lg bg-muted px-9 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
          >
            <option value="">Select a WABA…</option>
            {wabas.map((w) => (
              <option key={w.id} value={w.id}>{w.label || w.wabaId}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Templates below are scoped to this account.</p>
      </div>
    </div>
  )
}
