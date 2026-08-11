import type { ModuleDef } from '../../lib/modules'
import IconChip from './IconChip'
import { cn } from '../../lib/utils'

/**
 * Module tile — shared by ModuleSelectorPage (enabled cards, clickable) and
 * ProtectedRoute's zero-access screen (locked preview row, per DESIGN.md's
 * "asymmetric empty state ... plus a locked/muted preview of what's coming"
 * rule). The mini chat-bubble / template-card preview is decorative but
 * real-shaped (DESIGN.md §6 Live-preview snippet), not a placeholder.
 */
export default function ModuleCard({
  module,
  enabled,
  onOpen,
}: {
  module: ModuleDef
  enabled: boolean
  onOpen?: () => void
}) {
  const Icon = module.icon

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onOpen}
      aria-describedby={!enabled ? `${module.key}-locked-reason` : undefined}
      className={cn(
        'flex w-[340px] shrink-0 flex-col items-start gap-4 rounded-[18px] border border-border bg-card p-6 text-left transition',
        enabled
          ? 'shadow-surface-resting hover:shadow-surface-lifted hover:border-accent-teal-solid/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2'
          : 'cursor-not-allowed opacity-55',
      )}
    >
      <ModulePreview moduleKey={module.key} muted={!enabled} />

      <IconChip icon={<Icon className="h-5 w-5" />} tone={enabled ? 'teal' : 'muted'} />

      <p className="text-xl font-semibold text-foreground">{module.label}</p>
      <p className="text-sm text-muted-foreground">{module.description}</p>

      <div className="flex w-full items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {enabled ? 'Ready to open' : 'Not enabled'}
        </span>
        {enabled ? (
          <span className="text-sm font-medium text-accent-teal-solid">Open →</span>
        ) : (
          <span id={`${module.key}-locked-reason`} className="text-sm font-medium text-muted-foreground">
            Locked
          </span>
        )}
      </div>
    </button>
  )
}

function ModulePreview({ moduleKey, muted }: { moduleKey: ModuleDef['key']; muted: boolean }) {
  return (
    <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-muted">
      {moduleKey === 'BUSINESS_AGENTS' ? (
        <>
          <Bubble className="left-4 top-3.5" muted={muted}>Hi, is my order ready?</Bubble>
          <Bubble className="left-4 top-[39px]" muted={muted}>It's been 3 days</Bubble>
          <Bubble className="right-4 top-[65px]" tone={muted ? 'muted' : 'teal'}>
            {muted ? 'Yes! Shipped today' : 'Yes! Shipped today 🎉'}
          </Bubble>
        </>
      ) : (
        <div className="absolute left-1/2 top-1.5 w-[150px] -translate-x-1/2 rounded-lg border border-border bg-card p-2.5">
          <p className={cn('text-[9px] font-semibold', muted ? 'text-muted-foreground' : 'text-foreground')}>
            Order Confirmation
          </p>
          <p className="mt-1.5 text-[8px] leading-tight text-muted-foreground">
            Hi Anita, your order is on the way.
          </p>
          <div className="mt-2 flex gap-1.5">
            <span className={cn(
              'rounded-full px-2 py-1 text-[7px] font-medium',
              muted ? 'bg-muted-foreground/10 text-muted-foreground' : 'bg-accent-teal/15 text-accent-teal-solid',
            )}>
              Track order
            </span>
            <span className={cn(
              'rounded-full px-2 py-1 text-[7px] font-medium',
              muted ? 'bg-muted-foreground/10 text-muted-foreground' : 'bg-accent-teal/15 text-accent-teal-solid',
            )}>
              View details
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function Bubble({
  children,
  className,
  muted,
  tone = 'card',
}: {
  children: string
  className: string
  muted?: boolean
  tone?: 'card' | 'muted' | 'teal'
}) {
  return (
    <span
      className={cn(
        'absolute rounded-lg px-2 py-1.5 text-[9px] leading-none',
        className,
        tone === 'card' && cn('border border-border bg-card', muted ? 'text-muted-foreground' : 'text-foreground'),
        tone === 'muted' && 'bg-muted-foreground text-white/80',
        tone === 'teal' && 'bg-accent-teal-solid text-white',
      )}
    >
      {children}
    </span>
  )
}
