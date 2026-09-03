import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '../shared/Modal'

/**
 * The one confirmation dialog for Unpublish across Skills/UI Skills/FAQ —
 * PM gate required this be mandatory, not a silent one-click action, since
 * it can drop something a real customer is mid-conversation relying on.
 * Copy explains what actually happens on Meta's side in plain language,
 * not just "are you sure?" (per PM review, 2026-08-20).
 */
export default function UnpublishConfirmModal({
  itemLabel,
  onConfirm,
  onClose,
  isPending,
}: {
  itemLabel: string
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}) {
  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Unpublish "{itemLabel}"?
        </span>
      }
      onClose={onClose}
      preventClose={isPending}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This stops the agent from using it right away. The real WhatsApp record on Meta
          is removed shortly after (not instantly, so an in-progress conversation can't lose
          it mid-reply) — the content stays saved here as a draft and can be republished
          any time.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground
              hover:text-foreground transition-colors disabled:opacity-50
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs
              font-semibold text-destructive-foreground transition-opacity hover:opacity-90
              disabled:opacity-50
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Unpublish
          </button>
        </div>
      </div>
    </Modal>
  )
}
