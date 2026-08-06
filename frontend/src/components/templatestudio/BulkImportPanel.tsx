import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import ConsequenceLine from '../shared/ConsequenceLine'

export default function BulkImportPanel({ wabaId }: { wabaId: string }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 shadow-surface-resting">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Bulk import</h3>
      </div>
      <ConsequenceLine>
        Each row becomes a template submitted for Meta approval — same name and category rules as Create.
      </ConsequenceLine>
      <p className="text-xs text-muted-foreground">
        Upload an Excel sheet (.xlsx) with columns: template_name, category, language, body_text, and optional
        header/footer/button columns.
      </p>
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) { setError(null); setJobId(null); uploadMutation.mutate(file) }
        }}
        className="text-sm text-foreground"
      />
      {error && <ErrorBanner error={error} />}
      {jobId && statusQuery.data && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Job status: <span className="font-medium text-foreground">{statusQuery.data.job?.status}</span></p>
          <p>Rows: {statusQuery.data.job?.processed_rows ?? 0} / {statusQuery.data.job?.total_rows ?? 0}</p>
        </div>
      )}
    </div>
  )
}
