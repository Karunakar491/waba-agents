import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Plus,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Search,
} from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import StatusIndicator from '../components/shared/StatusIndicator'
import Modal from '../components/shared/Modal'

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

const PAGE_SIZE = 10

export default function WabasPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { data: wabas = [], isLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })

  // Search + pagination — this page is definitionally multi-client, and had
  // neither before (2026-08-05 fix); an ops account with 20+ WABAs had no way
  // to narrow beyond scrolling and eyeballing IDs.
  const filteredWabas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return wabas
    return wabas.filter(
      (w) => w.wabaId.toLowerCase().includes(q) || (w.label ?? '').toLowerCase().includes(q),
    )
  }, [wabas, search])

  const pageCount = Math.max(1, Math.ceil(filteredWabas.length / PAGE_SIZE))
  const pagedWabas = filteredWabas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

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
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search WABAs by ID or name…"
              className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition"
            />
          </div>

          {filteredWabas.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No WABAs match your search.
            </p>
          ) : (
            <>
              <WabaTable wabas={pagedWabas} />
              {pageCount > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Page {page + 1} of {pageCount} ({filteredWabas.length} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium
                        text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={page >= pageCount - 1}
                      className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium
                        text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
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
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
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
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {wabas.map((waba) => (
            <WabaRow key={waba.id} waba={waba} onOpen={() => navigate(`/wabas/${waba.wabaId}`)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WabaRow
// ---------------------------------------------------------------------------

// Phase 2 item 14b (2026-08-05) — no longer expands inline into a nested
// table; the phone-number drill-down is now WabaDetailPage's own route.
function WabaRow({ waba, onOpen }: { waba: WabaEntry; onOpen: () => void }) {
  const isActive = waba.status === 'active'

  return (
    <tr
      className="hover:bg-muted/20 transition-colors cursor-pointer focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
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

      {/* Status */}
      <td className="px-4 py-3">
        <StatusIndicator
          label={isActive ? 'Active' : 'Disconnected'}
          tone={isActive ? 'positive' : 'negative'}
          pulse={isActive}
        />
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen() }}
            className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium
              text-foreground transition-colors hover:bg-muted"
          >
            View
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
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
    <Modal
      title={step === 'enter' ? 'Add WABA' : 'Confirm Registration'}
      onClose={onClose}
      preventClose={validateMutation.isPending || registerMutation.isPending}
      maxWidthClassName="max-w-md"
    >
        {step === 'enter' ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter the Meta WABA ID to validate and register.
            </p>

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
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary',
                    'transition-colors',
                    validateError && 'border-destructive focus-visible:ring-destructive focus-visible:ring-offset-2',
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
            <p className="mb-4 text-sm text-muted-foreground">
              Review the details below before registering.
            </p>

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
    </Modal>
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
    <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            {['WABA ID', 'Business Name', 'Status', 'Actions'].map((h) => (
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
                <div className="h-5 w-20 rounded-full bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <div className="h-7 w-16 rounded-lg bg-muted" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
