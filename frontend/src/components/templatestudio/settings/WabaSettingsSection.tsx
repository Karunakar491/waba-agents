import { useEffect, useRef, useState } from 'react'
import type { WabaEntry } from '../../../hooks/useSelectedWaba'
import WabaBlock from './WabaBlock'
import AddWabaPanel from './AddWabaPanel'

// "Connected WABAs" card — extracted from TemplateSettingsPage.tsx (V2
// rebrand slice 6, Figma node 84:2).
export default function WabaSettingsSection({ wabas }: { wabas: WabaEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const didAutoExpand = useRef(false)

  useEffect(() => {
    if (showAdd || didAutoExpand.current || wabas.length === 0) return
    if (!expandedId) {
      setExpandedId(wabas[0].id)
      didAutoExpand.current = true
    }
  }, [wabas, expandedId, showAdd])

  return (
    <section className="w-full space-y-4 rounded-2xl border bg-card p-5 shadow-surface-resting">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">CONNECTED WABAS</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {wabas.length === 0
              ? 'No WhatsApp accounts connected yet'
              : `${wabas.length} WABA${wabas.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {wabas.length > 0 && !showAdd && (
          <button
            type="button"
            onClick={() => { setShowAdd(true); setExpandedId(null) }}
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            + Add WABA
          </button>
        )}
      </div>

      {wabas.length === 0 && !showAdd && (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-muted px-4 py-12 text-center">
          <h3 className="text-base font-semibold text-foreground">No WhatsApp accounts connected yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add a WABA ID to fetch phone numbers from Meta and map Karix credentials.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-5 rounded-lg bg-accent-teal-solid px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            Add WABA
          </button>
        </div>
      )}

      {showAdd && (
        <AddWabaPanel
          onDone={(internalId) => { setShowAdd(false); setExpandedId(internalId) }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {wabas.map((waba) => (
        <WabaBlock
          key={waba.id}
          waba={waba}
          expanded={expandedId === waba.id}
          onToggle={() => setExpandedId(expandedId === waba.id ? null : waba.id)}
        />
      ))}
    </section>
  )
}
