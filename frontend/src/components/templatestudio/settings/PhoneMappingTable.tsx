import { Loader2, Save } from 'lucide-react'
import { PhoneTableRow, PhoneCard, type DraftCred, type MappingView, type PhoneRow } from './PhoneMappingRow'

// Extracted from WabaBlock.tsx (V2 rebrand slice 6) to stay under the
// 200-line component ceiling — desktop table + mobile card stack + the
// Save mappings action, all driven by the same rows/drafts state.
export default function PhoneMappingTable({
  rows,
  mappingByPhone,
  drafts,
  onDraftChange,
  dirtyUnmappedCount,
  saving,
  onSave,
}: {
  rows: PhoneRow[]
  mappingByPhone: Map<string, MappingView>
  drafts: Record<string, DraftCred>
  onDraftChange: (phoneNumberId: string, next: DraftCred) => void
  dirtyUnmappedCount: number
  saving: boolean
  onSave: () => void
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              <th className="px-2 py-2">Phone</th>
              <th className="px-2 py-2">Quality</th>
              <th className="px-2 py-2">Karix API Key</th>
              <th className="px-2 py-2">ESME Address</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <PhoneTableRow
                key={row.phoneNumberId}
                row={row}
                mapping={mappingByPhone.get(row.phoneNumberId)}
                draft={drafts[row.phoneNumberId]}
                onDraftChange={(next) => onDraftChange(row.phoneNumberId, next)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <PhoneCard
            key={row.phoneNumberId}
            row={row}
            mapping={mappingByPhone.get(row.phoneNumberId)}
            draft={drafts[row.phoneNumberId]}
            onDraftChange={(next) => onDraftChange(row.phoneNumberId, next)}
          />
        ))}
      </div>

      <div className="flex flex-col items-end gap-2 border-t pt-3">
        {dirtyUnmappedCount === 0 && rows.some((r) => !mappingByPhone.has(r.phoneNumberId)) && (
          <p className="text-xs text-muted-foreground">
            Enter Karix credentials for at least one unmapped phone number.
          </p>
        )}
        <button
          type="button"
          disabled={dirtyUnmappedCount === 0 || saving}
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save mappings
        </button>
      </div>
    </>
  )
}
