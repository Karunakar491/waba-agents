import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * The chrome every Create Agent step shares (Figma 8.3–8.9): breadcrumb,
 * page title, one-line subtitle, section cards, labelled fields and the
 * bottom Back / Next bar. Extracted so no single step file has to redraw
 * the same frame, and so a copy change lands in one place.
 */

export function StepHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div className="mb-8">
      {children}
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Agents › Create
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

export function SectionCard({
  title,
  description,
  actions,
  footnote,
  children,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  footnote?: string
  children?: ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-surface-resting">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
          {actions && <div className="flex items-center gap-4">{actions}</div>}
        </div>
      )}
      {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-4 space-y-4">{children}</div>}
      {footnote && <p className="mt-4 text-xs text-muted-foreground">{footnote}</p>}
    </section>
  )
}

/** Text link used for "Import from Library", "+ Add FAQ", "+ Save to Library". */
export function LinkAction({
  onClick,
  icon,
  children,
  disabled,
}: {
  onClick: () => void
  icon?: ReactNode
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 text-sm font-medium text-accent-teal-solid transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
    >
      {icon}
      {children}
    </button>
  )
}

/**
 * Figma renders the API field name beside the human label on the generic
 * component/connector forms — kept, because the operator building a custom
 * connector is reading Meta's own docs alongside this screen.
 */
export function FieldLabel({
  htmlFor,
  label,
  apiName,
  badge,
}: {
  htmlFor: string
  label: string
  apiName?: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {apiName && <span className="text-xs text-muted-foreground">{apiName}</span>}
      {badge}
    </div>
  )
}

export function TextField({
  id,
  label,
  apiName,
  badge,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
  type = 'text',
}: {
  id: string
  label: string
  apiName?: string
  badge?: ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  maxLength?: number
  type?: 'text' | 'email' | 'url'
}) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} label={label} apiName={apiName} badge={badge} />
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-accent-teal-solid"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function SelectField({
  id,
  label,
  apiName,
  value,
  onChange,
  options,
  placeholder,
  hint,
  disabled,
}: {
  id: string
  label: string
  apiName?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} label={label} apiName={apiName} />
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground transition-colors focus-visible:border-accent-teal-solid disabled:cursor-not-allowed disabled:text-muted-foreground"
      >
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Figma's "Filled by Iris" pill — a Badge (count/flag), not a StatusIndicator. */
export function FilledByIrisBadge() {
  return (
    <span className="flex items-center gap-2 rounded-full bg-accent-teal/10 px-3 py-1 text-xs font-medium text-accent-teal-solid">
      <span className="h-2 w-2 rounded-full bg-accent-teal-solid" />
      Filled by Iris
    </span>
  )
}

export function WizardToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors',
        checked ? 'bg-accent-teal-solid' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'h-4 w-4 rounded-full bg-card transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">{children}</p>
  )
}

export function BottomBar({
  backLabel = 'Back',
  nextLabel = 'Next Step',
  onBack,
  onNext,
  nextDisabled,
  busy,
}: {
  backLabel?: string
  nextLabel?: string
  onBack: () => void
  onNext: () => void
  nextDisabled?: boolean
  busy?: boolean
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t pt-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || busy}
        className={cn(
          'flex items-center gap-3 rounded-lg bg-accent-teal-solid px-5 text-sm font-medium text-white transition-opacity',
          'h-10 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {nextLabel}
        {!busy && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  )
}
