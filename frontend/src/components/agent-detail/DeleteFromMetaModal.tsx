import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ConsequenceLine from '../shared/ConsequenceLine'
import Modal from '../shared/Modal'

/**
 * Highest-stakes modal in the platform — fires DELETE .../delete_agent
 * against a real client's live WhatsApp number. Typed confirmation requires
 * the exact phone number (not the agent name — names can be generic/reused
 * across clients, the number is the one unambiguous thing actually at risk).
 * Visually distinct (red-toned) from the existing DB-only delete modal —
 * these are different, non-interchangeable actions.
 */
export default function DeleteFromMetaModal({
  agentId,
  agentName,
  phoneNumberId,
  onClose,
  onDeleted,
}: {
  agentId: string
  agentName: string
  phoneNumberId: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [confirmValue, setConfirmValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.delete(`/agents/${agentId}/meta-agent`),
    onSuccess: onDeleted,
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const matches = confirmValue.trim() === phoneNumberId

  return (
    <Modal
      title={
        <span className="flex items-center gap-2.5 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Remove agent from Meta
        </span>
      }
      onClose={onClose}
      preventClose={mutation.isPending}
      maxWidthClassName="max-w-md"
    >
      <p className="text-sm text-foreground">
        This will remove <strong className="font-semibold">{agentName} — {phoneNumberId}</strong> from
        Meta. This cannot be undone.
      </p>

      <div className="mt-2">
        <ConsequenceLine tone="warning">
          Type the phone number <strong className="font-semibold text-foreground">{phoneNumberId}</strong> to
          confirm — removing from Meta is separate from deleting the agent record, and cannot be reversed.
        </ConsequenceLine>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <input
        type="text"
        aria-label="Confirm phone number"
        value={confirmValue}
        onChange={(e) => setConfirmValue(e.target.value)}
        placeholder={phoneNumberId}
        autoFocus
        className="mt-4 w-full rounded-xl border bg-background px-3 py-2.5 text-sm
          focus:outline-none focus:ring-2 focus:ring-destructive/40 focus:border-destructive transition"
      />

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => { setError(null); mutation.mutate() }}
          disabled={!matches || mutation.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5
            text-sm font-semibold text-white transition-opacity hover:opacity-90
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Remove from Meta
        </button>
        <button
          onClick={onClose}
          disabled={mutation.isPending}
          className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold
            text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
