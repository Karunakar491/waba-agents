import { AlertTriangle, Loader2 } from 'lucide-react'
import ConsequenceLine from './ConsequenceLine'
import ErrorBanner from './ErrorBanner'
import Modal from './Modal'

/**
 * Standard confirm-before-delete step for lower-stakes destructive actions
 * (library skills, files, websites) — DESIGN.md §5. Lighter than
 * DeleteFromMetaModal (no typed confirmation; that one guards a live Meta
 * removal, this one guards a DB record) but shares the same chrome, error
 * handling, and button treatment.
 */
export default function ConfirmDeleteModal({
  title,
  consequence,
  confirmLabel,
  isPending,
  error,
  onConfirm,
  onClose,
}: {
  title: string
  consequence: React.ReactNode
  confirmLabel: string
  isPending: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      title={
        <span className="flex items-center gap-2.5 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {title}
        </span>
      }
      onClose={onClose}
      preventClose={isPending}
      maxWidthClassName="max-w-md"
    >
      <ConsequenceLine tone="warning">{consequence}</ConsequenceLine>

      {error && (
        <div className="mt-3">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5
            text-sm font-semibold text-white transition-opacity hover:opacity-90
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold
            text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
