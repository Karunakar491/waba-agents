import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import Modal from '../shared/Modal'
import ConsequenceLine from '../shared/ConsequenceLine'
import ErrorBanner from '../shared/ErrorBanner'

export interface BusinessEventFormValue {
  id?: string
  name: string
  description: string
  guardrails: string
  triggerMethod: 'MANUAL' | 'SYSTEM_WEBHOOK' | 'CONNECTOR_WATCH'
}

const TRIGGER_OPTIONS: {
  value: BusinessEventFormValue['triggerMethod']
  label: string
  available: boolean
  unavailableReason?: string
}[] = [
  { value: 'MANUAL', label: 'A person sends it', available: true },
  {
    value: 'SYSTEM_WEBHOOK',
    label: 'His own system tells us',
    available: false,
    unavailableReason: 'Not available yet — the address and key screen is a later release.',
  },
  {
    value: 'CONNECTOR_WATCH',
    label: 'A connected system is watched',
    available: false,
    unavailableReason: 'Not available yet — connect a system first, once this is built.',
  },
]

/**
 * The ONE create/edit screen for a Business Event — same fields, same order,
 * same wording wherever it opens from (nav, agent tab, wizard), per R8 Q9:
 * "Same like how we are doing for skills and business persona."
 */
export default function BusinessEventEditorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: BusinessEventFormValue
  onClose: () => void
  onSaved?: () => void
}) {
  const isEdit = !!initial?.id
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [guardrails, setGuardrails] = useState(initial?.guardrails ?? '')
  const [triggerMethod, setTriggerMethod] = useState<BusinessEventFormValue['triggerMethod']>(
    initial?.triggerMethod ?? 'MANUAL',
  )
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim(), guardrails: guardrails.trim(), triggerMethod }
      return isEdit
        ? api.put(`/business-events/${initial!.id}`, body)
        : api.post('/business-events', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-events'] })
      onSaved?.()
      onClose()
    },
  })

  const canSave = name.trim().length > 0 && description.trim().length > 0 && !mutation.isPending

  return (
    <Modal
      title={isEdit ? 'Edit business event' : 'Create business event'}
      onClose={onClose}
      preventClose={mutation.isPending}
      maxWidthClassName="max-w-lg"
    >
      <ConsequenceLine>
        A named, reusable thing your agent can announce — "Payment Received", "Order Shipped" — attach it to
        as many agents as you like.
      </ConsequenceLine>

      {mutation.isError && (
        <div className="mt-3">
          <ErrorBanner error={extractErrorMessage(mutation.error)} />
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="e.g. Payment Received"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">What it's for</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Tell the customer their payment cleared"
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">
            Guardrails <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={guardrails}
            onChange={(e) => setGuardrails(e.target.value)}
            placeholder="Rules the agent should follow when writing this announcement"
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">How it gets set off</label>
          <div className="space-y-1.5">
            {TRIGGER_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                  opt.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <input
                  type="radio"
                  name="triggerMethod"
                  disabled={!opt.available}
                  checked={triggerMethod === opt.value}
                  onChange={() => setTriggerMethod(opt.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-foreground">{opt.label}</span>
                  {!opt.available && (
                    <span className="block text-xs text-muted-foreground">{opt.unavailableReason}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSave}
          className="rounded-lg bg-accent-teal-solid px-4 py-2.5 text-sm font-semibold text-white
            transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </Modal>
  )
}
