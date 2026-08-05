import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, Building2, Minus, Loader2 } from 'lucide-react'
import api from '../lib/api'
import StatusIndicator from '../components/shared/StatusIndicator'

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

// Phase 2 item 14b (2026-08-05) — replaces WabasPage's nested table-in-table
// drill-down with a real detail route. No new backend endpoint: reuses
// GET /waba (already account-scoped) + GET /waba/{wabaId}/phones (already
// tenant-checked via wabaAccountAccessRepository.existsByWabaIdAndAccountId),
// per EM's confirmation that this closes the tenant-isolation question
// without a new ownership-check surface.
export default function WabaDetailPage() {
  const { wabaId } = useParams<{ wabaId: string }>()

  const wabasQuery = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabasQuery.data?.find((w) => w.wabaId === wabaId) ?? null

  const phonesQuery = useQuery<PhoneNumber[]>({
    queryKey: ['waba-phones', wabaId],
    queryFn: () => api.get(`/waba/${wabaId}/phones`).then((r) => r.data.data),
    enabled: !!wabaId,
  })

  const isLoading = wabasQuery.isLoading || phonesQuery.isLoading

  // One reconciled signal, not two independent error branches (EM,
  // 2026-08-05) — a WABA revoked from this account mid-session, or a
  // stale/copy-pasted link, must render the same real "not found" state
  // regardless of which of the two calls is the one that actually reveals it.
  const notFound = !isLoading && (!waba || phonesQuery.isError)

  return (
    <div className="space-y-6">
      <Link
        to="/wabas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to WABAs
      </Link>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : notFound ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center">
          <p className="font-semibold text-foreground">WABA not found</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            This WABA doesn't exist or your account no longer has access to it.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{waba!.label ?? waba!.wabaId}</h1>
              <p className="mt-0.5 font-mono text-sm text-muted-foreground">{waba!.wabaId}</p>
            </div>
            <div className="ml-auto">
              <StatusIndicator
                label={waba!.status === 'active' ? 'Active' : 'Disconnected'}
                tone={waba!.status === 'active' ? 'positive' : 'negative'}
                pulse={waba!.status === 'active'}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Phone numbers ({phonesQuery.data?.length ?? 0})
              </p>
            </div>
            {(phonesQuery.data?.length ?? 0) === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No phone numbers found for this WABA.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Phone Number
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Verified Name
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Mapped Agent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {phonesQuery.data!.map((phone) => (
                      <tr key={phone.phoneNumberId}>
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {phone.displayPhoneNumber}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{phone.verifiedName}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
