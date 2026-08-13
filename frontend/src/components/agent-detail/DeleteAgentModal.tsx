import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Check, Loader2, Minus, X } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ConsequenceLine from '../shared/ConsequenceLine'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'

export interface AgentDeleteStep {
  name: string
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED'
  detail: string
}

export interface AgentDeleteResult {
  metaFullyCleaned: boolean
  steps: AgentDeleteStep[]
}

/**
 * Deleting an agent is not one call — Meta has no "remove everything for this
 * agent" endpoint, so the backend empties the business persona, connectors,
 * skills and UI skills one at a time before removing the agent config, and any
 * one of those can fail on its own.
 *
 * That shapes this modal in two ways. Before: the operator is told what will
 * actually be attempted, because "delete" here reaches into a live WhatsApp
 * number, not just our database. After: if anything was left behind on Meta we
 * stay open and name it, instead of navigating away on a green toast. A
 * silently-incomplete teardown is how a phone number gets rebound to a new
 * agent carrying a previous client's configuration.
 */
export default function DeleteAgentModal({
  agentId,
  agentName,
  phoneNumberId,
  onClose,
  onDeleted,
}: {
  agentId: string
  agentName: string
  phoneNumberId: string | null
  onClose: () => void
  onDeleted: () => void
}) {
  const [confirmValue, setConfirmValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<AgentDeleteResult | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.delete(`/agents/${agentId}`).then((r) => r.data.data as AgentDeleteResult),
    onSuccess: (result) => {
      // Exactly one of these branches runs. A clean delete unmounts straight
      // away; an incomplete one only sets state and never fires the unmounting
      // callback in the same tick, or the report would never paint.
      if (result.metaFullyCleaned) onDeleted()
      else setReport(result)
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const matches = confirmValue.trim() === agentName.trim()

  if (report) {
    const failed = report.steps.filter((s) => s.status === 'FAILED')
    const cleared = report.steps.length - failed.length

    return (
      <Modal
        title={
          <span className="flex items-center gap-2.5 text-warning">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Deleted here — not fully cleared on Meta
          </span>
        }
        onClose={onDeleted}
        maxWidthClassName="max-w-lg"
      >
        <p className="text-sm text-foreground">
          <strong className="font-semibold">{agentName}</strong> has been deleted from this
          platform. {cleared > 0 && `${cleared} of ${report.steps.length} teardown steps succeeded, but `}
          the following could not be removed from Meta and are still on{' '}
          <strong className="font-semibold">{phoneNumberId ?? 'this number'}</strong>:
        </p>

        <ul className="mt-4 space-y-2">
          {failed.map((step, i) => (
            <li key={`${step.name}-${i}`} className="flex items-start gap-2 text-sm">
              <X className="h-4 w-4 shrink-0 mt-0.5 text-destructive" aria-hidden />
              <span>
                <span className="font-medium text-foreground">{step.name}</span>
                <span className="block text-xs text-muted-foreground">{step.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <ConsequenceLine tone="warning">
            Clear these on Meta before reusing this phone number for another agent — a new agent
            bound to it would inherit whatever is left above.
          </ConsequenceLine>
        </div>

        <div className="mt-4">
          <button
            onClick={onDeleted}
            className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold
              text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2.5 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Delete "{agentName}"
        </span>
      }
      onClose={onClose}
      preventClose={mutation.isPending}
      maxWidthClassName="max-w-lg"
    >
      <p className="text-sm text-foreground">
        This deletes the agent here and clears its configuration on Meta. It cannot be undone.
      </p>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What will be attempted
      </p>
      <ul className="mt-2 space-y-2">
        {(phoneNumberId
          ? [
              'Reset the business persona on Meta to defaults',
              'Delete every connector on this agent',
              'Delete every skill and UI skill',
              `Remove the agent configuration from ${phoneNumberId}`,
              'Delete conversations, messages, files, websites and FAQs stored here',
            ]
          : [
              'Delete conversations, messages, files, websites and FAQs stored here',
            ]
        ).map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {!phoneNumberId && (
        <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <Minus className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>This agent was never connected to a phone number, so nothing exists on Meta.</span>
        </div>
      )}

      <div className="mt-4">
        <ConsequenceLine tone="warning">
          Each Meta step is attempted independently. If one fails the rest still run, and you'll be
          told exactly what was left behind. Type{' '}
          <strong className="font-semibold text-foreground">{agentName}</strong> to confirm.
        </ConsequenceLine>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBanner error={error} />
        </div>
      )}

      <input
        type="text"
        aria-label="Confirm agent name"
        value={confirmValue}
        onChange={(e) => setConfirmValue(e.target.value)}
        placeholder={agentName}
        autoFocus
        className="mt-4 w-full rounded-xl border bg-background px-3 py-2.5 text-sm
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:border-destructive transition"
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
          {mutation.isPending ? 'Deleting…' : 'Delete permanently'}
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
