import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * The ONE shared button primitive — per DESIGN.md §5 "same pattern = same
 * component." Extracted 2026-08-07 after the component-inventory audit found
 * 115 hand-rolled `<button>` elements across 17+ page files, each with its
 * own copy-pasted Tailwind string, and zero shared Button/Input/Card
 * primitives despite this being the two most common interactive elements in
 * the app (Karpathy Rule: no abstraction *despite* overwhelming repetition
 * is the inverse of premature abstraction, and just as wrong).
 *
 * Variants match the actual button treatments already in use across the
 * codebase (Iris confirm panel, ConfirmDeleteModal, AgentDetailPage) rather
 * than inventing new ones — this is a consolidation, not a redesign.
 */
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type ButtonSize = 'default' | 'sm'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent-teal-solid text-white hover:opacity-90',
  secondary: 'border bg-background text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-white hover:opacity-90',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'px-4 py-2.5 text-sm',
  sm: 'px-3 py-2 text-sm',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'default', loading = false, fullWidth = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})

export default Button
