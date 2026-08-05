import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Upload } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import { FilesTable, WebsitesTable, type FileRow, type WebsiteRow } from '../components/files/FileWebsiteTables'
import ErrorBanner from '../components/shared/ErrorBanner'
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal'

interface WabaEntry { id: string; wabaId: string; label: string | null }
interface AgentEntry { id: string; displayName: string; phoneNumberId: string | null }

export default function FileLibraryPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'files' | 'websites'>('files')
  const [uploadAgentId, setUploadAgentId] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDeleteFile, setPendingDeleteFile] = useState<FileRow | null>(null)
  const [pendingDeleteWebsite, setPendingDeleteWebsite] = useState<WebsiteRow | null>(null)

  const { data: wabas = [] } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const { data: agents = [] } = useQuery<AgentEntry[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
  })
  const boundAgents = agents.filter((a) => a.phoneNumberId != null)

  const { data: files = [], isLoading: filesLoading } = useQuery<FileRow[]>({
    queryKey: ['library-files', waba?.id],
    queryFn: () => api.get('/files', { params: { wabaId: waba!.id } }).then((r) => r.data.data?.files ?? []),
    enabled: !!waba,
  })

  const { data: websites = [], isLoading: websitesLoading } = useQuery<WebsiteRow[]>({
    queryKey: ['library-websites', waba?.id],
    queryFn: () => api.get('/websites', { params: { wabaId: waba!.id } }).then((r) => r.data.data?.websites ?? []),
    enabled: !!waba,
  })

  const uploadMutation = useMutation({
    mutationFn: ({ agentId, file }: { agentId: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post(`/agents/${agentId}/files`, formData, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['library-files', waba?.id] }); setFormError(null) },
    onError: (err) => setFormError(extractErrorMessage(err)),
  })

  const addWebsiteMutation = useMutation({
    mutationFn: ({ agentId, url }: { agentId: string; url: string }) =>
      api.post(`/agents/${agentId}/websites`, { url }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['library-websites', waba?.id] }); setWebsiteUrl(''); setFormError(null) },
    onError: (err) => setFormError(extractErrorMessage(err)),
  })

  const deleteFileMutation = useMutation({
    mutationFn: (row: FileRow) => api.delete(`/agents/${row.agentId}/files/${row.id}`),
    onMutate: (row) => { setDeletingId(row.id); setDeleteError(null) },
    onSettled: () => setDeletingId(null),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['library-files', waba?.id] }); setPendingDeleteFile(null) },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  })

  const deleteWebsiteMutation = useMutation({
    mutationFn: (row: WebsiteRow) => api.delete(`/agents/${row.agentId}/websites/${row.id}`),
    onMutate: (row) => { setDeletingId(row.id); setDeleteError(null) },
    onSettled: () => setDeletingId(null),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['library-websites', waba?.id] }); setPendingDeleteWebsite(null) },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Files</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {waba ? `Every file and website across every agent on ${waba.label ?? waba.wabaId}.` : 'Knowledge sources for your agents, in one place.'}
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {(['files', 'websites'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setFormError(null) }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-brand-pink text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'files' ? 'Files' : 'Websites'}
          </button>
        ))}
      </div>

      {formError && <ErrorBanner error={formError} />}

      <div className="rounded-xl border bg-card p-4 shadow-surface-resting space-y-3">
        <label htmlFor="upload-agent-picker" className="text-xs font-medium text-muted-foreground">
          {tab === 'files' ? 'Upload a file to' : 'Add a website to'}
        </label>
        <div className="flex gap-2">
          <select
            id="upload-agent-picker"
            value={uploadAgentId}
            onChange={(e) => setUploadAgentId(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Choose an agent…</option>
            {boundAgents.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName} ({a.phoneNumberId})</option>
            ))}
          </select>

          {tab === 'files' ? (
            <label className={`flex items-center gap-1.5 rounded-lg bg-brand-pink px-4 py-2 text-xs font-semibold text-white
              transition-opacity hover:opacity-90 ${!uploadAgentId || uploadMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
              <input
                type="file"
                className="hidden"
                disabled={!uploadAgentId || uploadMutation.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && uploadAgentId) { setFormError(null); uploadMutation.mutate({ agentId: uploadAgentId, file }) }
                  e.target.value = ''
                }}
              />
            </label>
          ) : (
            <>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              />
              <button
                onClick={() => { setFormError(null); addWebsiteMutation.mutate({ agentId: uploadAgentId, url: websiteUrl.trim() }) }}
                disabled={!uploadAgentId || !websiteUrl.trim() || addWebsiteMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-brand-pink px-4 py-2 text-xs font-semibold text-white
                  transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addWebsiteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden overflow-x-auto">
        {tab === 'files' ? (
          <FilesTable isLoading={filesLoading} rows={files} deletingId={deletingId} onDelete={(row) => setPendingDeleteFile(row)} />
        ) : (
          <WebsitesTable isLoading={websitesLoading} rows={websites} deletingId={deletingId} onDelete={(row) => setPendingDeleteWebsite(row)} />
        )}
      </div>

      {pendingDeleteFile && (
        <ConfirmDeleteModal
          title="Delete file"
          consequence={
            <>
              Delete <strong className="font-semibold text-foreground">{pendingDeleteFile.filename}</strong>?
              Your agent will no longer use it as a knowledge source. This cannot be undone.
            </>
          }
          confirmLabel="Delete file"
          isPending={deletingId === pendingDeleteFile.id}
          error={deleteError}
          onConfirm={() => deleteFileMutation.mutate(pendingDeleteFile)}
          onClose={() => setPendingDeleteFile(null)}
        />
      )}

      {pendingDeleteWebsite && (
        <ConfirmDeleteModal
          title="Delete website"
          consequence={
            <>
              Delete <strong className="font-semibold text-foreground">{pendingDeleteWebsite.url}</strong>?
              Your agent will no longer use it as a knowledge source. This cannot be undone.
            </>
          }
          confirmLabel="Delete website"
          isPending={deletingId === pendingDeleteWebsite.id}
          error={deleteError}
          onConfirm={() => deleteWebsiteMutation.mutate(pendingDeleteWebsite)}
          onClose={() => setPendingDeleteWebsite(null)}
        />
      )}
    </div>
  )
}
