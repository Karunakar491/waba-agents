import { Pencil } from 'lucide-react'
import StatusIndicator from '../shared/StatusIndicator'
import {
  PAGE_SIZE,
  TEMPLATE_STATUS_TONE,
  canEditStatus,
  classifyStatus,
  qualityLabel,
  templateId,
  type TemplateSummary,
} from './templateModel'

// Extracted from TemplateListPanel.tsx (V2 rebrand slice 3) to keep that
// file under the 200-line component ceiling.
export default function TemplateTable({
  rows, page, pageCount, total, onPage, onEdit,
}: {
  rows: TemplateSummary[]
  page: number
  pageCount: number
  total: number
  onPage: (updater: (p: number) => number) => void
  onEdit: (t: TemplateSummary) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3">Name</th>
            <th className="pb-2 pr-3">Category</th>
            <th className="pb-2 pr-3">Language</th>
            <th className="pb-2 pr-3">Quality</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 text-right">Edit</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((t) => {
            const editable = canEditStatus(t.status)
            const pending = classifyStatus(t.status) === 'PENDING'
            return (
              <tr key={templateId(t)} className="hover:bg-muted">
                <td className="max-w-[240px] py-2.5 pr-3">
                  <p className="truncate font-medium text-foreground" title={t.template_name || t.name}>
                    {t.template_name || t.name}
                  </p>
                  {classifyStatus(t.status) === 'REJECTED' && (t.rejected_reason || t.reject_reason) && (
                    <p className="truncate text-xs text-destructive" title={t.rejected_reason || t.reject_reason}>
                      Rejected: {t.rejected_reason || t.reject_reason}
                    </p>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">{t.category ?? '—'}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{t.language ?? '—'}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{qualityLabel(t) ?? '—'}</td>
                <td className="py-2.5 pr-3">
                  <StatusIndicator
                    label={t.status || 'unknown'}
                    tone={TEMPLATE_STATUS_TONE[classifyStatus(t.status)]}
                  />
                </td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => editable && onEdit(t)}
                    className="rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={pending ? 'Edit unavailable while Pending' : 'Edit template'}
                    title={
                      pending
                        ? 'Meta is still reviewing this template — edit when Approved, Rejected, or Paused'
                        : editable
                          ? 'Edit template'
                          : 'Only Approved, Rejected, or Paused templates can be edited (Meta)'
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => onPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border px-2 py-1 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">Page {page + 1} of {pageCount}</span>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => onPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-lg border px-2 py-1 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
