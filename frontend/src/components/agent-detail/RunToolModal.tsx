import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react'
import api from '../../lib/api'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'
import { describeToolRun } from './describeToolRun'

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
    <Modal
      title={`Run ${toolName}`}
      onClose={onClose}
      preventClose={mutation.isPending}
      maxWidthClassName="max-w-2xl"
    >
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
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
        </div>

        {mutation.isError && (
          <div className="mt-3">
            <ErrorBanner error={mutation.error} />
          </div>
        )}

        {result && (() => {
          // The envelope is JSON-encoded three deep, so printing result.output
          // directly showed every "<" as < — the response was present and
          // unreadable. describeToolRun unwraps it; see that file for the detail.
          const view = describeToolRun(result.output)
          const good = view.ok && !view.error
          return (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {good ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className={good ? 'text-brand-green' : 'text-destructive'}>
                  {good ? 'Worked' : 'Did not work'}
                </span>
                {view.httpStatus !== null && (
                  <span className="text-muted-foreground">· the API answered HTTP {view.httpStatus}</span>
                )}
                {view.headers?.['content-type'] && (
                  <span className="text-muted-foreground">· {view.headers['content-type'].split(';')[0]}</span>
                )}
              </div>

              {view.error && <p className="text-xs text-destructive">{view.error}</p>}

              <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
                {view.body || '(the API returned an empty body)'}
              </pre>

              <details>
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                  Show the raw response from Meta
                </summary>
                <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-[11px] whitespace-pre-wrap break-all">
                  {view.raw || '(no output)'}
                </pre>
              </details>
            </div>
          )
        })()}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleRun}
            disabled={mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
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
    </Modal>
  )
}
