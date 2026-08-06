import { Info } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * One-line "here's what happens if you do this" reassurance/consequence
 * statement — used anywhere an action changes what's live (deploy, replace,
 * fire an event). Extracted after its third use (Business Profile deploy,
 * Delete-from-Meta, Agent Event) per DESIGN.md's shared-component rule.
 */
export default function ConsequenceLine({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: 'info' | 'warning'
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-xs',
        tone === 'warning' ? 'text-warning' : 'text-muted-foreground',
      )}
    >
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  )
}
