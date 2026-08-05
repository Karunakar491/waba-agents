import { cn } from '../../lib/utils'

export type StatusTone = 'positive' | 'warning' | 'negative' | 'neutral'

/**
 * The ONLY way status renders anywhere in this app — dot + plain text, never
 * a tinted-background pill. Per DESIGN.md §0 move 4 / §6: the pill pattern was
 * independently reinvented wrong in 11+ places (Skills/Persona/Connectors/
 * Files tables, Dashboard, Agents, AgentDetail x3, Wabas, Profile, Template
 * Studio/Settings) before this component existed. Any new status column
 * should import this instead of writing a new local `STATUS_CONFIG` object.
 */
export default function StatusIndicator({
  label,
  tone,
  pulse = false,
}: {
  label: string
  tone: StatusTone
  /** Per DESIGN.md §0 move 4 — pulse only for a genuinely "live" state. */
  pulse?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          tone === 'positive' && 'bg-brand-green',
          tone === 'warning' && 'bg-warning',
          tone === 'negative' && 'bg-destructive',
          tone === 'neutral' && 'bg-muted-foreground/40',
          pulse && 'animate-pulse',
        )}
      />
      {label}
    </span>
  )
}
