import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import api from '../../../lib/api'
import { extractErrorMessage } from '../../../lib/errors'
import ErrorBanner from '../../shared/ErrorBanner'

interface ValidatePreview {
  wabaId: string
  wabaName: string
  phoneNumbers: Array<{ phoneNumberId: string; displayPhoneNumber: string }>
}

// Extracted from TemplateSettingsPage.tsx (V2 rebrand slice 6, Figma node
// 85:9) — validate → preview → confirm-and-register flow.
export default function AddWabaPanel({
  onDone,
  onCancel,
}: {
  onDone: (internalId: string) => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const [wabaIdInput, setWabaIdInput] = useState('')
  const [preview, setPreview] = useState<ValidatePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateMutation = useMutation({
    mutationFn: (wabaId: string) =>
      api.post('/waba/validate', { wabaId }).then((r) => r.data.data as ValidatePreview),
    onSuccess: (data) => {
      setPreview(data)
      setError(null)
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const registerMutation = useMutation({
    mutationFn: (payload: { wabaId: string; label: string }) =>
      api.post('/waba', payload).then((r) => r.data.data as { id: string }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wabas'] })
      onDone(data.id)
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  return (
    <div className="space-y-3 rounded-2xl border border-dashed bg-muted p-4">
      <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">ADD WABA</p>
      {!preview ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">WABA ID</label>
            <input
              type="text"
              inputMode="numeric"
              value={wabaIdInput}
              onChange={(e) => setWabaIdInput(e.target.value)}
              placeholder="Enter WABA ID"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
            />
          </div>
          {error && <ErrorBanner error={error} />}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!wabaIdInput.trim() || validateMutation.isPending}
              onClick={() => {
                setError(null)
                validateMutation.mutate(wabaIdInput.trim())
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              {validateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Fetch phone numbers
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg border bg-card px-4 py-3 text-sm">
            <p className="font-semibold text-foreground">{preview.wabaName}</p>
            <p className="text-xs text-muted-foreground">WABA · {preview.wabaId}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {preview.phoneNumbers.length} phone number{preview.phoneNumbers.length === 1 ? '' : 's'} found
            </p>
          </div>
          {error && <ErrorBanner error={error} />}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={registerMutation.isPending}
              onClick={() =>
                registerMutation.mutate({ wabaId: preview.wabaId, label: preview.wabaName })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              {registerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm &amp; register
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setError(null)
              }}
              className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}
