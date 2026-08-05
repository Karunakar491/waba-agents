import { extractErrorMessage } from '../../lib/errors'

/**
 * The ONLY way an inline error renders anywhere in this app — per DESIGN.md
 * §6/§5. Inline, next to where it went wrong, never toast-only. No shadow:
 * this is not a separate surface, it's a state of the surface it sits in
 * (per §2's shadow-as-surface-separation rule).
 */
export default function ErrorBanner({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      {extractErrorMessage(error)}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          Retry
        </button>
      )}
    </p>
  )
}
