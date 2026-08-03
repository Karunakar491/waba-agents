import type { WabaEntry } from '../../hooks/useSelectedWaba'

export default function WabaPicker({ wabas, selectedWabaId, onChange }: {
  wabas: WabaEntry[]
  selectedWabaId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <label className="block text-sm font-medium text-foreground mb-1.5">WABA</label>
      <select
        value={selectedWabaId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
      >
        <option value="">Select a WABA…</option>
        {wabas.map((w) => (
          <option key={w.id} value={w.id}>{w.label || w.wabaId}</option>
        ))}
      </select>
    </div>
  )
}
