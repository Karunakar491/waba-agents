import StatusIndicator, { type StatusTone } from '../../shared/StatusIndicator'

export interface PhoneRow {
  phoneNumberId: string
  displayPhoneNumber: string | null
  qualityRating: string | null
}

export interface MappingView {
  phoneNumberId: string
  displayPhoneNumber: string | null
  esmeAddr: string | null
  esmeLabel: string | null
}

export interface DraftCred {
  apiKey: string
  esmeAddr: string
  label: string
}

// Keep labels identical to DashboardPage QUALITY_CONFIG — same Meta signal.
const QUALITY_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  GREEN: { label: 'Quality: High', tone: 'positive' },
  YELLOW: { label: 'Quality: Medium', tone: 'warning' },
  RED: { label: 'Quality: Low', tone: 'negative' },
}

export function qualityIndicator(qualityRating: string | null | undefined) {
  if (!qualityRating) return { label: 'Quality: Unknown', tone: 'neutral' as const }
  return QUALITY_CONFIG[qualityRating] ?? { label: `Quality: ${qualityRating}`, tone: 'neutral' as const }
}

interface RowProps {
  row: PhoneRow
  mapping: MappingView | undefined
  draft: DraftCred | undefined
  onDraftChange: (d: DraftCred) => void
}

// Extracted from TemplateSettingsPage.tsx (V2 rebrand slice 6) — desktop
// table row / mobile card, same data, split from the page's 870-line
// original per the EM-approved decomposition plan.
export function PhoneTableRow({ row, mapping, draft, onDraftChange }: RowProps) {
  const q = qualityIndicator(row.qualityRating)
  const configured = !!mapping?.esmeAddr
  const value = draft ?? { apiKey: '', esmeAddr: '', label: '' }

  return (
    <tr className="hover:bg-muted">
      <td className="px-2 py-2.5 font-medium text-foreground">
        {row.displayPhoneNumber || row.phoneNumberId}
      </td>
      <td className="px-2 py-2.5">
        <StatusIndicator label={q.label} tone={q.tone} />
      </td>
      <td className="px-2 py-2.5">
        {configured ? (
          <span className="text-xs text-muted-foreground" title="API key is stored encrypted and never shown again">
            ••••••••••••
          </span>
        ) : (
          <input
            type="password"
            value={value.apiKey}
            onChange={(e) => onDraftChange({ ...value, apiKey: e.target.value })}
            placeholder="Paste API key"
            className="w-full min-w-[140px] rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
          />
        )}
      </td>
      <td className="px-2 py-2.5">
        {configured ? (
          <span className="text-sm text-foreground">{mapping.esmeAddr}</span>
        ) : (
          <input
            type="text"
            value={value.esmeAddr}
            onChange={(e) => onDraftChange({ ...value, esmeAddr: e.target.value, label: e.target.value })}
            placeholder="esme_addr"
            className="w-full min-w-[120px] rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
          />
        )}
      </td>
    </tr>
  )
}

export function PhoneCard({ row, mapping, draft, onDraftChange }: RowProps) {
  const q = qualityIndicator(row.qualityRating)
  const configured = !!mapping?.esmeAddr
  const value = draft ?? { apiKey: '', esmeAddr: '', label: '' }

  return (
    <div className="space-y-3 rounded-xl border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {row.displayPhoneNumber || row.phoneNumberId}
        </p>
        <StatusIndicator label={q.label} tone={q.tone} />
      </div>
      {configured ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted-foreground">Karix API Key · ••••••••••••</p>
          <p className="text-foreground">ESME · {mapping.esmeAddr}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Karix API Key</label>
            <input
              type="password"
              value={value.apiKey}
              onChange={(e) => onDraftChange({ ...value, apiKey: e.target.value })}
              placeholder="Paste API key"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Karix ESME</label>
            <input
              type="text"
              value={value.esmeAddr}
              onChange={(e) => onDraftChange({ ...value, esmeAddr: e.target.value, label: e.target.value })}
              placeholder="esme_addr"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
            />
          </div>
        </div>
      )}
    </div>
  )
}
