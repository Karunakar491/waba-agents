import { cn } from '../../lib/utils'

/**
 * DESIGN.md §6 — Segmented control (pill track, bg-muted + raised selected
 * segment) for switching between a small closed set of equivalent options
 * inline. DESIGN.md's own named example is this exact use case (AI
 * provider: OpenAI/Claude/NVIDIA) — first real consumer is AiProviderPanel.
 * Distinct from Tabs (underline-style, page-level navigation) — never
 * interchangeable per DESIGN.md. This is a single-choice-among-peers
 * control, not view navigation, so it uses radiogroup/radio semantics
 * (not tablist/tab, which implies switching visible panels) — with the
 * arrow-key roaming a native radiogroup is expected to have.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  label: string
}) {
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = e.key === 'ArrowRight'
      ? (index + 1) % options.length
      : (index - 1 + options.length) % options.length
    onChange(options[next].value)
  }

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-[10px] bg-muted p-1">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid',
            value === o.value
              ? 'bg-card text-foreground shadow-surface-resting'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
