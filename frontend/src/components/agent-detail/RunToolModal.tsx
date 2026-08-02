import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Play, X, XCircle } from 'lucide-react'
import api from '../../lib/api'

function extractMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}

export default function RunToolModal({
  agentId,
  connectorId,
  toolId,
  toolName,
  onClose,
}: {
  agentId: string
  connectorId: string
  toolId: string
  toolName: string
  onClose: () => void
}) {
  const [input, setInput] = useState('{\n  \n}')
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<{ output?: string; status?: string } | null>(null)

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post(`/agents/${agentId}/connectors/${connectorId}/tools/${toolId}/run`, payload),
    onSuccess: (res) => setResult(res.data.data),
  })

  function handleRun() {
    setParseError(null)
    setResult(null)
    try {
      JSON.parse(input)
    } catch {
      setParseError('That\'s not valid JSON — check for a missing comma or bracket.')
      return
    }
    mutation.mutate({ input })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => { if (e.key === 'Escape' && !mutation.isPending) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-tool-title"
        className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="run-tool-title" className="text-base font-semibold text-foreground">
            Run {toolName}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Test-executes this tool against its real external API — the same call the agent would make in a live conversation.
        </p>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Input (JSON-encoded)</label>
          <textarea
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-xs font-mono leading-relaxed
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          />
          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
        </div>

        {mutation.isError && (
          <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {extractMessage(mutation.error)}
          </div>
        )}

        {result && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {result.status === 'success' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={result.status === 'success' ? 'text-brand-green' : 'text-destructive'}>
                {result.status ?? 'unknown'}
              </span>
            </div>
            <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all">
              {result.output ?? '(no output)'}
            </pre>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleRun}
            disabled={mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-pink px-4 py-2.5
              text-sm font-semibold text-white transition-opacity hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run
          </button>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
              text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
