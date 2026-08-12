import { cn } from '../../../lib/utils'

// NEW (Figma node 172:9, Meta docs/meta-api/.../LTO.md) — Limited-Time-Offer
// component. MARKETING-only per Meta's own limitation (enforced by the
// parent hook: category switching away from MARKETING force-disables this).
// Also per LTO.md: "Footer components are not supported" alongside LTO —
// the parent hook clears footerText when this is enabled, so there's
// nothing this component needs to guard itself.
export default function LimitedTimeOfferEditor({
  enabled, onEnabledChange, text, onTextChange, hasExpiration, onHasExpirationChange,
}: {
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  text: string
  onTextChange: (v: string) => void
  hasExpiration: boolean
  onHasExpirationChange: (v: boolean) => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground">Add limited-time offer</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shows a highlighted offer banner above the body text. Marketing templates only.
          </p>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} label="Add limited-time offer" />
      </div>

      {enabled && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Offer text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="e.g., Buy 1 Get 1"
              maxLength={16}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{text.length}/16 — Meta's own limit for this field.</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Show expiration</span>
            <Toggle checked={hasExpiration} onChange={onHasExpirationChange} label="Show expiration" />
          </div>
        </>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2',
        checked ? 'bg-accent-teal-solid' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-surface-resting transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
