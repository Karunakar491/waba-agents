/**
 * Loading placeholder for any table body — per DESIGN.md §5, no operation
 * over 300ms may render blank. Promoted from `FileWebsiteTables.tsx` (2026-08-05)
 * after the same three-row pulse pattern was independently reinvented in
 * `ConnectorsTable.tsx`.
 */
export default function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
      ))}
    </div>
  )
}
