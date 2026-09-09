import { AlertTriangle } from 'lucide-react'

export interface ProbeResult {
  status: number
  latencyMs: number
  sizeBytes: number
  truncated: boolean
  headers: Record<string, string>
  body: string
}

/**
 * What came back from a real call.
 *
 * The honest version of a Postman response pane. Two things it says that
 * Postman does not, both because this product has already been bitten by them:
 *
 * A 2xx is not success. The Kundli API answers `200` with
 * `{"status":"failed","reason":"lat and lon are required"}`. An operator who
 * reads the green badge and moves on has shipped a broken action. So when a 2xx
 * body carries a falsy status field, the code is not the headline — the body is.
 *
 * And a working call is not a working agent. Nothing here proves the model will
 * choose this action or fill its parameters correctly; it proves the endpoint
 * answers. The footer says so, because "it worked in the test" is exactly the
 * sentence that precedes a customer conversation failing.
 */

/** Pretty-prints JSON, and leaves anything else — XML, HTML, a plain string — alone. */
function formatBody(body: string): { text: string; json: unknown | null } {
  const trimmed = body.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { text: body, json: null }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return { text: JSON.stringify(parsed, null, 2), json: parsed }
  } catch {
    // Claimed to be JSON by its first character and is not. Showing it raw is
    // more useful than an error, because the raw text is what has to be fixed.
    return { text: body, json: null }
  }
}

/**
 * Whether a 2xx body is admitting failure.
 *
 * Conservative on purpose: only these exact shapes, only on a 2xx, and never
 * from prose. Guessing more widely would cry wolf on healthy responses, and a
 * warning that fires on working calls gets ignored on the one that matters.
 */
function bodyReportsFailure(status: number, json: unknown): string | null {
  if (status < 200 || status >= 300) return null
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null

  const record = json as Record<string, unknown>

  const status_ = record.status
  if (typeof status_ === 'string' && /^(failed|failure|error)$/i.test(status_.trim())) {
    return `The body says status: "${status_}".`
  }
  if (record.success === false) return 'The body says success: false.'
  if (typeof record.error === 'string' && record.error.trim()) {
    return `The body carries an error: "${record.error}".`
  }
  return null
}

export default function ResponsePane({
  result,
  error,
}: {
  /** Null before anything has been sent. */
  result: ProbeResult | null
  error: string | null
}) {
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-destructive">The call did not complete</p>
        <p className="max-w-2xl text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing sent yet. Press Send to call this endpoint and see what comes back.
      </p>
    )
  }

  const { text, json } = formatBody(result.body)
  const failureInBody = bodyReportsFailure(result.status, json)
  const ok = result.status >= 200 && result.status < 300

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span
          className={
            'rounded-md px-2 py-1 font-mono font-semibold ' +
            (ok && !failureInBody
              ? 'bg-success/10 text-success'
              : failureInBody
                ? 'bg-warning/10 text-warning'
                : 'bg-destructive/10 text-destructive')
          }
        >
          {result.status}
        </span>
        <span className="tabular-nums text-muted-foreground">{result.latencyMs} ms</span>
        <span className="tabular-nums text-muted-foreground">
          {result.sizeBytes.toLocaleString()} bytes
          {result.truncated && ' (truncated)'}
        </span>
      </div>

      {/* The whole reason this pane is not just a status badge. */}
      {failureInBody && (
        <p className="flex max-w-2xl items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">The call reached the API, but it failed.</strong>{' '}
            {failureInBody} An HTTP {result.status} only means the request arrived — read the body,
            not the code. Your agent will see this body too, so the description on the Docs tab has
            to tell it what a failure looks like.
          </span>
        </p>
      )}

      {Object.keys(result.headers).length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Response header</th>
                <th className="px-3 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.headers).map(([name, value]) => (
                <tr key={name} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">{name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">Body</p>
        {/* Scrolls inside its own box. A 256KB response must not stretch the
            page or push the request bar off screen. */}
        <pre className="max-h-96 overflow-auto rounded-xl border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
          {text || '(empty)'}
        </pre>
        {result.truncated && (
          <p className="text-xs text-muted-foreground">
            Cut off at 256KB. Enough to see the shape; not the whole response.
          </p>
        )}
      </div>

      <p className="max-w-2xl border-t pt-2 text-xs text-muted-foreground">
        This proves the endpoint answers. It does not prove your agent will call it correctly —
        that depends on the description, and only a real conversation tests it.
      </p>
    </div>
  )
}
