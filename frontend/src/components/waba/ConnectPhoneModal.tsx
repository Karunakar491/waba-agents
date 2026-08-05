import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ChevronDown, ChevronUp, Phone, CheckCircle2 } from 'lucide-react'
import api from '../../lib/api'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'

interface PhoneNumber {
  phoneNumberId: string
  displayPhoneNumber: string
  verifiedName: string
  alreadyConnected: boolean
  connectedAgentName: string | null
}

interface ValidateResponse {
  wabaId: string
  wabaName: string
  phoneNumbers: PhoneNumber[]
}

interface DeployPreflightResponse {
  agentIdPresent: boolean
  skillCount: number
  connectorNames: string[]
}

interface Props {
  /** Route param string — TSIDs exceed Number.MAX_SAFE_INTEGER, never parse to number */
  agentId: string
  onClose: () => void
}

type Step = 'enter' | 'select'

export default function ConnectPhoneModal({ agentId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('enter')
  const [wabaId, setWabaId] = useState('')
  const [label, setLabel] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [validated, setValidated] = useState<ValidateResponse | null>(null)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preflightChecking, setPreflightChecking] = useState(false)
  const [preflightWarning, setPreflightWarning] = useState<DeployPreflightResponse | null>(null)

  const validateMutation = useMutation({
    mutationFn: () =>
      api.post('/waba/validate', { wabaId: wabaId.trim() }).then((r) => r.data.data as ValidateResponse),
    onSuccess: (data) => {
      setValidated(data)
      setStep('select')
      setError(null)
    },
    onError: (err) => setError(extractError(err)),
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!validated) return
      const wabaRes = await api.post('/waba', {
        wabaId: validated.wabaId,
        label: label.trim() || validated.wabaName,
      })
      const internalWabaId = wabaRes.data.data.id as string
      await api.put(`/agents/${agentId}/phone`, {
        phoneNumberId: selectedPhone,
        wabaId: internalWabaId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      onClose()
    },
    onError: (err) => setError(extractError(err)),
  })

  const wabaIdValid = /^\d{5,32}$/.test(wabaId.trim())

  // Soft-warn (never a hard block) before connecting onto a number that already
  // has live Meta agent config. If the check itself fails, fail closed — block
  // instead of silently proceeding as if the number were clean.
  const handleConnectClick = async () => {
    if (!selectedPhone) return
    setError(null)
    setPreflightChecking(true)
    try {
      const res = await api.get(`/waba/phones/${selectedPhone}/deploy-preflight`)
      const data = res.data.data as DeployPreflightResponse
      const hasExisting = data.agentIdPresent || data.skillCount > 0 || data.connectorNames.length > 0
      if (hasExisting) {
        setPreflightWarning(data)
      } else {
        connectMutation.mutate()
      }
    } catch (err) {
      setError(extractError(err))
    } finally {
      setPreflightChecking(false)
    }
  }

  return (
    <Modal
      title={step === 'enter' ? 'Connect a WhatsApp number' : 'Choose a phone number'}
      onClose={onClose}
      preventClose={connectMutation.isPending || validateMutation.isPending || preflightChecking}
      maxWidthClassName="max-w-lg"
    >
        <p className="-mt-2 mb-2 text-sm text-muted-foreground">
          {step === 'enter'
            ? 'Enter your WhatsApp Business Account (WABA) ID to see its phone numbers.'
            : `Numbers available on ${validated?.wabaName || 'your WABA'}.`}
        </p>

        {error && (
          <div className="mt-4">
            <ErrorBanner error={error} />
          </div>
        )}

        {step === 'enter' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              validateMutation.mutate()
            }}
            className="mt-5 space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <label htmlFor="waba-id" className="block text-sm font-medium text-foreground">
                WABA ID
              </label>
              <input
                id="waba-id"
                type="text"
                inputMode="numeric"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="e.g. 102290129340398"
                autoFocus
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              />
              {wabaId.trim() !== '' && !wabaIdValid && (
                <p className="text-xs text-destructive">WABA ID should be a number, like 102290129340398.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="waba-label" className="block text-sm font-medium text-foreground">
                Label <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="waba-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={100}
                placeholder="e.g. Main store account"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              />
            </div>

            {/* Help */}
            <div className="rounded-lg border bg-muted/40">
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
              >
                Where do I find my WABA ID?
                {helpOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {helpOpen && (
                <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                  <p>1. Open <span className="font-medium text-foreground">Meta Business Suite</span> → Settings.</p>
                  <p>2. Under <span className="font-medium text-foreground">Accounts</span>, choose <span className="font-medium text-foreground">WhatsApp accounts</span>.</p>
                  <p>3. Select your account — the WABA ID is the long number shown in the details panel.</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!wabaIdValid || validateMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-pink px-5 py-2.5
                text-sm font-semibold text-white transition-opacity hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {validateMutation.isPending ? 'Checking with Meta…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'select' && validated && (
          <div className="mt-5 space-y-4">
            {validated.phoneNumbers.length === 0 ? (
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                This WABA has no phone numbers yet. Add one in Meta Business Suite, then try again.
              </p>
            ) : (
              <div className="space-y-2">
                {validated.phoneNumbers.map((p) => {
                  const selected = selectedPhone === p.phoneNumberId
                  return (
                    <button
                      key={p.phoneNumberId}
                      type="button"
                      disabled={p.alreadyConnected}
                      aria-pressed={selected}
                      onClick={() => setSelectedPhone(p.phoneNumberId)}
                      className={[
                        'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                        p.alreadyConnected
                          ? 'opacity-50 cursor-not-allowed bg-muted/40'
                          : selected
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50',
                      ].join(' ')}
                    >
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{p.displayPhoneNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.alreadyConnected
                            ? `Already connected to ${p.connectedAgentName ?? 'another agent'}`
                            : p.verifiedName}
                        </p>
                      </div>
                      {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}

            {preflightWarning && (
              <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 space-y-2">
                <p>{describePreflightWarning(preflightWarning)}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreflightWarning(null)}
                    className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreflightWarning(null); connectMutation.mutate() }}
                    className="rounded-md bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep('enter'); setSelectedPhone(null); setError(null); setPreflightWarning(null) }}
                disabled={connectMutation.isPending}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
                  text-muted-foreground hover:text-foreground transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConnectClick}
                disabled={!selectedPhone || connectMutation.isPending || preflightChecking || !!preflightWarning}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-pink px-4 py-2.5
                  text-sm font-semibold text-white transition-opacity hover:opacity-90
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(connectMutation.isPending || preflightChecking) && <Loader2 className="h-4 w-4 animate-spin" />}
                {connectMutation.isPending ? 'Connecting…' : preflightChecking ? 'Checking number…' : 'Connect number'}
              </button>
            </div>
          </div>
        )}
    </Modal>
  )
}

function extractError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}

function describePreflightWarning(p: DeployPreflightResponse): string {
  const parts: string[] = []
  if (p.skillCount > 0) parts.push(`${p.skillCount} skill${p.skillCount === 1 ? '' : 's'} configured`)
  if (p.connectorNames.length > 0) parts.push(`connected to: ${p.connectorNames.join(', ')}`)
  if (parts.length === 0) parts.push('an active Meta agent configured')
  return `This number already has ${parts.join('; ')}. Connecting here may affect what's already live. Continue?`
}
