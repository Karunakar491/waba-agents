import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Plus,
  ChevronDown,
  ChevronRight,
  Bot,
  Minus,
  Check,
  Loader2,
  Phone,
} from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

interface PhoneNumber {
  phoneNumberId: string
  displayPhoneNumber: string
  verifiedName: string
  alreadyConnected: boolean
  connectedAgentName: string | null
}

interface ValidatePreview {
  wabaId: string
  wabaName: string
  phoneNumbers: PhoneNumber[]
}

// ---------------------------------------------------------------------------
// WabasPage
// ---------------------------------------------------------------------------

export default function WabasPage() {
  const [showAdd, setShowAdd] = useState(false)

  const { data: wabas = [], isLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WABAs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage client WhatsApp Business Accounts
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2.5
            text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add WABA
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <WabaTableSkeleton />
      ) : wabas.length === 0 ? (
        <EmptyState onAddClick={() => setShowAdd(true)} />
      ) : (
        <WabaTable wabas={wabas} />
      )}

      {/* Add WABA modal */}
      {showAdd && <AddWabaModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WabaTable
// ---------------------------------------------------------------------------

function WabaTable({ wabas }: { wabas: WabaEntry[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [phones, setPhones] = useState<Map<string, PhoneNumber[]>>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  function toggleRow(wabaId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(wabaId)) {
        next.delete(wabaId)
      } else {
        next.add(wabaId)
        if (!phones.has(wabaId)) {
          loadPhones(wabaId)
        }
      }
      return next
    })
  }

  function loadPhones(wabaId: string) {
    setLoadingIds((prev) => new Set(prev).add(wabaId))
    api
      .get(`/waba/${wabaId}/phones`)
      .then((r) => {
        setPhones((prev) => new Map(prev).set(wabaId, r.data.data))
      })
      .finally(() => {
        setLoadingIds((prev) => {
          const next = new Set(prev)
          next.delete(wabaId)
          return next
        })
      })
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              WABA ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Business Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Phone Numbers
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {wabas.map((waba) => {
            const isExpanded = expandedIds.has(waba.wabaId)
            const isLoadingPhones = loadingIds.has(waba.wabaId)
            const wabaPhones = phones.get(waba.wabaId) ?? []

            return (
              <>
                <WabaRow
                  key={waba.id}
                  waba={waba}
                  isExpanded={isExpanded}
                  onToggle={() => toggleRow(waba.wabaId)}
                />
                {isExpanded && (
                  <tr key={`${waba.id}-expanded`}>
                    <td colSpan={5} className="bg-muted/10 px-6 py-4">
                      {isLoadingPhones ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading phone numbers…
                        </div>
                      ) : wabaPhones.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No phone numbers found for this WABA.
                        </p>
                      ) : (
                        <PhoneSubTable phones={wabaPhones} />
                      )}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WabaRow
// ---------------------------------------------------------------------------

function WabaRow({
  waba,
  isExpanded,
  onToggle,
}: {
  waba: WabaEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  const isActive = waba.status === 'active'

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      {/* WABA ID */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-mono text-sm text-foreground">{waba.wabaId}</span>
        </div>
      </td>

      {/* Business Name */}
      <td className="px-4 py-3 text-sm text-foreground">
        {waba.label ?? <span className="text-muted-foreground">—</span>}
      </td>

      {/* Phone Numbers */}
      <td className="px-4 py-3">
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5
            text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <Phone className="h-3 w-3" />
          View numbers
        </button>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
            isActive
              ? 'bg-brand-green/10 text-brand-green'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isActive ? 'bg-brand-green' : 'bg-destructive',
            )}
          />
          {isActive ? 'Active' : 'Disconnected'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <button
            onClick={onToggle}
            title={isExpanded ? 'Collapse' : 'Expand'}
            className="flex items-center justify-center h-8 w-8 rounded-lg
              text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// PhoneSubTable
// ---------------------------------------------------------------------------

function PhoneSubTable({ phones }: { phones: PhoneNumber[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Phone Number
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Verified Name
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mapped Agent
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {phones.map((phone) => (
            <tr key={phone.phoneNumberId} className="bg-background">
              <td className="px-4 py-2.5 font-medium text-foreground">
                {phone.displayPhoneNumber}
              </td>
              <td className="px-4 py-2.5 text-sm text-muted-foreground">
                {phone.verifiedName}
              </td>
              <td className="px-4 py-2.5">
                {phone.connectedAgentName ? (
                  <div className="flex items-center gap-1.5 text-brand-green text-sm font-medium">
                    <Bot className="h-3.5 w-3.5" />
                    {phone.connectedAgentName}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <Minus className="h-3.5 w-3.5" />
                    No agent
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end">
                  {!phone.alreadyConnected && (
                    <button
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium
                        text-foreground transition-colors hover:bg-muted"
                    >
                      {/* TASK-037: wire agent assignment */}
                      Assign Agent
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddWabaModal
// ---------------------------------------------------------------------------

type ModalStep = 'enter' | 'preview'

function AddWabaModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()

  const [step, setStep] = useState<ModalStep>('enter')
  const [wabaIdInput, setWabaIdInput] = useState('')
  const [validateError, setValidateError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ValidatePreview | null>(null)

  const validateMutation = useMutation({
    mutationFn: (wabaId: string) =>
      api.post('/waba/validate', { wabaId }).then((r) => r.data.data as ValidatePreview),
    onSuccess: (data) => {
      setPreview(data)
      setValidateError(null)
      setStep('preview')
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Validation failed. Check the WABA ID and try again.'
      setValidateError(message)
    },
  })

  const registerMutation = useMutation({
    mutationFn: (payload: { wabaId: string; label: string }) => api.post('/waba', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wabas'] })
      onClose()
    },
  })

  function handleValidate(e: React.FormEvent) {
    e.preventDefault()
    if (!wabaIdInput.trim()) return
    setValidateError(null)
    validateMutation.mutate(wabaIdInput.trim())
  }

  function handleRegister() {
    if (!preview) return
    registerMutation.mutate({ wabaId: preview.wabaId, label: preview.wabaName })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl bg-card border shadow-xl p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'enter' ? (
          <>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-foreground">Add WABA</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the Meta WABA ID to validate and register.
              </p>
            </div>

            <form onSubmit={handleValidate} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="wabaId"
                  className="block text-sm font-medium text-foreground"
                >
                  WABA ID
                </label>
                <input
                  id="wabaId"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  placeholder="e.g. 494227720434920"
                  value={wabaIdInput}
                  onChange={(e) => {
                    setWabaIdInput(e.target.value)
                    setValidateError(null)
                  }}
                  className={cn(
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink',
                    'transition-colors',
                    validateError && 'border-destructive focus:ring-destructive/40',
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Found in Meta Business Suite → WhatsApp accounts
                </p>
                {validateError && (
                  <p className="text-xs text-destructive">{validateError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground
                    hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validateMutation.isPending || !wabaIdInput.trim()}
                  className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2
                    text-sm font-semibold text-white transition-opacity hover:opacity-90
                    disabled:opacity-60 disabled:pointer-events-none"
                >
                  {validateMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Validate
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-foreground">Confirm Registration</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the details below before registering.
              </p>
            </div>

            {preview && (
              <div className="space-y-4">
                {/* Verified name */}
                <div className="flex items-center gap-2 rounded-lg bg-brand-green/10 px-3 py-2.5">
                  <Check className="h-4 w-4 shrink-0 text-brand-green" />
                  <span className="text-sm font-semibold text-brand-green">
                    {preview.wabaName}
                  </span>
                </div>

                {/* Phone numbers */}
                {preview.phoneNumbers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Phone Numbers ({preview.phoneNumbers.length})
                    </p>
                    <div className="rounded-lg border divide-y overflow-hidden">
                      {preview.phoneNumbers.map((phone) => (
                        <div
                          key={phone.phoneNumberId}
                          className="flex items-center justify-between px-3 py-2.5 bg-background"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {phone.displayPhoneNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {phone.verifiedName}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('enter')}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground
                      transition-colors underline underline-offset-2"
                  >
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground
                        hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={registerMutation.isPending}
                      className="flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2
                        text-sm font-semibold text-white transition-opacity hover:opacity-90
                        disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {registerMutation.isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Confirm &amp; Register
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <Building2 className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No WABAs registered</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Add your first WABA to start connecting WhatsApp Business Accounts.
      </p>
      <button
        onClick={onAddClick}
        className="mt-6 flex items-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5
          text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Add your first WABA
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WabaTableSkeleton
// ---------------------------------------------------------------------------

function WabaTableSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            {['WABA ID', 'Business Name', 'Phone Numbers', 'Status', 'Actions'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {[1, 2, 3].map((i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-muted shrink-0" />
                  <div className="h-3.5 w-40 rounded bg-muted" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-32 rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-24 rounded-full bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-20 rounded-full bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <div className="h-8 w-8 rounded-lg bg-muted" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
