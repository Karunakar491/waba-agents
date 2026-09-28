import { useState } from 'react'
import { Circle, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import { cn } from '../../lib/utils'
import { useJobPoll } from '../../hooks/useJobPoll'
import ConsequenceLine from '../shared/ConsequenceLine'
import Modal from '../shared/Modal'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import { describeEventOutcome, type OutcomeTone } from '../events/eventOutcome'

// DESIGN.md §2: `warning` is dot-only (3.19:1 fails AA as text), so a pending
// label stays on foreground and only its dot carries the colour.
const TONE_DOT: Record<OutcomeTone, string> = {
  neutral: 'text-muted-foreground',
  pending: 'text-warning',
  positive: 'text-accent-teal-solid',
  destructive: 'text-destructive',
}

const TONE_TEXT: Record<OutcomeTone, string> = {
  neutral: 'text-muted-foreground',
  pending: 'text-foreground',
  positive: 'text-accent-teal-solid',
  destructive: 'text-destructive',
}

interface MetaEventState {
  status: string | null
  errorMessage: string | null
  skippedReason: string | null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export default function TriggerEventModal({
  agentId,
  onClose,
}: {
  agentId: string
  onClose: () => void
}) {
  const [eventType, setEventType] = useState('payment_received')
  const [to, setTo] = useState('')
  const [description, setDescription] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [metaEvent, setMetaEvent] = useState<MetaEventState>({
    status: null,
    errorMessage: null,
    skippedReason: null,
  })

  const poll = useJobPoll({
    fetchStatus: async (eventId) => {
      const r = await api.get(`/agents/${agentId}/events/${eventId}`)
      // The hook only needs the coarse status, but Meta's own words are the
      // only thing that explains a failure or a skip — keep them.
      const body: Record<string, unknown> = r.data.data ?? {}
      const status = readString(body.status)
      setMetaEvent({
        status,
        errorMessage: readString(body.error_message),
        skippedReason: readString(body.skipped_reason),
      })
      return status ?? 'unknown'
    },
    pendingValues: ['request_received', 'processing'],
    successValues: ['sent', 'success'],
  })

  async function handleSend() {
    if (!description.trim() || !to.trim()) return
    setSendError(null)
    setMetaEvent({ status: null, errorMessage: null, skippedReason: null })
    try {
      const res = await api.post(`/agents/${agentId}/events`, {
        to: to.trim(),
        event: {
          type: eventType,
          description: description.trim(),
          payload: '{}',
        },
      })
      const id = res.data.data?.agentEventId as string | undefined
      if (!id) {
        setSendError('Meta accepted the event but returned no id to track its status.')
        return
      }
      poll.start(id)
    } catch (err) {
      setSendError(extractErrorMessage(err))
    }
  }

  // The poll gives up before Meta settles on some events; once it has, its own
  // last reading is more truthful than the stale status we saw mid-flight.
  const lastKnownStatus =
    poll.status === 'unknown'
      ? null
      : metaEvent.status ?? (poll.status === 'pending' ? 'processing' : null)

  const outcome = describeEventOutcome(
    lastKnownStatus,
    metaEvent.errorMessage,
    metaEvent.skippedReason,
  )

  return (
    <Modal
      title="Trigger event"
      onClose={onClose}
      preventClose={poll.status === 'pending'}
      maxWidthClassName="max-w-lg"
    >
        <ConsequenceLine>
          Fires a business event at this agent — e.g. "payment received" — so it can react in the
          conversation.
        </ConsequenceLine>

        {sendError && (
          <div className="mt-3">
            <ErrorBanner error={sendError} />
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Event type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            >
              <option value="payment_received">Payment received</option>
              <option value="order_shipped">Order shipped</option>
              <option value="document_verified">Document verified</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Customer phone number</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+15551234567"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Customer's payment of ₹499 was received"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <button
            onClick={handleSend}
            disabled={!description.trim() || !to.trim() || poll.status === 'pending'}
            className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5 text-sm font-semibold
              text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {poll.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}
            Send event
          </button>
          {poll.status !== 'idle' && (
            <div className="min-w-0 pt-1.5">
              <span className={cn('flex items-center gap-1.5 text-sm font-medium', TONE_TEXT[outcome.tone])}>
                <Circle className={cn('h-2 w-2 shrink-0 fill-current', TONE_DOT[outcome.tone])} />
                {outcome.label}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">{outcome.explanation}</p>
            </div>
          )}
        </div>
    </Modal>
  )
}
