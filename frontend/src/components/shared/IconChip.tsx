import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * A contained icon in a flat tinted square. Scoped use only, per DESIGN.md §6:
 * NEVER for empty states (those render the agent-preview/next-action pattern,
 * §0 anti-pattern list) and NEVER as a logo/identity mark (wordmark only).
 * Legitimate scope: feature-highlight tiles (Dashboard, ModuleSelector),
 * avatar-style icons (Inbox). Two sizes only — no shadow, no gradient.
 */
export default function IconChip({
  icon,
  tone = 'primary',
  size = 'default',
}: {
  icon: ReactNode
  tone?: 'primary' | 'pink' | 'green' | 'warning' | 'muted'
  size?: 'sm' | 'default'
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        tone === 'primary' && 'bg-primary/10 text-primary',
        tone === 'pink' && 'bg-brand-pink/10 text-brand-pink',
        tone === 'green' && 'bg-brand-green/10 text-brand-green',
        tone === 'warning' && 'bg-warning/10 text-warning',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      {icon}
    </div>
  )
}
