import { cn } from '../../../lib/utils'

/**
 * One panel visible, the rest one click away.
 *
 * This is the answer to the founder's correction that a page holding several
 * complex panels at once is harder to use, not easier — but a tab hides things,
 * and hiding without a hint is how a user misses that a body was ever
 * configured. So a tab that holds anything carries a dot, and a tab that cannot
 * apply is disabled with the reason in its tooltip rather than removed. A tab
 * that vanishes teaches nothing; a disabled one saying "GET requests do not
 * send a body — Meta drops it" teaches the constraint.
 */
export interface WorkbenchTab {
  id: string
  label: string
  /** Shows a dot — this panel holds something. */
  filled?: boolean
  /** Why this tab cannot be used. Present = disabled, and shown on hover. */
  unavailable?: string | null
  /** Count shown beside the label, e.g. the number of parameters. */
  count?: number
}

export default function WorkbenchTabs({
  tabs,
  active,
  onSelect,
  navLabel,
}: {
  tabs: WorkbenchTab[]
  active: string
  onSelect: (id: string) => void
  /**
   * Present = this row is section *navigation*, not a tablist.
   *
   * The connector's sections and an action's panels are both on screen at
   * once, and both include "Authorization" and "Headers". Two tabs with one
   * name is ambiguous to a person and outright unresolvable to a screen reader
   * or a test. So the connector's row is a labelled nav — which is also what
   * it is: it moves you between parts of the connector, while the action's
   * tabs switch panels inside one form.
   */
  navLabel?: string
}) {
  const asNav = !!navLabel
  return (
    <div
      role={asNav ? 'navigation' : 'tablist'}
      aria-label={navLabel}
      className="flex items-center gap-1 border-b"
    >
      {tabs.map((tab) => {
        const disabled = !!tab.unavailable
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role={asNav ? undefined : 'tab'}
            aria-selected={asNav ? undefined : selected}
            aria-current={asNav && selected ? 'page' : undefined}
            aria-disabled={disabled || undefined}
            title={tab.unavailable ?? undefined}
            onClick={() => !disabled && onSelect(tab.id)}
            className={cn(
              'flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
              selected
                ? 'border-accent-teal-solid text-foreground'
                : 'border-transparent text-muted-foreground',
              disabled
                ? 'cursor-not-allowed opacity-40'
                : !selected && 'hover:text-foreground',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            )}
            {tab.filled && typeof tab.count !== 'number' && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-accent-teal-solid"
                title="This tab has something in it"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
