import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Loader2, RotateCcw } from 'lucide-react'

/**
 * Collapsed-by-default Drafts list shared by Skills, UI Skills, and FAQ —
 * extracted per EL gate (3+ near-identical instances of this exact markup
 * in one diff). Each caller supplies how to render an item's primary/
 * secondary text; the disclosure chrome, count badge, and Republish button
 * stay identical everywhere.
 */
export default function DraftsDisclosure<T extends { id: string }>({
  items,
  renderPrimary,
  renderSecondary,
  onRepublish,
  isPending,
}: {
  items: T[]
  renderPrimary: (item: T) => ReactNode
  renderSecondary: (item: T) => ReactNode
  onRepublish: (id: string) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border bg-muted/20 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold text-foreground">Drafts</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </button>
      {open && (
        <ul className="divide-y border-t">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{renderPrimary(item)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{renderSecondary(item)}</p>
              </div>
              <button
                onClick={() => onRepublish(item.id)}
                disabled={isPending}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs
                  font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Republish
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
