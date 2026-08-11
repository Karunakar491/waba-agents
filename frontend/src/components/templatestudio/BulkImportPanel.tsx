import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Upload, FileSpreadsheet } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import { cn } from '../../lib/utils'
import ErrorBanner from '../shared/ErrorBanner'
import ConsequenceLine from '../shared/ConsequenceLine'

// V2 rebrand (Figma node 96:2). NOTE: Figma's full spec also shows a "Map
// columns" step and a completed-state succeeded/failed breakdown — neither
// exists in the backend today (bulk-import's job status is a raw passthrough
// of whatever karix-mcp returns, currently only status/processed_rows/
// total_rows are read anywhere in this codebase). Building column-mapping UI
// without a real backend contract behind it would be a fabricated feature,
// so this restyle covers upload + real-field progress only; Map Columns and
// a verified succeeded/failed summary are follow-up work once confirmed
// against karix-mcp's actual response shape.
export default function BulkImportPanel({ wabaId }: { wabaId: string }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post(`/templates/${wabaId}/bulk-import`, form, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: (res) => setJobId(res.data?.data?.job_id ?? null),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const statusQuery = useQuery({
    queryKey: ['bulk-import-status', wabaId, jobId],
    queryFn: () => api.get(`/templates/${wabaId}/bulk-import/${jobId}`).then((r) => r.data.data),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data?.job?.status === 'completed' || query.state.data?.job?.status === 'failed' ? false : 2000),
  })

  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setJobId(null)
    uploadMutation.mutate(file)
  }

  const job = statusQuery.data?.job
  const totalRows: number = job?.total_rows ?? 0
  const processedRows: number = job?.processed_rows ?? 0
  const progressPct = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 shadow-surface-resting">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[15px] font-semibold text-foreground">Bulk import</h3>
      </div>
      <ConsequenceLine>
        Each row becomes a template submitted for Meta approval — same name and category rules as Create.
      </ConsequenceLine>
      <p className="text-xs text-muted-foreground">
        Upload an Excel sheet (.xlsx) with columns: template_name, category, language, body_text, and optional
        header/footer/button columns.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background py-7 transition-colors',
          dragOver && 'border-accent-teal-solid bg-accent-teal/10',
        )}
      >
        <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Drop .xlsx file here, or</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          Choose file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="sr-only"
        />
      </div>

      {error && <ErrorBanner error={error} />}

      {jobId && job && (
        <div className="space-y-2 rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                job.status === 'completed' ? 'bg-accent-teal' : job.status === 'failed' ? 'bg-destructive' : 'bg-warning',
              )}
            />
            <span className="font-medium text-foreground">Job status: {job.status}</span>
          </div>
          {totalRows > 0 && (
            <>
              <p className="text-xs text-muted-foreground">Rows: {processedRows} / {totalRows}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-accent-teal-solid transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
