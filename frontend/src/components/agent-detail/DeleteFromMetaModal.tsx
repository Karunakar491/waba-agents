import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import api from '../../lib/api'
import ConsequenceLine from '../shared/ConsequenceLine'

function extractMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}

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
    onError: (err) => setError(extractMessage(err)),
  })

  const matches = confirmValue.trim() === phoneNumberId

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => { if (e.key === 'Escape' && !mutation.isPending) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-from-meta-title"
        className="w-full max-w-md rounded-2xl border-2 border-destructive/40 bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <h2 id="delete-from-meta-title" className="text-base font-semibold text-destructive">
              Remove agent from Meta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-foreground">
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
          className="mt-4 w-full rounded-lg border bg-background px-3 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-destructive/40 focus:border-destructive transition"
        />

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => { setError(null); mutation.mutate() }}
            disabled={!matches || mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5
              text-sm font-semibold text-white transition-opacity hover:opacity-90
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Remove from Meta
          </button>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
              text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
