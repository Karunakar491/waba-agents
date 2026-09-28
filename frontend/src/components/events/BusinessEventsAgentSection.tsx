import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, X } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import LibraryTable, { LibraryTableSkeleton, type LibraryTableRow } from '../library/LibraryTable'
import BusinessEventEditorModal, { type BusinessEventFormValue } from './BusinessEventEditorModal'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'
import ConsequenceLine from '../shared/ConsequenceLine'

interface EventListItem {
  id: string
  name: string
  description: string
  guardrails: string | null
  triggerMethod: string
  usedByCount: number
  lastFiredAt: string | null
  attachedToThisAgent: boolean
}

/**
 * The agent's own view of Business Events — same shared editor as the nav
 * page (R8 Q9), scoped to what this agent carries. "Used by" becomes "Last
 * fired" here, the one column the founder said should differ between the
 * two places it appears.
 */
export default function BusinessEventsAgentSection({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<BusinessEventFormValue | 'new' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { data: agentEvents = [], isLoading } = useQuery<EventListItem[]>({
    queryKey: ['business-events', 'agent', agentId],
    queryFn: () => api.get(`/agents/${agentId}/business-events`).then((r) => r.data.data ?? []),
  })

  const attached = agentEvents.filter((e) => e.attachedToThisAgent)
  const unattached = agentEvents.filter((e) => !e.attachedToThisAgent)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['business-events', 'agent', agentId] })
    queryClient.invalidateQueries({ queryKey: ['business-events'] })
  }

  const attachMutation = useMutation({
    mutationFn: (eventId: string) => api.post(`/agents/${agentId}/business-events/${eventId}/attach`),
    onSuccess: invalidate,
  })

  const detachMutation = useMutation({
    mutationFn: (eventId: string) => api.delete(`/agents/${agentId}/business-events/${eventId}/attach`),
    onSuccess: invalidate,
  })

  const rows: LibraryTableRow[] = attached.map((event) => ({
    id: event.id,
    name: event.name,
    detail: event.description,
    statusLabel: event.triggerMethod === 'MANUAL' ? 'A person sends it' : event.triggerMethod,
    statusTone: event.triggerMethod === 'MANUAL' ? ('positive' as const) : ('neutral' as const),
    usedByCount: null,
    updatedAt: event.lastFiredAt,
    onOpen: () =>
      setEditing({
        id: event.id,
        name: event.name,
        description: event.description,
        guardrails: event.guardrails ?? '',
        triggerMethod: event.triggerMethod as BusinessEventFormValue['triggerMethod'],
      }),
    actions: (
      <button
        onClick={() => detachMutation.mutate(event.id)}
        disabled={detachMutation.isPending}
        className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
      >
        Remove
      </button>
    ),
  }))

  return (
    <div className="rounded-xl border bg-card p-5 shadow-surface-resting">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Business Events</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Named things this agent can announce — attach one from the library, or create a new one.
          </p>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold
            text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Add event
        </button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <LibraryTableSkeleton showUpdated />
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No business events attached yet.
          </p>
        ) : (
          <LibraryTable itemLabel="Event" rows={rows} showUpdated />
        )}
      </div>

      {pickerOpen && (
        <Modal title="Add a business event" onClose={() => setPickerOpen(false)} maxWidthClassName="max-w-md">
          <ConsequenceLine>Attach one already in your library, or create a new one.</ConsequenceLine>

          {attachMutation.isError && (
            <div className="mt-3">
              <ErrorBanner error={extractErrorMessage(attachMutation.error)} />
            </div>
          )}

          <div className="mt-4 space-y-1.5">
            {unattached.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing else in your library yet.</p>
            ) : (
              unattached.map((event) => (
                <button
                  key={event.id}
                  onClick={() => { attachMutation.mutate(event.id); setPickerOpen(false) }}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span>
                    <span className="block font-medium text-foreground">{event.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{event.description}</span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>

          <div className="mt-4 border-t pt-4">
            <button
              onClick={() => { setPickerOpen(false); setEditing('new') }}
              className="flex items-center gap-2 text-sm font-semibold text-accent-teal-solid hover:opacity-90"
            >
              <Send className="h-4 w-4" />
              Create a new business event
            </button>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setPickerOpen(false)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <BusinessEventEditorModal
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            // A brand-new event created from here should end up attached to
            // THIS agent, not just sitting in the library unattached.
            if (editing === 'new') {
              queryClient
                .fetchQuery<EventListItem[]>({
                  queryKey: ['business-events'],
                  queryFn: () => api.get('/business-events').then((r) => r.data.data ?? []),
                })
                .then((all) => {
                  const created = [...all].sort(
                    (a, b) => Number(b.id) - Number(a.id),
                  )[0]
                  if (created) attachMutation.mutate(created.id)
                })
            }
          }}
        />
      )}
    </div>
  )
}
