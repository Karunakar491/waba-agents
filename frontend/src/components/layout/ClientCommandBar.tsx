import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useFleetRisk, type FleetRiskRow } from '../../hooks/useFleetRisk'
import { useClientScope } from '../../hooks/useClientScope'
import StatusIndicator, { type StatusTone } from '../shared/StatusIndicator'
import Modal from '../shared/Modal'
import ModuleSwitcherPill from './ModuleSwitcherPill'
import { cn } from '../../lib/utils'

/**
 * Global chrome, one continuous frame with the sidebar (DESIGN.md §0 move 2,
 * amended 2026-08-06) — roadmap item 45. Signature move: "the fleet never
 * hides" — the top few at-risk clients stay partially visible without
 * opening anything, same philosophy as move 1 (agent always visible) one
 * layer up. No pink here — pink stays reserved for the one primary CTA
 * elsewhere on screen (§0 move 5).
 *
 * Module switcher pill (2026-08-11, Figma node 5:53, see ModuleSwitcherPill)
 * lives in this same bar, divided from the client switcher by a 1px
 * hairline, per DESIGN.md §5's "one mental model for every cross-cutting
 * scope switch" rule.
 */
export default function ClientCommandBar() {
  const { clientId, setClientId } = useClientScope()
  const { data: rows = [], isLoading } = useFleetRisk()
  const [overlayOpen, setOverlayOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        setOverlayOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const sorted = [...rows].sort((a, b) => b.riskScore - a.riskScore)
  const current = sorted.find((r) => r.clientId === clientId)
  const rail = sorted.slice(0, 5)

  return (
    <>
      <div className="relative z-50 flex h-11 shrink-0 items-center gap-3 bg-ink px-4 text-white md:pl-6">
        <ModuleSwitcherPill />

        <div className="hidden h-5 w-px shrink-0 bg-white/20 md:block" />

        {/* Mobile (<768px): current scope + a single tap target, never the rail. */}
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="flex items-center gap-1.5 truncate text-sm font-medium md:hidden"
        >
          {current ? current.name : 'All clients'}
          <span className="text-white/60">▾</span>
        </button>

        {/* Desktop: current scope + risk-ordered rail, worst-first, scrollable. */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => setClientId(null)}
            className={cn(
              'shrink-0 text-sm font-medium transition-colors',
              !current ? 'text-white' : 'text-white/60 hover:text-white',
            )}
          >
            {current ? current.name : 'All clients'}
          </button>
          {!isLoading && rail.length > 0 && (
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {rail.map((row) => (
                <button
                  key={row.clientId}
                  type="button"
                  onClick={() => setClientId(row.clientId)}
                  title={riskTooltip(row)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    row.clientId === clientId ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass(row.riskScore))} />
                  {row.name}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOverlayOpen(true)}
            aria-label="Search all clients"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Search className="h-3 w-3" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden rounded border border-white/20 px-1 text-[10px] lg:inline">/</kbd>
          </button>
        </div>
      </div>

      {overlayOpen && (
        <Modal title="Switch client" onClose={() => setOverlayOpen(false)} maxWidthClassName="max-w-2xl">
          <ClientSearchList
            rows={sorted}
            isLoading={isLoading}
            currentId={clientId}
            onSelect={(id) => { setClientId(id); setOverlayOpen(false) }}
            onClear={() => { setClientId(null); setOverlayOpen(false) }}
          />
        </Modal>
      )}
    </>
  )
}

function ClientSearchList({ rows, isLoading, currentId, onSelect, onClear }: {
  rows: FleetRiskRow[]
  isLoading: boolean
  currentId: string | null
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="space-y-3">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <button
        type="button"
        onClick={onClear}
        className={cn(
          'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
          !currentId ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
        )}
      >
        All clients
      </button>
      {isLoading && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">No clients match.</p>
      )}
      <div className="max-h-80 space-y-0.5 overflow-y-auto">
        {filtered.map((row) => (
          <button
            key={row.clientId}
            type="button"
            onClick={() => onSelect(row.clientId)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              row.clientId === currentId ? 'bg-muted font-medium text-foreground' : 'text-foreground hover:bg-muted',
            )}
          >
            <span className="truncate">{row.name}</span>
            <StatusIndicator label={riskLabel(row.riskScore)} tone={riskTone(row.riskScore)} />
          </button>
        ))}
      </div>
    </div>
  )
}

function riskTone(score: number): StatusTone {
  if (score >= 60) return 'negative'
  if (score >= 30) return 'warning'
  return 'positive'
}

function riskLabel(score: number): string {
  if (score >= 60) return 'Needs attention'
  if (score >= 30) return 'Watch'
  return 'Healthy'
}

function dotClass(score: number): string {
  if (score >= 60) return 'bg-destructive'
  if (score >= 30) return 'bg-warning'
  return 'bg-brand-green'
}

// Approximate signal disclosed inline, per EM's decision — never presented
// as a precise distinct metric (agentErrorRatePct shares its underlying
// data with webhookFailureRatePct; see ClientService.getFleetRisk()).
function riskTooltip(row: FleetRiskRow): string {
  const parts = [
    row.staleConversationAgeMins > 0 ? `Oldest unanswered: ${row.staleConversationAgeMins}m` : null,
    row.handoffBacklogCount > 0 ? `${row.handoffBacklogCount} awaiting handoff` : null,
    row.webhookFailureRatePct > 0 ? `${row.webhookFailureRatePct.toFixed(0)}% delivery/processing issues (approximate)` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'No issues detected'
}
