import type { ReactNode } from 'react'

/**
 * Empty state for a table body — plain icon + text, never a tinted icon
 * square (that's the empty-state anti-pattern named in DESIGN.md §0; this
 * is for list/table contexts, which are a data state, not a page-level
 * empty state — the agent-preview/next-action pattern is for the latter).
 * Promoted from `FileWebsiteTables.tsx` (2026-08-05).
 */
export default function TableEmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
