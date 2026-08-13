import type { ReactNode } from 'react'
import StatusIndicator, { type StatusTone } from '../shared/StatusIndicator'

/**
 * Screen: Library card grids (Skills / Connectors / Business Persona)
 *
 * 1. USER GOAL: Scan everything reusable on the account and pick one to
 *    reuse, open, or finish.
 * 2. EMOTIONAL STATE: Browsing, not troubleshooting — wants to recognise an
 *    item by its own words, not decode a table of ids.
 * 3. POSSIBLE ACTIONS: open/view it, act on it (add, publish, deploy),
 *    delete it. Escape hatch: every action lives on the card, none hidden.
 * 4. HOW WE HELP: the item's own sentence is the headline; status is stated
 *    in words; the footer says how widely it is already used so "is this the
 *    one everyone uses?" is answerable without opening it.
 *
 * Figma 8.13/8.14/8.15 draw this status as a tinted pill. DESIGN.md §6 is
 * explicit that status is ALWAYS StatusIndicator (dot + plain label, no
 * tint) and that tinted pills are reserved for counts/flags — so status
 * renders as StatusIndicator here and only the tag chips carry a tint. This
 * is a deliberate divergence from the Figma pixels in favour of the system.
 */
export interface LibraryItemCardProps {
  /** The item's own words — the sentence/name the user wrote. */
  name: string
  statusLabel: string
  statusTone: StatusTone
  /** Short flags (industry, use case, tone, auth type). Empty = row omitted. */
  tags?: string[]
  /** Left-hand footer line, e.g. "Used by 12 agents" or "Not yet published". */
  usageLine: string
  /** Right-hand footer actions — buttons/links supplied by the page. */
  actions: ReactNode
}

export default function LibraryItemCard({
  name,
  statusLabel,
  statusTone,
  tags = [],
  usageLine,
  actions,
}: LibraryItemCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-surface-resting transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground">{name}</p>
        <div className="shrink-0">
          <StatusIndicator label={statusLabel} tone={statusTone} />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs tabular-nums text-muted-foreground">{usageLine}</p>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </div>
  )
}

/** The 2-up grid every Library page uses. Cards size to the column, never to a fixed px width. */
export function LibraryCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{children}</div>
}

export function LibraryCardGridSkeleton() {
  return (
    <LibraryCardGrid>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-surface-resting">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-3 flex gap-1.5">
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="mt-3 h-3 w-28 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </LibraryCardGrid>
  )
}
