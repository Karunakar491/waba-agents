import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Trash2, Pencil } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import LibraryTable, { LibraryTableSkeleton, type LibraryTableRow } from '../components/library/LibraryTable'
import BusinessEventEditorModal, { type BusinessEventFormValue } from '../components/events/BusinessEventEditorModal'
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal'
import ErrorBanner from '../components/shared/ErrorBanner'
import { useActionFeedback } from '../components/shared/ActionFeedback'

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

const TRIGGER_LABEL: Record<string, string> = {
  MANUAL: 'A person sends it',
  SYSTEM_WEBHOOK: 'His own system',
  CONNECTOR_WATCH: 'Watched connector',
}

export default function BusinessEventsLibraryPage() {
  const queryClient = useQueryClient()
  const { confirm } = useActionFeedback()
  const [editing, setEditing] = useState<BusinessEventFormValue | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<EventListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteWarning, setDeleteWarning] = useState<string[] | null>(null)

  const { data: events = [], isLoading } = useQuery<EventListItem[]>({
    queryKey: ['business-events'],
    queryFn: () => api.get('/business-events').then((r) => r.data.data ?? []),
  })

  const previewDeleteMutation = useMutation({
    mutationFn: (event: EventListItem) => api.get(`/business-events/${event.id}/delete-impact`),
    onSuccess: (res, event) => {
      const impact = res.data.data as { inUse: boolean; agentNames: string[] }
      setPendingDelete(event)
      setDeleteWarning(impact.inUse ? impact.agentNames : null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (event: EventListItem) => api.delete(`/business-events/${event.id}`),
    onSuccess: (_data, event) => {
      queryClient.invalidateQueries({ queryKey: ['business-events'] })
      setPendingDelete(null)
      confirm('Business event deleted', event.name)
    },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  })

  function openEdit(event: EventListItem) {
    setEditing({
      id: event.id,
      name: event.name,
      description: event.description,
      guardrails: event.guardrails ?? '',
      triggerMethod: event.triggerMethod as BusinessEventFormValue['triggerMethod'],
    })
  }

  const rows: LibraryTableRow[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    detail: event.description,
    tags: [TRIGGER_LABEL[event.triggerMethod] ?? event.triggerMethod],
    statusLabel: TRIGGER_LABEL[event.triggerMethod] ?? event.triggerMethod,
    statusTone: event.triggerMethod === 'MANUAL' ? ('positive' as const) : ('neutral' as const),
    usedByCount: event.usedByCount,
    updatedAt: null,
    onOpen: () => openEdit(event),
    actions: (
      <>
        <button
          onClick={() => openEdit(event)}
          className="min-h-11 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { setDeleteError(null); previewDeleteMutation.mutate(event) }}
          disabled={previewDeleteMutation.isPending}
          aria-label={`Delete business event ${event.name}`}
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </>
    ),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Business Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Named, reusable things an agent can announce — "Payment Received", "Order Shipped" — attach one to
            any agent that should use it.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5 text-sm font-semibold
            text-white transition-opacity hover:opacity-90"
        >
          <Send className="h-4 w-4" />
          Create business event
        </button>
      </div>

      {deleteError && <ErrorBanner error={deleteError} />}

      {isLoading ? (
        <LibraryTableSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-l-4 border-l-accent-teal-solid bg-card p-6 shadow-surface-resting">
          <p className="text-base font-semibold text-foreground">No business events yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Create one and attach it to an agent — from here, or from the agent's own page.
          </p>
        </div>
      ) : (
        <LibraryTable itemLabel="Event" rows={rows} showUpdated={false} />
      )}

      {editing && (
        <BusinessEventEditorModal
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          title="Delete business event"
          consequence={
            deleteWarning && deleteWarning.length > 0 ? (
              <>
                <strong className="font-semibold text-foreground">{pendingDelete.name}</strong> is used by{' '}
                {deleteWarning.length} agent{deleteWarning.length === 1 ? '' : 's'}:{' '}
                <strong className="font-semibold text-foreground">{deleteWarning.join(', ')}</strong>. They will
                no longer be able to announce this. This cannot be undone.
              </>
            ) : (
              <>
                Delete <strong className="font-semibold text-foreground">{pendingDelete.name}</strong>? This
                cannot be undone.
              </>
            )
          }
          confirmLabel="Delete business event"
          isPending={deleteMutation.isPending}
          error={deleteError}
          onConfirm={() => deleteMutation.mutate(pendingDelete)}
          onClose={() => { setPendingDelete(null); setDeleteWarning(null) }}
        />
      )}
    </div>
  )
}
