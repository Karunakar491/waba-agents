import { AlertTriangle } from 'lucide-react'
import Button from './Button'
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
      maxWidthClassName="max-w-lg"
    >
      <ConsequenceLine tone="warning">{consequence}</ConsequenceLine>

      {error && (
        <div className="mt-3">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <Button variant="destructive" className="flex-1" disabled={isPending} loading={isPending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" className="flex-1" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  )
}
